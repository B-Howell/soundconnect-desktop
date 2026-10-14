//! MDR frame decoding for diagnostics: the packet observer
//! ([`crate::Engine::set_packet_callback`]) hands out packed frames exactly as
//! they cross the link, and [`describe_frame`] turns one into a log line.
//!
//! Frame layout (`libmdr/include/mdr/Command.hpp` `MDRPackCommand`):
//!
//! ```text
//! '>' ESCAPE( <DATA_TYPE> <SEQ> <SIZE INT32BE> <DATA...> <CHECKSUM> ) '<'
//! ```
//!
//! Escapes: `0x3D 0x2C` -> `0x3C`, `0x3D 0x2D` -> `0x3D`, `0x3D 0x2E` -> `0x3E`.
//! The first data byte is the command (`ProtocolV1T1.hpp` `enum class Command`
//! for V1 table 1, which [`v1_command_name`] names).

use std::fmt::Write as _;

/// Which way a frame travelled (`MDR_PACKET_DIRECTION_RX` / `_TX`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PacketDirection {
    /// Device -> host.
    Rx,
    /// Host -> device.
    Tx,
}

impl PacketDirection {
    pub(crate) fn from_raw(raw: u32) -> Self {
        if raw == mdr_sys::MDR_PACKET_DIRECTION_TX {
            Self::Tx
        } else {
            Self::Rx
        }
    }

    /// `"rx"` / `"tx"` (the upstream recorder's file-name spelling).
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Rx => "rx",
            Self::Tx => "tx",
        }
    }
}

/// An unpacked frame.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DecodedFrame {
    /// `MDRDataType` (0x01 ACK, 0x0C DATA_MDR, 0x0E DATA_MDR_NO2, ...).
    pub data_type: u8,
    pub seq: u8,
    /// The unescaped payload; `payload[0]` is the command byte.
    pub payload: Vec<u8>,
    /// Checksum matched.
    pub checksum_ok: bool,
}

/// Unpacks a `'>' ... '<'` frame; `None` when the markers or size are wrong.
pub fn decode_frame(frame: &[u8]) -> Option<DecodedFrame> {
    if frame.len() < 2 || frame[0] != 0x3E || frame[frame.len() - 1] != 0x3C {
        return None;
    }
    let mut raw = Vec::with_capacity(frame.len());
    let mut it = frame[1..frame.len() - 1].iter();
    while let Some(&b) = it.next() {
        if b == 0x3D {
            match it.next() {
                Some(&0x2C) => raw.push(0x3C),
                Some(&0x2D) => raw.push(0x3D),
                Some(&0x2E) => raw.push(0x3E),
                _ => return None,
            }
        } else {
            raw.push(b);
        }
    }
    if raw.len() < 7 {
        return None;
    }
    let size = u32::from_be_bytes([raw[2], raw[3], raw[4], raw[5]]) as usize;
    if raw.len() != 7 + size {
        return None;
    }
    let checksum = raw[raw.len() - 1];
    let sum = raw[..raw.len() - 1]
        .iter()
        .fold(0u8, |a, b| a.wrapping_add(*b));
    Some(DecodedFrame {
        data_type: raw[0],
        seq: raw[1],
        payload: raw[6..6 + size].to_vec(),
        checksum_ok: sum == checksum,
    })
}

/// `MDRDataType` name (`libmdr/include/mdr/Protocol.hpp`).
pub fn data_type_name(t: u8) -> &'static str {
    match t {
        0 => "DATA",
        1 => "ACK",
        2 => "DATA_MC_NO1",
        9 => "DATA_ICD",
        10 => "DATA_EV",
        12 => "DATA_MDR",
        13 => "DATA_COMMON",
        14 => "DATA_MDR_NO2",
        16 => "SHOT",
        18 => "SHOT_MC_NO1",
        25 => "SHOT_ICD",
        26 => "SHOT_EV",
        28 => "SHOT_MDR",
        29 => "SHOT_COMMON",
        _ => "?",
    }
}

