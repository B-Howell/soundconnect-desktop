//! The Hands-Free (HFP, `0000111E`) and Headset (HSP, `00001108`) Bluetooth
//! services of one paired device: read with `BluetoothEnumerateInstalledServices`
//! (user), switched with `BluetoothSetServiceState` (installs or removes the
//! device driver, so it runs in the elevated helper).

use windows::core::GUID;
use windows::Win32::Devices::Bluetooth::{
    BluetoothEnumerateInstalledServices, BluetoothSetServiceState, BLUETOOTH_ADDRESS,
    BLUETOOTH_DEVICE_INFO, BLUETOOTH_SERVICE_DISABLE, BLUETOOTH_SERVICE_ENABLE,
};
use windows::Win32::Foundation::{ERROR_INVALID_PARAMETER, ERROR_MORE_DATA, ERROR_SUCCESS};

pub const HANDS_FREE: GUID = GUID::from_u128(0x0000111e_0000_1000_8000_00805f9b34fb);
pub const HEADSET: GUID = GUID::from_u128(0x00001108_0000_1000_8000_00805f9b34fb);

fn device_info(address_hex: &str) -> Option<BLUETOOTH_DEVICE_INFO> {
    let raw = u64::from_str_radix(address_hex, 16).ok()?;
    let mut info = BLUETOOTH_DEVICE_INFO {
        dwSize: std::mem::size_of::<BLUETOOTH_DEVICE_INFO>() as u32,
        ..Default::default()
    };
    info.Address = BLUETOOTH_ADDRESS {
        Anonymous: windows::Win32::Devices::Bluetooth::BLUETOOTH_ADDRESS_0 { ullLong: raw },
    };
    Some(info)
}

/// The service class GUIDs Windows has installed for the device.
pub fn installed_services(address_hex: &str) -> Result<Vec<GUID>, String> {
    let info = device_info(address_hex).ok_or("not a Bluetooth address")?;
    let mut count: u32 = 32;
    let mut guids = vec![GUID::zeroed(); count as usize];
    let rc = unsafe {
        BluetoothEnumerateInstalledServices(None, &info, &mut count, Some(guids.as_mut_ptr()))
    };
    if rc == ERROR_MORE_DATA.0 {
        guids.resize(count as usize, GUID::zeroed());
        let rc = unsafe {
            BluetoothEnumerateInstalledServices(None, &info, &mut count, Some(guids.as_mut_ptr()))
        };
        if rc != ERROR_SUCCESS.0 {
            return Err(format!("BluetoothEnumerateInstalledServices failed ({rc})"));
        }
    } else if rc != ERROR_SUCCESS.0 {
        return Err(format!("BluetoothEnumerateInstalledServices failed ({rc})"));
    }
    guids.truncate(count as usize);
    Ok(guids)
}

/// Hands-Free or Headset installed.
pub fn hands_free_enabled(address_hex: &str) -> Result<bool, String> {
    Ok(installed_services(address_hex)?
        .iter()
        .any(|g| *g == HANDS_FREE || *g == HEADSET))
}

/// Turns both services on or off. "Already in that state" (`E_INVALIDARG`-
/// style `ERROR_INVALID_PARAMETER`) counts as success; the caller reads back.
pub fn set_hands_free(address_hex: &str, enabled: bool) -> Result<(), String> {
    let info = device_info(address_hex).ok_or("not a Bluetooth address")?;
    let flag = if enabled {
        BLUETOOTH_SERVICE_ENABLE
    } else {
        BLUETOOTH_SERVICE_DISABLE
    };
    let mut errors = Vec::new();
    let mut ok = false;
    for service in [HANDS_FREE, HEADSET] {
        let rc = unsafe { BluetoothSetServiceState(None, &info, &service, flag) };
        if rc == ERROR_SUCCESS.0 || rc == ERROR_INVALID_PARAMETER.0 {
            ok = true;
        } else {
            errors.push(format!(
                "BluetoothSetServiceState({service:?}) failed ({rc})"
            ));
        }
    }
    if ok {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}
