//! `libmdr-bt/include/mdr-bt/ConnectionWindows.h`

use crate::connection::MDRConnection;

/// ConnectionWindows.h:14 Classic (RFCOMM/SDP) Windows connection (opaque).
#[repr(C)]
pub struct MDRConnectionWindows {
    _p: [u8; 0],
}

/// ConnectionWindows.h:21 Bluetooth Low Energy Windows connection (opaque, `#ifdef MDR_BLE`).
#[repr(C)]
pub struct MDRConnectionWindowsBLE {
    _p: [u8; 0],
}

extern "C" {
    /// ConnectionWindows.h:15
    pub fn mdrConnectionWindowsCreate() -> *mut MDRConnectionWindows;
    /// ConnectionWindows.h:16 Returns the vtable owned by `conn`.
    pub fn mdrConnectionWindowsGet(conn: *mut MDRConnectionWindows) -> *mut MDRConnection;
    /// ConnectionWindows.h:17
    pub fn mdrConnectionWindowsDestroy(conn: *mut MDRConnectionWindows);
    /// ConnectionWindows.h:22 (`#ifdef MDR_BLE`; exported by the CI build).
    pub fn mdrConnectionWindowsBLECreate() -> *mut MDRConnectionWindowsBLE;
    /// ConnectionWindows.h:23 (`#ifdef MDR_BLE`).
    pub fn mdrConnectionWindowsBLEGet(conn: *mut MDRConnectionWindowsBLE) -> *mut MDRConnection;
    /// ConnectionWindows.h:24 (`#ifdef MDR_BLE`).
    pub fn mdrConnectionWindowsBLEDestroy(conn: *mut MDRConnectionWindowsBLE);
}