/// V1 table-1 command name (`ProtocolV1T1.hpp` `enum class Command`).
pub fn v1_command_name(cmd: u8) -> Option<&'static str> {
    Some(match cmd {
        0x00 => "CONNECT_GET_PROTOCOL_INFO",
        0x01 => "CONNECT_RET_PROTOCOL_INFO",
        0x02 => "CONNECT_GET_CAPABILITY_INFO",
        0x03 => "CONNECT_RET_CAPABILITY_INFO",
        0x04 => "CONNECT_GET_DEVICE_INFO",
        0x05 => "CONNECT_RET_DEVICE_INFO",
        0x06 => "CONNECT_GET_SUPPORT_FUNCTION",
        0x07 => "CONNECT_RET_SUPPORT_FUNCTION",
        0x10 => "COMMON_GET_BATTERY_LEVEL",
        0x11 => "COMMON_RET_BATTERY_LEVEL",
        0x13 => "COMMON_NTFY_BATTERY_LEVEL",
        0x14 => "COMMON_GET_UPSCALING_EFFECT",
        0x15 => "COMMON_RET_UPSCALING_EFFECT",
        0x17 => "COMMON_NTFY_UPSCALING_EFFECT",
        0x18 => "COMMON_GET_AUDIO_CODEC",
        0x19 => "COMMON_RET_AUDIO_CODEC",
        0x1B => "COMMON_NTFY_AUDIO_CODEC",
        0x1C => "COMMON_GET_BLUETOOTH_DEVICE_INFO",
        0x1D => "COMMON_RET_BLUETOOTH_DEVICE_INFO",
        0x22 => "COMMON_SET_POWER_OFF",
        0x24 => "COMMON_GET_CONNECTION_STATUS",
        0x25 => "COMMON_RET_CONNECTION_STATUS",
        0x27 => "COMMON_NTFY_CONNECTION_STATUS",
        0x28 => "COMMON_GET_CONCIERGE_DATA",
        0x29 => "COMMON_RET_CONCIERGE_DATA",
        0x2E => "COMMON_SET_LINK_CONTROL",
        0x2F => "COMMON_NTFY_LINK_CONTROL",
        0x34 => "UPDT_SET_STATUS",
        0x35 => "UPDT_NTFY_STATUS",
        0x36 => "UPDT_GET_PARAM",
        0x37 => "UPDT_RET_PARAM",
        0x40 => "VPT_GET_CAPABILITY",
        0x41 => "VPT_RET_CAPABILITY",
        0x42 => "VPT_GET_STATUS",
        0x43 => "VPT_RET_STATUS",
        0x45 => "VPT_NTFY_STATUS",
        0x46 => "VPT_GET_PARAM",
        0x47 => "VPT_RET_PARAM",
        0x48 => "VPT_SET_PARAM",
        0x49 => "VPT_NTFY_PARAM",
        0x50 => "EQEBB_GET_CAPABILITY",
        0x51 => "EQEBB_RET_CAPABILITY",
        0x52 => "EQEBB_GET_STATUS",
        0x53 => "EQEBB_RET_STATUS",
        0x55 => "EQEBB_NTFY_STATUS",
        0x56 => "EQEBB_GET_PARAM",
        0x57 => "EQEBB_RET_PARAM",
        0x58 => "EQEBB_SET_PARAM",
        0x59 => "EQEBB_NTFY_PARAM",
        0x5A => "EQEBB_GET_EXTENDED_INFO",
        0x5B => "EQEBB_RET_EXTENDED_INFO",
        0x60 => "NCASM_GET_CAPABILITY",
        0x61 => "NCASM_RET_CAPABILITY",
        0x62 => "NCASM_GET_STATUS",
        0x63 => "NCASM_RET_STATUS",
        0x65 => "NCASM_NTFY_STATUS",
        0x66 => "NCASM_GET_PARAM",
        0x67 => "NCASM_RET_PARAM",
        0x68 => "NCASM_SET_PARAM",
        0x69 => "NCASM_NTFY_PARAM",
        0x70 => "SENSE_GET_CAPABILITY",
        0x71 => "SENSE_RET_CAPABILITY",
        0x74 => "SENSE_SET_STATUS",
        0x80 => "OPT_GET_CAPABILITY",
        0x81 => "OPT_RET_CAPABILITY",
        0x82 => "OPT_GET_STATUS",
        0x83 => "OPT_RET_STATUS",
        0x84 => "OPT_SET_STATUS",
        0x85 => "OPT_NTFY_STATUS",
        0x86 => "OPT_GET_PARAM",
        0x87 => "OPT_RET_PARAM",
        0x89 => "OPT_NTFY_PARAM",
        0x90 => "ALERT_GET_CAPABILITY",
        0x91 => "ALERT_RET_CAPABILITY",
        0x94 => "ALERT_SET_STATUS",
        0x98 => "ALERT_SET_PARAM",
        0x99 => "ALERT_NTFY_PARAM",
        0xA0 => "PLAY_GET_CAPABILITY",
        0xA1 => "PLAY_RET_CAPABILITY",
        0xA2 => "PLAY_GET_STATUS",
        0xA3 => "PLAY_RET_STATUS",
        0xA4 => "PLAY_SET_STATUS",
        0xA5 => "PLAY_NTFY_STATUS",
        0xA6 => "PLAY_GET_PARAM",
        0xA7 => "PLAY_RET_PARAM",
        0xA8 => "PLAY_SET_PARAM",
        0xA9 => "PLAY_NTFY_PARAM",
        0xB0 => "SPORTS_GET_CAPABILITY",
        0xB1 => "SPORTS_RET_CAPABILITY",
        0xB2 => "SPORTS_GET_STATUS",
        0xB3 => "SPORTS_RET_STATUS",
        0xB5 => "SPORTS_NTFY_STATUS",
        0xB6 => "SPORTS_GET_PARAM",
        0xB7 => "SPORTS_RET_PARAM",
        0xB8 => "SPORTS_SET_PARAM",
        0xB9 => "SPORTS_NTFY_PARAM",
        0xBA => "SPORTS_GET_EXTENDED_PARAM",
        0xBB => "SPORTS_RET_EXTENDED_PARAM",
        0xBC => "SPORTS_SET_EXTENDED_PARAM",
        0xBD => "SPORTS_NTFY_EXTENDED_PARAM",
        0xC4 => "LOG_SET_STATUS",
        0xC9 => "LOG_NTFY_PARAM",
        0xD0 => "GENERAL_SETTING_GET_CAPABILITY",
        0xD1 => "GENERAL_SETTING_RET_CAPABILITY",
        0xD2 => "GENERAL_SETTING_GET_STATUS",
        0xD3 => "GENERAL_SETTING_RET_STATUS",
        0xD5 => "GENERAL_SETTING_NTFY_STATUS",
        0xD6 => "GENERAL_SETTING_GET_PARAM",
        0xD7 => "GENERAL_SETTING_RET_PARAM",
        0xD8 => "GENERAL_SETTING_SET_PARAM",
        0xD9 => "GENERAL_SETTING_NTNY_PARAM",
        0xE0 => "AUDIO_GET_CAPABILITY",
        0xE1 => "AUDIO_RET_CAPABILITY",
        0xE2 => "AUDIO_GET_STATUS",
        0xE3 => "AUDIO_RET_STATUS",
        0xE5 => "AUDIO_NTFY_STATUS",
        0xE6 => "AUDIO_GET_PARAM",
        0xE7 => "AUDIO_RET_PARAM",
        0xE8 => "AUDIO_SET_PARAM",
        0xE9 => "AUDIO_NTFY_PARAM",
        0xF0 => "SYSTEM_GET_CAPABILITY",
        0xF1 => "SYSTEM_RET_CAPABILITY",
        0xF2 => "SYSTEM_GET_STATUS",
        0xF3 => "SYSTEM_RET_STATUS",
        0xF5 => "SYSTEM_NTFY_STATUS",
        0xF6 => "SYSTEM_GET_PARAM",
        0xF7 => "SYSTEM_RET_PARAM",
        0xF8 => "SYSTEM_SET_PARAM",
        0xF9 => "SYSTEM_NTFY_PARAM",
        0xFA => "SYSTEM_GET_EXTENDED_PARAM",
        0xFB => "SYSTEM_RET_EXTENDED_PARAM",
        0xFC => "SYSTEM_SET_EXTENDED_PARAM",
        0xFD => "SYSTEM_NTFY_EXTENDED_PARAM",
        0xFF => "TEST_COMMAND",
        _ => return None,
    })
}

