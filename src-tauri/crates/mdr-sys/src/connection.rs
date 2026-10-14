//! `libmdr/include/mdr-c/Connection.h`

use crate::base::MDRResult;
use core::ffi::{c_char, c_int, c_void};

/// Connection.h:6-10
#[repr(C)]
#[derive(Clone, Copy, Debug)]
pub struct MDRDeviceInfo {
    /// Connection.h:8 `char szDeviceName[128];`
    pub szDeviceName: [c_char; 128],
    /// Connection.h:9 `char szDeviceMacAddress[18];`
    pub szDeviceMacAddress: [c_char; 18],
}

/// Connection.h:21
pub type MDRConnectFn = unsafe extern "C" fn(
    user: *mut c_void,
    macAddress: *const c_char,
    serviceUUID: *const c_char,
) -> MDRResult;
/// Connection.h:23
pub type MDRDisconnectFn = unsafe extern "C" fn(user: *mut c_void);
/// Connection.h:25
pub type MDRRecvFn = unsafe extern "C" fn(
    user: *mut c_void,
    dst: *mut c_char,
    size: c_int,
    pReceived: *mut c_int,
) -> MDRResult;
/// Connection.h:27
pub type MDRSendFn = unsafe extern "C" fn(
    user: *mut c_void,
    src: *const c_char,
    size: c_int,
    pSent: *mut c_int,
) -> MDRResult;
/// Connection.h:29
pub type MDRPollFn = unsafe extern "C" fn(user: *mut c_void, timeout: c_int) -> MDRResult;
/// Connection.h:31
pub type MDRGetDevicesListFn = unsafe extern "C" fn(
    user: *mut c_void,
    ppList: *mut *mut MDRDeviceInfo,
    pCount: *mut c_int,
) -> MDRResult;
/// Connection.h:33
pub type MDRFreeDevicesListFn =
    unsafe extern "C" fn(user: *mut c_void, ppList: *mut *mut MDRDeviceInfo) -> MDRResult;
/// Connection.h:35
pub type MDRGetLastErrorFn = unsafe extern "C" fn(user: *mut c_void) -> *const c_char;

/// Connection.h:16-36 MDR RFCOMM socket vtable. Field order is the header order.
#[repr(C)]
#[derive(Clone, Copy, Debug)]
pub struct MDRConnection {
    /// Connection.h:19
    pub user: *mut c_void,
    /// Connection.h:21
    pub connect: Option<MDRConnectFn>,
    /// Connection.h:23
    pub disconnect: Option<MDRDisconnectFn>,
    /// Connection.h:25
    pub recv: Option<MDRRecvFn>,
    /// Connection.h:27
    pub send: Option<MDRSendFn>,
    /// Connection.h:29
    pub poll: Option<MDRPollFn>,
    /// Connection.h:31
    pub getDevicesList: Option<MDRGetDevicesListFn>,
    /// Connection.h:33
    pub freeDevicesList: Option<MDRFreeDevicesListFn>,
    /// Connection.h:35
    pub getLastError: Option<MDRGetLastErrorFn>,
}

extern "C" {
    /// Connection.h:51 Returns MDR_RESULT_INPROGRESS on success; poll until OK.
    pub fn mdrConnectionConnect(
        conn: *mut MDRConnection,
        macAddress: *const c_char,
        serviceUUID: *const c_char,
    ) -> MDRResult;
    /// Connection.h:56
    pub fn mdrConnectionDisconnect(conn: *mut MDRConnection);
    /// Connection.h:65
    pub fn mdrConnectionRecv(
        conn: *mut MDRConnection,
        dst: *mut c_char,
        size: c_int,
        pReceived: *mut c_int,
    ) -> MDRResult;
    /// Connection.h:74
    pub fn mdrConnectionSend(
        conn: *mut MDRConnection,
        src: *const c_char,
        size: c_int,
        pSent: *mut c_int,
    ) -> MDRResult;
    /// Connection.h:81 timeout: >0 ms, 0 immediate, <0 forever.
    pub fn mdrConnectionPoll(conn: *mut MDRConnection, timeout: c_int) -> MDRResult;
    /// Connection.h:89 Free the list with mdrConnectionFreeDevicesList.
    pub fn mdrConnectionGetDevicesList(
        conn: *mut MDRConnection,
        ppList: *mut *mut MDRDeviceInfo,
        pCount: *mut c_int,
    ) -> MDRResult;
    /// Connection.h:96
    pub fn mdrConnectionFreeDevicesList(
        conn: *mut MDRConnection,
        ppList: *mut *mut MDRDeviceInfo,
    ) -> MDRResult;
    /// Connection.h:104 Never null; NUL-terminated UTF-8.
    pub fn mdrConnectionGetLastError(conn: *mut MDRConnection) -> *const c_char;
}
