//! [`ReplayTransport`]: feeds a recorded capture directory to libmdr.
//!
//! Follows `upstream/SonyHeadphonesClient/tests/Replay.cpp` `MockTransport`'s
//! result mapping: `recv` hands out RX bytes until they run out and then reports
//! "would block" (`MDR_RESULT_INPROGRESS`, 0 bytes); `send` records TX; `poll` is
//! always ready; no devices are listed. Deliberate deviation: Replay.cpp loads one
//! frame per step, whereas this concatenates every `*-rx.*.bin` frame up front, so
//! one `recv` may return several frames (like a real RFCOMM stream) while libmdr's
//! own init/sync coroutines run against them.
//!
//! Capture file names: `mdr-packet-<ms>-<6-digit ordinal>-rx.type-<TYPE>-<hex>.seq-<n>.cmd-<NAME>-<hex>.bin`.

use crate::error::{Error, Result};
use crate::protocol::Protocol;
use crate::transport::{ConnectStatus, DeviceInfo, PollStatus, Transport};
use std::path::{Path, PathBuf};

/// One recorded RX frame.
#[derive(Clone, Debug)]
pub struct Frame {
    /// The 6-digit ordinal from the file name (shared counter across RX and TX).
    pub ordinal: u32,
    /// The file name, e.g. `...-rx.type-DATA_MDR-0c.seq-00.cmd-CONNECT_RET_PROTOCOL_INFO-01.bin`.
    pub file_name: String,
    /// Raw frame bytes, `>` ... `<`.
    pub bytes: Vec<u8>,
}

/// A [`Transport`] that replays recorded RX frames and records TX.
#[derive(Debug, Default)]
pub struct ReplayTransport {
    source: Option<PathBuf>,
    frames: Vec<Frame>,
    rx: Vec<u8>,
    offset: usize,
    tx: Vec<u8>,
    connected: bool,
    disconnected: bool,
}

impl ReplayTransport {
    /// Loads every `*-rx.*.bin` file in `dir`, sorted by ordinal.
    pub fn from_capture_dir(dir: impl AsRef<Path>) -> Result<Self> {
        let dir = dir.as_ref();
        let mut frames = Vec::new();
        for entry in std::fs::read_dir(dir)? {
            let entry = entry?;
            let file_name = entry.file_name().to_string_lossy().into_owned();
            if !entry.file_type()?.is_file()
                || !file_name.ends_with(".bin")
                || !file_name.contains("-rx.")
            {
                continue;
            }
            let ordinal = parse_ordinal(&file_name).ok_or_else(|| {
                Error::InvalidArgument(format!("capture file without ordinal: {file_name}"))
            })?;
            let bytes = std::fs::read(entry.path())?;
            frames.push(Frame {
                ordinal,
                file_name,
                bytes,
            });
        }
        if frames.is_empty() {
            return Err(Error::InvalidArgument(format!(
                "no *-rx.*.bin frames in {}",
                dir.display()
            )));
        }
        frames.sort_by_key(|f| f.ordinal);
        let rx = frames
            .iter()
            .flat_map(|f| f.bytes.iter().copied())
            .collect();
        Ok(Self {
            source: Some(dir.to_path_buf()),
            frames,
            rx,
            ..Self::default()
        })
    }

    /// A replay of raw bytes (no frame metadata); used for trampoline tests.
    pub fn from_bytes(rx: Vec<u8>) -> Self {
        Self {
            rx,
            ..Self::default()
        }
    }

    /// The directory this replay was loaded from.
    pub fn source(&self) -> Option<&Path> {
        self.source.as_deref()
    }

    /// Number of RX frames loaded.
    pub fn frame_count(&self) -> usize {
        self.frames.len()
    }

    /// The frames in replay order.
    pub fn frames(&self) -> &[Frame] {
        &self.frames
    }

    /// All RX bytes, concatenated in replay order.
    pub fn rx_bytes(&self) -> &[u8] {
        &self.rx
    }

    /// RX bytes not yet handed to libmdr.
    pub fn rx_remaining(&self) -> usize {
        self.rx.len() - self.offset
    }

    /// Everything libmdr has sent so far.
    pub fn tx_bytes(&self) -> &[u8] {
        &self.tx
    }

    /// Whether `disconnect` has been called.
    pub fn disconnected(&self) -> bool {
        self.disconnected
    }

