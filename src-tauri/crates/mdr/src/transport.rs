//! The [`Transport`] trait and [`ConnectionBox`], which presents a Rust transport
//! to libmdr as an `MDRConnection` vtable (`Connection.h:16-36`).
//!
//! Result mapping mirrors `upstream/.../tests/Replay.cpp` `MockTransport`:
//!
//! | Rust                         | C                                             |
//! |------------------------------|-----------------------------------------------|
//! | `connect` `Ok(Connected)`    | `MDR_RESULT_OK`                               |
//! | `connect` `Ok(InProgress)`   | `MDR_RESULT_INPROGRESS`                       |
//! | `recv` `Ok(Some(n))`         | `MDR_RESULT_OK`, `*pReceived = n`             |
//! | `recv` `Ok(None)`            | `MDR_RESULT_INPROGRESS`, `*pReceived = 0`     |
//! | `send` `Ok(n)`               | `MDR_RESULT_OK`, `*pSent = n`                 |
//! | `poll` `Ready/InProgress/TimedOut` | `OK` / `INPROGRESS` / `ERROR_TIMEOUT`   |
//! | any `Err(e)`                 | `e.code()`; message kept for `getLastError`   |
//! | a panic                      | `MDR_RESULT_ERROR_GENERAL` (never unwinds)    |

use crate::error::{Error, Result};
use mdr_sys::{MDRConnection, MDRDeviceInfo, MDRResult};
use std::any::Any;
use std::ffi::{c_char, c_int, c_void, CStr, CString};
use std::panic::{catch_unwind, AssertUnwindSafe};

/// Outcome of [`Transport::connect`].
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ConnectStatus {
    /// The link is up.
    Connected,
    /// Connecting continues; call [`Transport::poll`] until `Ready`.
    InProgress,
}

/// Outcome of [`Transport::poll`].
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PollStatus {
    /// Send/recv can proceed.
    Ready,
    /// Still connecting.
    InProgress,
    /// The timeout elapsed.
    TimedOut,
}

/// A device a transport can see (`MDRDeviceInfo`).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DeviceInfo {
    /// Friendly name (max 127 bytes in the C struct).
    pub name: String,
    /// `AA:BB:CC:DD:EE:FF` (17 bytes in the C struct).
    pub mac: String,
}

/// A byte transport to the headphones (RFCOMM, BLE, or a recorded capture).
pub trait Transport: Any + Send {
    /// Starts connecting to `mac` on service `uuid`.
    fn connect(&mut self, mac: &str, uuid: &str) -> Result<ConnectStatus>;
    /// Closes the link. Must be idempotent.
    fn disconnect(&mut self);
    /// Reads up to `dst.len()` bytes. `Ok(None)` means nothing available now.
    fn recv(&mut self, dst: &mut [u8]) -> Result<Option<usize>>;
    /// Writes bytes and returns how many were accepted.
    fn send(&mut self, src: &[u8]) -> Result<usize>;
    /// Waits up to `timeout_ms` (0 = immediate, negative = forever).
    fn poll(&mut self, timeout_ms: i32) -> Result<PollStatus>;
    /// Lists devices the transport can connect to.
    fn devices(&mut self) -> Result<Vec<DeviceInfo>>;
    /// Human-readable description of the last failure (empty if none).
    fn last_error(&self) -> String;
}

struct State {
    transport: Box<dyn Transport>,
    last_error: CString,
    /// True when the latest trampoline call failed; its message then wins over
    /// `Transport::last_error` in `getLastError`.
    failed: bool,
    device_lists: Vec<Box<[MDRDeviceInfo]>>,
}

impl State {
    fn set_error(&mut self, msg: impl Into<String>) {
        self.last_error = to_cstring(msg.into());
        self.failed = true;
    }
}

fn to_cstring(s: String) -> CString {
    CString::new(s.replace('\0', " ")).expect("NULs replaced")
}

/// Owns a [`Transport`] and the `MDRConnection` vtable that points at it.
///
/// The vtable lives in its own heap allocation so its address is stable for as
/// long as the box lives; libmdr keeps that pointer (`Headphones.h:470-472`).
pub struct ConnectionBox {
    conn: Box<MDRConnection>,
    state: *mut State,
}

// SAFETY: `State` holds a `Box<dyn Transport>` and `Transport: Send`; the raw
// pointer is uniquely owned by this box and only dereferenced through it.
unsafe impl Send for ConnectionBox {}

impl ConnectionBox {
    /// Wraps `transport` in a vtable libmdr can call.
    pub fn new(transport: Box<dyn Transport>) -> Self {
        let state = Box::into_raw(Box::new(State {
            transport,
            last_error: to_cstring(String::new()),
            failed: false,
            device_lists: Vec::new(),
        }));
        let conn = Box::new(MDRConnection {
            user: state.cast::<c_void>(),
            connect: Some(tramp_connect),
            disconnect: Some(tramp_disconnect),
            recv: Some(tramp_recv),
            send: Some(tramp_send),
            poll: Some(tramp_poll),
            getDevicesList: Some(tramp_get_devices),
            freeDevicesList: Some(tramp_free_devices),
            getLastError: Some(tramp_last_error),
        });
        Self { conn, state }
    }

