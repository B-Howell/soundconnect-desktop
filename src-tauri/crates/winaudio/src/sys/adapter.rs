//! The Bluetooth radio's device node (name, driver version) through SetupAPI,
//! and its "Allow the computer to turn off this device to save power" switch
//! through WMI `root\wmi` `MSPower_DeviceEnable` (read as a user, write as admin).

use windows::core::{BSTR, PCWSTR};
use windows::Win32::Devices::Bluetooth::GUID_BTHPORT_DEVICE_INTERFACE;
use windows::Win32::Devices::DeviceAndDriverInstallation::{
    SetupDiDestroyDeviceInfoList, SetupDiEnumDeviceInfo, SetupDiGetClassDevsW,
    SetupDiGetDeviceInstanceIdW, SetupDiGetDevicePropertyW, DIGCF_DEVICEINTERFACE, DIGCF_PRESENT,
    SP_DEVINFO_DATA,
};
use windows::Win32::Devices::Properties::{
    DEVPKEY_Device_DeviceDesc, DEVPKEY_Device_DriverVersion, DEVPKEY_Device_FriendlyName,
    DEVPROPTYPE,
};
use windows::Win32::Foundation::DEVPROPKEY;
use windows::Win32::System::Com::{
    CoCreateInstance, CoSetProxyBlanket, CLSCTX_INPROC_SERVER, EOAC_NONE, RPC_C_AUTHN_LEVEL_CALL,
    RPC_C_IMP_LEVEL_IMPERSONATE,
};
use windows::Win32::System::Variant::{VARIANT, VT_BOOL};
use windows::Win32::System::Wmi::{
    IWbemClassObject, IWbemLocator, IWbemServices, WbemLocator, WBEM_FLAG_FORWARD_ONLY,
    WBEM_FLAG_RETURN_IMMEDIATELY, WBEM_FLAG_UPDATE_ONLY, WBEM_GENERIC_FLAG_TYPE, WBEM_INFINITE,
};

/// The radio's device node.
pub struct RadioNode {
    pub instance_id: String,
    pub name: String,
    pub driver_version: Option<String>,
}

fn string_property(
    set: windows::Win32::Devices::DeviceAndDriverInstallation::HDEVINFO,
    data: &SP_DEVINFO_DATA,
    key: &DEVPROPKEY,
) -> Option<String> {
    let mut kind = DEVPROPTYPE::default();
    let mut buf = vec![0u8; 512];
    let mut size = 0u32;
    unsafe {
        SetupDiGetDevicePropertyW(
            set,
            data,
            key,
            &mut kind,
            Some(&mut buf),
            Some(&mut size),
            0,
        )
    }
    .ok()?;
    let wide: Vec<u16> = buf[..size as usize]
        .as_chunks::<2>()
        .0
        .iter()
        .map(|c| u16::from_le_bytes([c[0], c[1]]))
        .take_while(|&c| c != 0)
        .collect();
    let s = String::from_utf16_lossy(&wide);
    (!s.is_empty()).then_some(s)
}

/// The first present Bluetooth radio.
pub fn radio() -> Option<RadioNode> {
    unsafe {
        let set = SetupDiGetClassDevsW(
            Some(&GUID_BTHPORT_DEVICE_INTERFACE),
            PCWSTR::null(),
            None,
            DIGCF_PRESENT | DIGCF_DEVICEINTERFACE,
        )
        .ok()?;
        let mut data = SP_DEVINFO_DATA {
            cbSize: std::mem::size_of::<SP_DEVINFO_DATA>() as u32,
            ..Default::default()
        };
        let node = SetupDiEnumDeviceInfo(set, 0, &mut data).ok().map(|()| {
            let mut id = vec![0u16; 512];
            let mut size = 0u32;
            let instance_id =
                SetupDiGetDeviceInstanceIdW(set, &data, Some(&mut id), Some(&mut size))
                    .ok()
                    .map(|()| String::from_utf16_lossy(&id[..size.saturating_sub(1) as usize]))
                    .unwrap_or_default();
            RadioNode {
                instance_id,
                name: string_property(set, &data, &DEVPKEY_Device_FriendlyName)
                    .or_else(|| string_property(set, &data, &DEVPKEY_Device_DeviceDesc))
                    .unwrap_or_else(|| "Bluetooth adapter".into()),
                driver_version: string_property(set, &data, &DEVPKEY_Device_DriverVersion),
            }
        });
        let _ = SetupDiDestroyDeviceInfoList(set);
        node
    }
}