    /// Infers the protocol family the way `Replay.cpp` `DetectProtocolVersion` does:
    /// the first valid `DATA_MDR` frame whose command byte is
    /// `CONNECT_RET_PROTOCOL_INFO` (0x01) has a 4-byte payload on V1 and 8 bytes on
    /// V2. Defaults to V2 when no such frame exists.
    pub fn detect_protocol(&self) -> Protocol {
        self.frames
            .iter()
            .find_map(|f| protocol_from_frame(&f.bytes))
            .unwrap_or(Protocol::V2)
    }
}

/// `mdr-packet-<ms>-<ordinal>-rx...` -> ordinal.
fn parse_ordinal(file_name: &str) -> Option<u32> {
    let rest = file_name.strip_prefix("mdr-packet-")?;
    let mut parts = rest.splitn(3, '-');
    let _ms = parts.next()?;
    parts.next()?.parse().ok()
}

fn protocol_from_frame(frame: &[u8]) -> Option<Protocol> {
    // Frames are bounded by '>' (0x3E) ... '<' (0x3C).
    let sof = frame.iter().position(|&b| b == 0x3E)?;
    let eof = sof + 1 + frame[sof + 1..].iter().position(|&b| b == 0x3C)?;
    // Unescape: '=' (0x3D) introduces 0x2C/0x2D/0x2E for '<', '=', '>'.
    let mut inner = Vec::with_capacity(eof - sof);
    let mut it = frame[sof + 1..eof].iter();
    while let Some(&b) = it.next() {
        if b == 0x3D {
            let &n = it.next()?;
            inner.push(match n {
                0x2C => 0x3C,
                0x2D => 0x3D,
                0x2E => 0x3E,
                other => other,
            });
        } else {
            inner.push(b);
        }
    }
    // inner = [type, seq, sizeBE(4), data..., checksum]
    if inner.len() < 7 || inner[0] != 0x0C {
        return None;
    }
    let size = u32::from_be_bytes([inner[2], inner[3], inner[4], inner[5]]) as usize;
    let data_end = 6usize.checked_add(size)?;
    if size < 1 || data_end + 1 > inner.len() {
        return None;
    }
    let sum = inner[..data_end]
        .iter()
        .fold(0u8, |a, &b| a.wrapping_add(b));
    if sum != inner[data_end] || inner[6] != 0x01 {
        return None;
    }
    match size {
        4 => Some(Protocol::V1),
        8 => Some(Protocol::V2),
        _ => None,
    }
}

impl Transport for ReplayTransport {
    fn connect(&mut self, _mac: &str, _uuid: &str) -> Result<ConnectStatus> {
        self.connected = true;
        Ok(ConnectStatus::Connected)
    }

    fn disconnect(&mut self) {
        self.connected = false;
        self.disconnected = true;
    }

    fn recv(&mut self, dst: &mut [u8]) -> Result<Option<usize>> {
        if self.offset == self.rx.len() {
            return Ok(None);
        }
        let n = dst.len().min(self.rx.len() - self.offset);
        dst[..n].copy_from_slice(&self.rx[self.offset..self.offset + n]);
        self.offset += n;
        Ok(Some(n))
    }

    fn send(&mut self, src: &[u8]) -> Result<usize> {
        self.tx.extend_from_slice(src);
        Ok(src.len())
    }

    fn poll(&mut self, _timeout_ms: i32) -> Result<PollStatus> {
        Ok(PollStatus::Ready)
    }

    fn devices(&mut self) -> Result<Vec<DeviceInfo>> {
        Ok(Vec::new())
    }

    fn last_error(&self) -> String {
        "replay transport".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ordinal_parses_from_capture_name() {
        assert_eq!(
            parse_ordinal("mdr-packet-1791485921245-000001-rx.type-DATA_MDR-0c.seq-00.cmd-CONNECT_RET_PROTOCOL_INFO-01.bin"),
            Some(1)
        );
        assert_eq!(parse_ordinal("other.bin"), None);
    }

    #[test]
    fn xm3_first_frame_is_v1_protocol_info() {
        // Bytes of the first XM3 capture file (observed with xxd).
        let f = [
            0x3E, 0x0C, 0, 0, 0, 0, 0x04, 0x01, 0x00, 0x40, 0x10, 0x61, 0x3C,
        ];
        assert_eq!(protocol_from_frame(&f), Some(Protocol::V1));
    }
}
