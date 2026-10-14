//! [`WindowsTransport`]: the upstream Windows Bluetooth Classic (RFCOMM) backend
//! from `mdr-bt-shared.dll` (`libmdr-bt/include/mdr-bt/ConnectionWindows.h`),
//! presented as a Rust [`Transport`].
//!
//! Design choice: this implements [`Transport`] by delegating to the
//! `mdrConnection*` helpers (`Connection.h:51-104`) on
//! `mdrConnectionWindowsGet(w)`, so the engine reaches it through the
//! [`crate::ConnectionBox`] trampolines (libmdr -> trampoline -> helper -> upstream
//! vtable). The extra indirection costs one call per send/recv and keeps a single
//! code path for live and replayed sessions: [`crate::Engine::create`] takes a
//! `Box<dyn Transport>` and owns it, so the upstream connection is guaranteed to
//! outlive the `MDRHeadphones` instance (the engine destroys its handle before
//! dropping the box).
//!
//! The upstream backend (`libmdr-bt/src/Windows/ConnectionWindows.cpp`) is plain
//! Winsock (`AF_BTH`/`BTHPROTO_RFCOMM`, non-blocking): no thread affinity. Its
//! device list uses `BluetoothFindFirstDevice` with `.fReturnConnected = 1` and
//! nothing else, so only devices Windows currently has **connected** are listed.

use crate::error::{Error, Result};
use crate::transport::{ConnectStatus, DeviceInfo, PollStatus, Transport};
use crate::types::fixed_str;
use mdr_sys::*;
use std::ffi::{c_char, c_int, CStr, CString};
use std::ptr::{null_mut, NonNull};

/// The upstream Windows RFCOMM connection, owned.
pub struct WindowsTransport {
    raw: NonNull<MDRConnectionWindows>,
}

// SAFETY: the upstream object is a Winsock socket plus a string (no thread-affine
// state, see ConnectionWindows.cpp:13-31); every access goes through `&mut self`
// or `&self` of this uniquely owning value, so it is never used from two threads
// at once.
unsafe impl Send for WindowsTransport {}

impl WindowsTransport {
    /// `mdrConnectionWindowsCreate`.
    pub fn new() -> Result<Self> {
        // SAFETY: no preconditions; returns a new heap object or null.
        let raw = unsafe { mdrConnectionWindowsCreate() };
        NonNull::new(raw)
            .map(|raw| Self { raw })
            .ok_or_else(|| Error::Transport("mdrConnectionWindowsCreate returned null".into()))
    }

    /// The upstream vtable (`mdrConnectionWindowsGet`); valid while `self` lives.
    fn conn(&self) -> *mut MDRConnection {
        // SAFETY: `raw` is a live object from mdrConnectionWindowsCreate.
        unsafe { mdrConnectionWindowsGet(self.raw.as_ptr()) }
    }

    fn upstream_error(&self) -> String {
        // SAFETY: live connection; the header guarantees a non-null NUL-terminated
        // UTF-8 string (Connection.h:100-104), copied before any other call.
        let p = unsafe { mdrConnectionGetLastError(self.conn()) };
        if p.is_null() {
            return String::new();
        }
        // SAFETY: non-null and NUL-terminated per the header contract.
        unsafe { CStr::from_ptr(p) }.to_string_lossy().into_owned()
    }

    fn fail(&self, code: MDRResult, call: &'static str) -> Error {
        Error::Mdr {
            code,
            call,
            detail: self.upstream_error(),
        }
    }
}

impl Drop for WindowsTransport {
    fn drop(&mut self) {
        // ConnectionWindows.cpp's Destroy does not close the socket; Disconnect is
        // idempotent (it checks INVALID_SOCKET), so close it first.
        // SAFETY: live object, destroyed exactly once.
        unsafe {
            mdrConnectionDisconnect(self.conn());
            mdrConnectionWindowsDestroy(self.raw.as_ptr());
        }
    }
}

fn cstring(s: &str, what: &str) -> Result<CString> {
    CString::new(s).map_err(|_| Error::InvalidArgument(format!("{what} contains NUL")))
}

impl Transport for WindowsTransport {
    fn connect(&mut self, mac: &str, uuid: &str) -> Result<ConnectStatus> {
        let mac = cstring(mac, "mac")?;
        let uuid = cstring(uuid, "uuid")?;
        // SAFETY: live connection; both strings are NUL-terminated for the call.
        let code = unsafe { mdrConnectionConnect(self.conn(), mac.as_ptr(), uuid.as_ptr()) };
        match code {
            MDR_RESULT_OK => Ok(ConnectStatus::Connected),
            MDR_RESULT_INPROGRESS => Ok(ConnectStatus::InProgress),
            c => Err(self.fail(c, "mdrConnectionConnect")),
        }
    }