fn wmi() -> windows::core::Result<IWbemServices> {
    unsafe {
        let locator: IWbemLocator = CoCreateInstance(&WbemLocator, None, CLSCTX_INPROC_SERVER)?;
        let services = locator.ConnectServer(
            &BSTR::from(r"ROOT\WMI"),
            &BSTR::new(),
            &BSTR::new(),
            &BSTR::new(),
            0,
            &BSTR::new(),
            None,
        )?;
        CoSetProxyBlanket(
            &services,
            10, // RPC_C_AUTHN_WINNT
            0,  // RPC_C_AUTHZ_NONE
            PCWSTR::null(),
            RPC_C_AUTHN_LEVEL_CALL,
            RPC_C_IMP_LEVEL_IMPERSONATE,
            None,
            EOAC_NONE,
        )?;
        Ok(services)
    }
}

/// The `MSPower_DeviceEnable` instance for the device node (its `InstanceName`
/// is the instance id plus `_0`, compared case-insensitively).
fn power_object(
    services: &IWbemServices,
    instance_id: &str,
) -> windows::core::Result<Option<IWbemClassObject>> {
    unsafe {
        let rows = services.ExecQuery(
            &BSTR::from("WQL"),
            &BSTR::from("SELECT * FROM MSPower_DeviceEnable"),
            WBEM_FLAG_FORWARD_ONLY | WBEM_FLAG_RETURN_IMMEDIATELY,
            None,
        )?;
        let want = instance_id.to_ascii_uppercase();
        loop {
            let mut row = [None];
            let mut returned = 0u32;
            let hr = rows.Next(WBEM_INFINITE, &mut row, &mut returned);
            if hr.is_err() || returned == 0 {
                return Ok(None);
            }
            let Some(object) = row[0].take() else {
                return Ok(None);
            };
            let mut name = VARIANT::default();
            object.Get(windows::core::w!("InstanceName"), 0, &mut name, None, None)?;
            let text = BSTR::try_from(&name)
                .map(|b| b.to_string())
                .unwrap_or_default();
            if text.to_ascii_uppercase().starts_with(&want) {
                return Ok(Some(object));
            }
        }
    }
}

fn variant_bool(v: &VARIANT) -> Option<bool> {
    unsafe {
        let inner = &v.Anonymous.Anonymous;
        (inner.vt == VT_BOOL).then(|| inner.Anonymous.boolVal.as_bool())
    }
}

/// "Allow the computer to turn off this device": `MSPower_DeviceEnable.Enable`.
pub fn power_saving_allowed(instance_id: &str) -> Result<Option<bool>, String> {
    let services = wmi().map_err(|e| format!("WMI: {e}"))?;
    let Some(object) =
        power_object(&services, instance_id).map_err(|e| format!("WMI query: {e}"))?
    else {
        return Ok(None);
    };
    let mut value = VARIANT::default();
    unsafe { object.Get(windows::core::w!("Enable"), 0, &mut value, None, None) }
        .map_err(|e| format!("WMI Enable: {e}"))?;
    Ok(variant_bool(&value))
}

/// Admin: writes `MSPower_DeviceEnable.Enable`.
pub fn set_power_saving_allowed(instance_id: &str, allowed: bool) -> Result<(), String> {
    let services = wmi().map_err(|e| format!("WMI: {e}"))?;
    let object = power_object(&services, instance_id)
        .map_err(|e| format!("WMI query: {e}"))?
        .ok_or("the adapter has no power management switch")?;
    let value = VARIANT::from(allowed);
    unsafe {
        object
            .Put(windows::core::w!("Enable"), 0, &value, 0)
            .map_err(|e| format!("WMI Put: {e}"))?;
        services
            .PutInstance(
                &object,
                WBEM_GENERIC_FLAG_TYPE(WBEM_FLAG_UPDATE_ONLY.0),
                None,
                None,
            )
            .map_err(|e| format!("WMI PutInstance: {e}"))
    }
}