fn hex(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 3);
    for (i, b) in bytes.iter().enumerate() {
        if i > 0 {
            s.push(' ');
        }
        let _ = write!(s, "{b:02x}");
    }
    s
}

/// One log line: `tx len=14 DATA_MDR seq=0 NCASM_SET_PARAM payload=[68 02 ...] raw=[3e ...]`.
/// Command names are table-1 V1 names; for other protocols only the byte is meaningful.
pub fn describe_frame(direction: PacketDirection, frame: &[u8]) -> String {
    let mut line = format!("{} len={}", direction.as_str(), frame.len());
    match decode_frame(frame) {
        Some(d) => {
            let _ = write!(line, " {} seq={}", data_type_name(d.data_type), d.seq);
            if let Some(&cmd) = d.payload.first() {
                let name = if d.data_type == 12 {
                    v1_command_name(cmd).unwrap_or("?")
                } else {
                    "?"
                };
                let _ = write!(line, " cmd=0x{cmd:02x}({name})");
            }
            if !d.checksum_ok {
                line.push_str(" BAD_CHECKSUM");
            }
            let _ = write!(line, " payload=[{}]", hex(&d.payload));
        }
        None => line.push_str(" undecodable"),
    }
    let _ = write!(line, " raw=[{}]", hex(frame));
    line
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_a_recorded_xm3_ncasm_notify() {
        let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../../upstream/SonyHeadphonesClient/tests/WH-1000XM3-4.5.2");
        let name = std::fs::read_dir(&dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .find(|n| n.contains("NCASM_NTFY_PARAM"))
            .expect("an NCASM_NTFY_PARAM frame");
        let bytes = std::fs::read(dir.join(&name)).unwrap();
        let d = decode_frame(&bytes).expect("decodes");
        assert!(d.checksum_ok);
        assert_eq!(d.data_type, 12);
        assert_eq!(d.payload[0], 0x69);
        let line = describe_frame(PacketDirection::Rx, &bytes);
        assert!(line.contains("NCASM_NTFY_PARAM"), "{line}");
    }

    #[test]
    fn unescapes_markers_inside_the_body() {
        // type 0x0c, seq 0, size 1, data 0x3e, checksum 0x0c+0x01+0x3e = 0x4b
        let frame = [0x3e, 0x0c, 0x00, 0, 0, 0, 0x01, 0x3d, 0x2e, 0x4b, 0x3c];
        let d = decode_frame(&frame).unwrap();
        assert_eq!(d.payload, vec![0x3e]);
        assert!(d.checksum_ok);
        assert!(decode_frame(&[0x3e, 0x3c]).is_none());
    }
}
