//! `libmdr/include/mdr-c/Base.h`

use core::ffi::{c_char, CStr};

/// Base.h:5 `#define MDR_ABI_VERSION 2u` (2: MDREqualizer gained `available` and `dsee_available`).
pub const MDR_ABI_VERSION: u32 = 2;

/// Base.h:27 `typedef uint32_t MDRResult;`
pub type MDRResult = u32;

/// Base.h:30 `#define MDR_INIT_BT_BLE (1u << 0u)`
pub const MDR_INIT_BT_BLE: u32 = 1 << 0;
/// Base.h:32
pub const MDR_RESULT_OK: MDRResult = 0;
/// Base.h:33
pub const MDR_RESULT_INPROGRESS: MDRResult = 1;
/// Base.h:34
pub const MDR_RESULT_ERROR_GENERAL: MDRResult = 2;
/// Base.h:35
pub const MDR_RESULT_ERROR_NOT_FOUND: MDRResult = 3;
/// Base.h:36
pub const MDR_RESULT_ERROR_TIMEOUT: MDRResult = 4;
/// Base.h:37
pub const MDR_RESULT_ERROR_NET: MDRResult = 5;
/// Base.h:38
pub const MDR_RESULT_ERROR_NO_CONNECTION: MDRResult = 6;
/// Base.h:39
pub const MDR_RESULT_ERROR_BAD_ADDRESS: MDRResult = 7;
/// Base.h:40
pub const MDR_RESULT_ERROR_NOT_SUPPORTED: MDRResult = 8;
/// Base.h:41
pub const MDR_RESULT_ERROR_BUFFER_TOO_SMALL: MDRResult = 9;
/// Base.h:42
pub const MDR_RESULT_ERROR_MALFORMED_PAYLOAD: MDRResult = 10;
/// Base.h:43
pub const MDR_RESULT_ERROR_INVALID_ARGUMENT: MDRResult = 11;
/// Base.h:44
pub const MDR_RESULT_ERROR_ABI_MISMATCH: MDRResult = 12;

/// Base.h:47 XM5s and newer (Bluetooth Classic RFCOMM).
pub const MDR_SERVICE_UUID_XM5: &CStr = c"956C7B26-D49A-4BA8-B03F-B17D393CB6E2";
/// Base.h:49 XM4s and older (Bluetooth Classic RFCOMM).
pub const MDR_SERVICE_UUID_LEGACY: &CStr = c"96CC203E-5068-46AD-B32D-E316F5E069BA";
/// Base.h:52 BLE GATT service UUID for TANDEM_OVER_BLE_HPC_SERVICE.
pub const MDR_BLE_SERVICE_UUID_TANDEM_OVER_BLE_HPC: &CStr = c"5B833E20-6BC7-4802-8E9A-723CECA4BD8F";

extern "C" {
    /// Base.h:59 `MDR_API const char* mdrResultString(MDRResult err);`
    pub fn mdrResultString(err: MDRResult) -> *const c_char;
}