    fn disconnect(&mut self) {
        // SAFETY: live connection; upstream Disconnect is idempotent.
        unsafe { mdrConnectionDisconnect(self.conn()) }
    }

    fn recv(&mut self, dst: &mut [u8]) -> Result<Option<usize>> {
        let size = c_int::try_from(dst.len()).unwrap_or(c_int::MAX);
        let mut got: c_int = 0;
        // SAFETY: live connection; `dst` has at least `size` writable bytes.
        let code = unsafe {
            mdrConnectionRecv(
                self.conn(),
                dst.as_mut_ptr().cast::<c_char>(),
                size,
                &mut got,
            )
        };
        match code {
            MDR_RESULT_OK => Ok(Some(usize::try_from(got).unwrap_or(0).min(dst.len()))),
            MDR_RESULT_INPROGRESS => Ok(None),
            c => Err(self.fail(c, "mdrConnectionRecv")),
        }
    }

    fn send(&mut self, src: &[u8]) -> Result<usize> {
        let size = c_int::try_from(src.len()).unwrap_or(c_int::MAX);
        let mut sent: c_int = 0;
        // SAFETY: live connection; `src` has at least `size` readable bytes.
        let code = unsafe {
            mdrConnectionSend(self.conn(), src.as_ptr().cast::<c_char>(), size, &mut sent)
        };
        match code {
            MDR_RESULT_OK => Ok(usize::try_from(sent).unwrap_or(0).min(src.len())),
            // Would block: report 0 bytes accepted; libmdr keeps the buffer and
            // retries on the next poll (Headphones.cpp MDRHeadphones::Send erases
            // only `sent` bytes).
            MDR_RESULT_INPROGRESS => Ok(0),
            c => Err(self.fail(c, "mdrConnectionSend")),
        }
    }

    fn poll(&mut self, timeout_ms: i32) -> Result<PollStatus> {
        // SAFETY: live connection.
        let code = unsafe { mdrConnectionPoll(self.conn(), timeout_ms) };
        match code {
            MDR_RESULT_OK => Ok(PollStatus::Ready),
            MDR_RESULT_INPROGRESS => Ok(PollStatus::InProgress),
            MDR_RESULT_ERROR_TIMEOUT => Ok(PollStatus::TimedOut),
            c => Err(self.fail(c, "mdrConnectionPoll")),
        }
    }

    fn devices(&mut self) -> Result<Vec<DeviceInfo>> {
        let mut list: *mut MDRDeviceInfo = null_mut();
        let mut count: c_int = 0;
        // SAFETY: live connection; valid out-pointers.
        let code = unsafe { mdrConnectionGetDevicesList(self.conn(), &mut list, &mut count) };
        if code != MDR_RESULT_OK {
            return Err(self.fail(code, "mdrConnectionGetDevicesList"));
        }
        let mut out = Vec::new();
        if !list.is_null() && count > 0 {
            // SAFETY: upstream allocated `count` contiguous entries at `list`.
            let items = unsafe { std::slice::from_raw_parts(list, count as usize) };
            out = items
                .iter()
                .map(|d| DeviceInfo {
                    name: fixed_str(&d.szDeviceName),
                    mac: fixed_str(&d.szDeviceMacAddress),
                })
                .collect();
        }
        if !list.is_null() {
            // SAFETY: `list` came from GetDevicesList on this connection; freed once.
            unsafe { mdrConnectionFreeDevicesList(self.conn(), &mut list) };
        }
        Ok(out)
    }

    fn last_error(&self) -> String {
        self.upstream_error()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Needs Bluetooth and a WH-1000XM4 connected to Windows. Run with
    /// `cargo test -p mdr live_ -- --ignored --nocapture`.
    #[test]
    #[ignore = "needs the WH-1000XM4 connected to this PC"]
    fn live_devices_lists_connected_xm4() {
        let mut t = WindowsTransport::new().expect("create");
        let devices = t.devices().expect("devices");
        for d in &devices {
            println!("{} {}", d.mac, d.name);
        }
        assert!(
            devices.iter().any(|d| d.name == "WH-1000XM4"),
            "WH-1000XM4 not listed: {devices:?}"
        );
    }

    #[test]
    fn create_and_drop_without_connecting() {
        let mut t = WindowsTransport::new().expect("create");
        // Upstream Recv reports NO_CONNECTION before connect.
        let mut buf = [0u8; 8];
        let err = t.recv(&mut buf).unwrap_err();
        assert_eq!(err.code(), MDR_RESULT_ERROR_NO_CONNECTION, "{err}");
    }
}
