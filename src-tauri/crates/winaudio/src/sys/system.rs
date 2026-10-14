//! Read-only system facts: the Bluetooth Support Service and the Wi-Fi band.

use windows::core::w;
use windows::Win32::Foundation::HANDLE;
use windows::Win32::NetworkManagement::WiFi::{
    wlan_interface_state_connected, wlan_intf_opcode_channel_number, WlanCloseHandle,
    WlanEnumInterfaces, WlanFreeMemory, WlanOpenHandle, WlanQueryInterface,
    WLAN_INTERFACE_INFO_LIST,
};
use windows::Win32::System::Services::{
    CloseServiceHandle, OpenSCManagerW, OpenServiceW, QueryServiceStatus, SC_MANAGER_CONNECT,
    SERVICE_QUERY_STATUS, SERVICE_RUNNING, SERVICE_STATUS,
};

/// `bthserv` (Bluetooth Support Service) is running.
pub fn bluetooth_service_running() -> Result<bool, String> {
    unsafe {
        let scm = OpenSCManagerW(None, None, SC_MANAGER_CONNECT).map_err(|e| e.to_string())?;
        let result = OpenServiceW(scm, w!("bthserv"), SERVICE_QUERY_STATUS)
            .map_err(|e| e.to_string())
            .and_then(|service| {
                let mut status = SERVICE_STATUS::default();
                let r = QueryServiceStatus(service, &mut status).map_err(|e| e.to_string());
                let _ = CloseServiceHandle(service);
                r.map(|()| status.dwCurrentState == SERVICE_RUNNING)
            });
        let _ = CloseServiceHandle(scm);
        result
    }
}

/// Some Wi-Fi interface is connected on channel 1-14 (2.4 GHz). `None` when
/// the WLAN service is not there (no Wi-Fi hardware or service stopped).
pub fn wifi_24ghz_active() -> Option<bool> {
    unsafe {
        let mut version = 0u32;
        let mut client = HANDLE::default();
        if WlanOpenHandle(2, None, &mut version, &mut client) != 0 {
            return None;
        }
        let mut list: *mut WLAN_INTERFACE_INFO_LIST = std::ptr::null_mut();
        let mut active = false;
        if WlanEnumInterfaces(client, None, &mut list) == 0 && !list.is_null() {
            let count = (*list).dwNumberOfItems as usize;
            let first = (*list).InterfaceInfo.as_ptr();
            for i in 0..count {
                let info = &*first.add(i);
                if info.isState != wlan_interface_state_connected {
                    continue;
                }
                let mut size = 0u32;
                let mut data: *mut std::ffi::c_void = std::ptr::null_mut();
                if WlanQueryInterface(
                    client,
                    &info.InterfaceGuid,
                    wlan_intf_opcode_channel_number,
                    None,
                    &mut size,
                    &mut data,
                    None,
                ) == 0
                    && !data.is_null()
                {
                    let channel = *(data as *const u32);
                    WlanFreeMemory(data);
                    if (1..=14).contains(&channel) {
                        active = true;
                    }
                }
            }
            WlanFreeMemory(list as *const std::ffi::c_void);
        }
        WlanCloseHandle(client, None);
        Some(active)
    }
}