    /// The vtable pointer to hand to libmdr. Valid while `self` lives.
    pub fn as_raw(&mut self) -> *mut MDRConnection {
        &mut *self.conn
    }

    /// The wrapped transport.
    pub fn transport(&self) -> &dyn Transport {
        // SAFETY: `state` came from Box::into_raw in `new` and is freed only in Drop.
        // The trampolines create `&mut State` only while libmdr runs a call made with
        // the raw vtable pointer; `Engine` exposes this accessor through `&mut self`
        // only, so no such call can overlap the returned borrow.
        unsafe { &*(*self.state).transport }
    }

    /// The wrapped transport, downcast to its concrete type.
    pub fn transport_as<T: Transport>(&self) -> Option<&T> {
        let any: &dyn Any = self.transport();
        any.downcast_ref::<T>()
    }

    /// Mutable access to the wrapped transport, downcast to its concrete type.
    pub fn transport_as_mut<T: Transport>(&mut self) -> Option<&mut T> {
        // SAFETY: as in `transport`, with `&mut self` guaranteeing uniqueness.
        let t: &mut dyn Transport = unsafe { &mut *(*self.state).transport };
        let any: &mut dyn Any = t;
        any.downcast_mut::<T>()
    }
}

impl Drop for ConnectionBox {
    fn drop(&mut self) {
        // SAFETY: `state` came from Box::into_raw in `new` and is freed exactly once.
        drop(unsafe { Box::from_raw(self.state) });
    }
}

/// Runs `f` on the state behind `user`, converting errors and panics to codes.
///
/// # Safety
/// `user` must be the `State` pointer installed by [`ConnectionBox::new`], alive and
/// not otherwise borrowed for the duration of the call.
unsafe fn with_state(
    user: *mut c_void,
    f: impl FnOnce(&mut State) -> Result<MDRResult>,
) -> MDRResult {
    if user.is_null() {
        return mdr_sys::MDR_RESULT_ERROR_INVALID_ARGUMENT;
    }
    // SAFETY: guaranteed by the caller contract above.
    let state = unsafe { &mut *user.cast::<State>() };
    match catch_unwind(AssertUnwindSafe(|| f(&mut *state))) {
        Ok(Ok(code)) => {
            state.failed = false;
            code
        }
        Ok(Err(e)) => {
            state.set_error(e.to_string());
            // An error must never read as OK/INPROGRESS to libmdr.
            match e.code() {
                c if c > mdr_sys::MDR_RESULT_INPROGRESS => c,
                _ => mdr_sys::MDR_RESULT_ERROR_GENERAL,
            }
        }
        Err(panic) => {
            let msg = panic
                .downcast_ref::<&str>()
                .map(|s| s.to_string())
                .or_else(|| panic.downcast_ref::<String>().cloned())
                .unwrap_or_default();
            state.set_error(format!("panic in transport: {msg}"));
            mdr_sys::MDR_RESULT_ERROR_GENERAL
        }
    }
}

/// # Safety
/// `p` is null or a NUL-terminated string valid for the call.
unsafe fn arg_str<'a>(p: *const c_char, what: &str) -> Result<&'a str> {
    if p.is_null() {
        return Err(Error::InvalidArgument(format!("{what} is null")));
    }
    // SAFETY: non-null and NUL-terminated per the caller contract.
    unsafe { CStr::from_ptr(p) }
        .to_str()
        .map_err(|_| Error::InvalidArgument(format!("{what} is not UTF-8")))
}

unsafe extern "C" fn tramp_connect(
    user: *mut c_void,
    mac: *const c_char,
    uuid: *const c_char,
) -> MDRResult {
    // SAFETY: libmdr passes back the `user` we installed and C strings valid for the call.
    unsafe {
        with_state(user, |s| {
            let mac = arg_str(mac, "macAddress")?;
            let uuid = arg_str(uuid, "serviceUUID")?;
            Ok(match s.transport.connect(mac, uuid)? {
                ConnectStatus::Connected => mdr_sys::MDR_RESULT_OK,
                ConnectStatus::InProgress => mdr_sys::MDR_RESULT_INPROGRESS,
            })
        })
    }
}

unsafe extern "C" fn tramp_disconnect(user: *mut c_void) {
    // SAFETY: libmdr passes back the `user` we installed.
    unsafe {
        with_state(user, |s| {
            s.transport.disconnect();
            Ok(mdr_sys::MDR_RESULT_OK)
        });
    }
}

unsafe extern "C" fn tramp_recv(
    user: *mut c_void,
    dst: *mut c_char,
    size: c_int,
    received: *mut c_int,
) -> MDRResult {
    // SAFETY: libmdr passes our `user`, a buffer of `size` writable bytes and an
    // out-pointer; both pointers are checked for null before use.
    unsafe {
        with_state(user, |s| {
            if received.is_null() || size < 0 || (dst.is_null() && size > 0) {
                return Err(Error::InvalidArgument("recv buffer".into()));
            }
            *received = 0;
            if size == 0 {
                return Ok(mdr_sys::MDR_RESULT_OK);
            }
            let buf = std::slice::from_raw_parts_mut(dst.cast::<u8>(), size as usize);
            match s.transport.recv(buf)? {
                Some(n) => {
                    *received = n.min(size as usize) as c_int;
                    Ok(mdr_sys::MDR_RESULT_OK)
                }
                None => Ok(mdr_sys::MDR_RESULT_INPROGRESS),
            }
        })
    }
}

unsafe extern "C" fn tramp_send(
    user: *mut c_void,
    src: *const c_char,
    size: c_int,
    sent: *mut c_int,
) -> MDRResult {
    // SAFETY: libmdr passes our `user`, `size` readable bytes at `src` and an
    // out-pointer; both pointers are checked for null before use.
    unsafe {
        with_state(user, |s| {
            if sent.is_null() || size < 0 || (src.is_null() && size > 0) {
                return Err(Error::InvalidArgument("send buffer".into()));
            }
            *sent = 0;
            let bytes: &[u8] = if size == 0 {
                &[]
            } else {
                std::slice::from_raw_parts(src.cast::<u8>(), size as usize)
            };
            let n = s.transport.send(bytes)?;
            *sent = n.min(size as usize) as c_int;
            Ok(mdr_sys::MDR_RESULT_OK)
        })
    }
}

unsafe extern "C" fn tramp_poll(user: *mut c_void, timeout: c_int) -> MDRResult {
    // SAFETY: libmdr passes back the `user` we installed.
    unsafe {
        with_state(user, |s| {
            Ok(match s.transport.poll(timeout)? {
                PollStatus::Ready => mdr_sys::MDR_RESULT_OK,
                PollStatus::InProgress => mdr_sys::MDR_RESULT_INPROGRESS,
                PollStatus::TimedOut => mdr_sys::MDR_RESULT_ERROR_TIMEOUT,
            })
        })
    }
}

fn copy_c(dst: &mut [c_char], s: &str) {
    let n = s.len().min(dst.len() - 1);
    for (d, b) in dst.iter_mut().zip(s.as_bytes()[..n].iter()) {
        *d = *b as c_char;
    }
    dst[n] = 0;
}

unsafe extern "C" fn tramp_get_devices(
    user: *mut c_void,
    list: *mut *mut MDRDeviceInfo,
    count: *mut c_int,
) -> MDRResult {
    // SAFETY: libmdr passes our `user` and two out-pointers (null-checked).
    unsafe {
        with_state(user, |s| {
            if list.is_null() || count.is_null() {
                return Err(Error::InvalidArgument("device list out-pointers".into()));
            }
            *list = std::ptr::null_mut();
            *count = 0;
            let devices = s.transport.devices()?;
            if devices.is_empty() {
                return Ok(mdr_sys::MDR_RESULT_OK);
            }
            let mut out: Box<[MDRDeviceInfo]> = devices
                .iter()
                .map(|d| {
                    let mut info = MDRDeviceInfo {
                        szDeviceName: [0; 128],
                        szDeviceMacAddress: [0; 18],
                    };
                    copy_c(&mut info.szDeviceName, &d.name);
                    copy_c(&mut info.szDeviceMacAddress, &d.mac);
                    info
                })
                .collect();
            *list = out.as_mut_ptr();
            *count = out.len() as c_int;
            // Kept alive until freeDevicesList (or until the box drops).
            s.device_lists.push(out);
            Ok(mdr_sys::MDR_RESULT_OK)
        })
    }
}

unsafe extern "C" fn tramp_free_devices(
    user: *mut c_void,
    list: *mut *mut MDRDeviceInfo,
) -> MDRResult {
    // SAFETY: libmdr passes our `user` and the pointer we handed out (null-checked).
    unsafe {
        with_state(user, |s| {
            if list.is_null() {
                return Err(Error::InvalidArgument("device list pointer".into()));
            }
            let ptr = *list;
            s.device_lists.retain(|l| l.as_ptr() != ptr.cast_const());
            *list = std::ptr::null_mut();
            Ok(mdr_sys::MDR_RESULT_OK)
        })
    }
}

unsafe extern "C" fn tramp_last_error(user: *mut c_void) -> *const c_char {
    static FALLBACK: &CStr = c"transport error (no details)";
    if user.is_null() {
        return FALLBACK.as_ptr();
    }
    // SAFETY: libmdr passes back the `user` we installed; the returned pointer
    // borrows `State::last_error`, which lives until the next trampoline call.
    let state = unsafe { &mut *user.cast::<State>() };
    if !state.failed {
        match catch_unwind(AssertUnwindSafe(|| state.transport.last_error())) {
            Ok(msg) if !msg.is_empty() => state.last_error = to_cstring(msg),
            Ok(_) => {}
            Err(_) => state.set_error("panic in transport: last_error"),
        }
    }
    if state.last_error.as_bytes().is_empty() {
        return FALLBACK.as_ptr();
    }
    state.last_error.as_ptr()
}
