//! Registry reads (and the HKCU / HKLM writes): the MMDevices endpoint
//! database the Audio service keeps, readable by any user, plus the few
//! audio values that live in plain registry keys.

use std::io;

use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, KEY_SET_VALUE};
use winreg::RegKey;

use crate::model::{AudioFormat, EndpointState, Flow};

const MMDEVICES: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio";
/// `PKEY_Device_DeviceDesc` on the endpoint: "Headphones".
const PK_DESC: &str = "{a45c254e-df1c-4efd-8020-67d146a850e0},2";
/// `PKEY_DeviceInterface_FriendlyName`-like: the device's name, "WH-1000XM4".
const PK_DEVICE_NAME: &str = "{b3f8fa53-0004-438e-9003-51a46e139bfc},6";
/// The parent audio device's instance id, `{1}.BTHENUM\{0000110B-...}_...&AABBCC123456_...`.
const PK_INSTANCE: &str = "{b3f8fa53-0004-438e-9003-51a46e139bfc},2";
/// `PKEY_Device_ContainerId` (VT_CLSID; 8-byte header then the GUID).
const PK_CONTAINER: &str = "{8c7ed206-3f8a-4827-b3ab-ae9e1faefc6c},2";
/// `PKEY_AudioEngine_DeviceFormat` (VT_BLOB WAVEFORMATEX(TENSIBLE)).
const PK_DEVICE_FORMAT: &str = "{f19f064d-082c-4e27-bc73-6882a1bb8e4c},0";
/// `PKEY_AudioEndpoint_Disable_SysFx` in FxProperties (1 = effects off).
pub const PK_DISABLE_SYSFX: &str = "{1da5d803-d492-4edd-8c23-e0c0ffee7f0e},5";
/// Exclusive mode: allow (`,3`) and give priority (`,4`); absent = on.
const PK_EXCLUSIVE_ALLOW: &str = "{b3f8fa53-0004-438e-9003-51a46e139bfc},3";
const PK_EXCLUSIVE_PRIORITY: &str = "{b3f8fa53-0004-438e-9003-51a46e139bfc},4";

const HKCU_AUDIO: &str = r"Software\Microsoft\Multimedia\Audio";
const DUCKING: &str = "UserDuckingPreference";
const MONO: &str = "AccessibilityMonoMixState";
const AVRCP_CT: &str = r"SYSTEM\CurrentControlSet\Control\Bluetooth\Audio\AVRCP\CT";
const ABSOLUTE_VOLUME: &str = "DisableAbsoluteVolume";
const BTHPORT_DEVICES: &str = r"SYSTEM\CurrentControlSet\Services\BTHPORT\Parameters\Devices";

/// One endpoint as the MMDevices database records it.
#[derive(Debug, Clone)]
pub struct RegEndpoint {
    pub flow: Flow,
    pub id: String,
    pub name: String,
    pub state: EndpointState,
    pub instance_id: String,
    pub container: Option<[u8; 16]>,
}

impl RegEndpoint {
    pub fn bluetooth(&self) -> bool {
        self.instance_id.to_ascii_uppercase().contains("BTH")
    }

    /// A2DP sink (`{0000110B-...}`), the stereo endpoint.
    pub fn a2dp(&self) -> bool {
        self.instance_id
            .to_ascii_uppercase()
            .contains("{0000110B-0000-1000-8000-00805F9B34FB}")
    }
}

fn hklm() -> RegKey {
    RegKey::predef(HKEY_LOCAL_MACHINE)
}

fn hkcu() -> RegKey {
    RegKey::predef(HKEY_CURRENT_USER)
}

fn flow_dir(flow: Flow) -> &'static str {
    match flow {
        Flow::Render => "Render",
        Flow::Capture => "Capture",
    }
}

/// `{0.0.0.00000000}.{guid}` from a Render key name, `{0.0.1...}` from Capture.
fn endpoint_id(flow: Flow, key: &str) -> String {
    let prefix = match flow {
        Flow::Render => "{0.0.0.00000000}",
        Flow::Capture => "{0.0.1.00000000}",
    };
    format!("{prefix}.{}", key.to_ascii_lowercase())
}

/// The MMDevices key of an endpoint id: `(flow, "{guid}")`.
fn endpoint_key(id: &str) -> Option<(Flow, &str)> {
    let (prefix, guid) = id.split_once("}.")?;
    let flow = match prefix {
        "{0.0.0.00000000" => Flow::Render,
        "{0.0.1.00000000" => Flow::Capture,
        _ => return None,
    };
    Some((flow, guid))
}

fn open_endpoint(id: &str, sub: &str) -> io::Result<RegKey> {
    let (flow, guid) = endpoint_key(id).ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("not an endpoint id: {id}"),
        )
    })?;
    hklm().open_subkey_with_flags(
        format!(r"{MMDEVICES}\{}\{guid}\{sub}", flow_dir(flow)),
        KEY_READ,
    )
}

/// The bytes of a serialised PROPVARIANT value after its 8-byte header.
fn propvariant_payload(raw: &[u8]) -> Option<&[u8]> {
    raw.get(8..)
}

/// Every endpoint of both flows (all states).
pub fn endpoints() -> io::Result<Vec<RegEndpoint>> {
    let mut out = Vec::new();
    for flow in [Flow::Render, Flow::Capture] {
        let dir =
            hklm().open_subkey_with_flags(format!(r"{MMDEVICES}\{}", flow_dir(flow)), KEY_READ)?;
        for key in dir.enum_keys().filter_map(Result::ok) {
            let Ok(k) = dir.open_subkey_with_flags(&key, KEY_READ) else {
                continue;
            };
            let state = EndpointState::from_raw(k.get_value::<u32, _>("DeviceState").unwrap_or(0));
            let props = k.open_subkey_with_flags("Properties", KEY_READ).ok();
            let text = |name: &str| {
                props
                    .as_ref()
                    .and_then(|p| p.get_value::<String, _>(name).ok())
            };
            let desc = text(PK_DESC).unwrap_or_default();
            let device = text(PK_DEVICE_NAME).map(|s| s.trim().to_string());
            let name = match device {
                Some(d) if !d.is_empty() && !desc.is_empty() => format!("{desc} ({d})"),
                Some(d) if !d.is_empty() => d,
                _ => desc,
            };
            let container = props
                .as_ref()
                .and_then(|p| p.get_raw_value(PK_CONTAINER).ok())
                .and_then(|v| {
                    propvariant_payload(&v.bytes)
                        .and_then(|b| b.get(..16))
                        .map(|b| {
                            let mut g = [0u8; 16];
                            g.copy_from_slice(b);
                            g
                        })
                });
            out.push(RegEndpoint {
                flow,
                id: endpoint_id(flow, &key),
                name,
                state,
                instance_id: text(PK_INSTANCE).unwrap_or_default(),
                container,
            });
        }
    }
    Ok(out)
}

/// Parses a serialised `WAVEFORMATEX` / `WAVEFORMATEXTENSIBLE` (after the PROPVARIANT header).
pub fn parse_wave_format(blob: &[u8]) -> Option<AudioFormat> {
    let u16_at = |i: usize| blob.get(i..i + 2).map(|b| u16::from_le_bytes([b[0], b[1]]));
    let u32_at = |i: usize| {
        blob.get(i..i + 4)
            .map(|b| u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
    };
    Some(AudioFormat {
        channels: u16_at(2)?,
        sample_rate: u32_at(4)?,
        bits_per_sample: u16_at(14)?,
    })
}

/// The endpoint's shared-mode device format.
pub fn device_format(id: &str) -> io::Result<Option<AudioFormat>> {
    let raw = open_endpoint(id, "Properties")?.get_raw_value(PK_DEVICE_FORMAT)?;
    Ok(propvariant_payload(&raw.bytes).and_then(parse_wave_format))
}

/// Audio enhancements on (`Disable_SysFx` absent or 0).
pub fn enhancements_enabled(id: &str) -> io::Result<bool> {
    let fx = open_endpoint(id, "FxProperties")?;
    Ok(fx.get_value::<u32, _>(PK_DISABLE_SYSFX).unwrap_or(0) == 0)
}

/// (allow exclusive, give exclusive priority); absent values mean on.
pub fn exclusive_mode(id: &str) -> io::Result<(bool, bool)> {
    let props = open_endpoint(id, "Properties")?;
    let flag = |name: &str| -> bool {
        match props.get_raw_value(name) {
            // VT_BOOL serialised: header then a VARIANT_BOOL (0 = false, 0xFFFF = true).
            Ok(v) => propvariant_payload(&v.bytes)
                .and_then(|b| b.get(..2))
                .is_none_or(|b| b != [0, 0]),
            Err(_) => true,
        }
    };
    Ok((flag(PK_EXCLUSIVE_ALLOW), flag(PK_EXCLUSIVE_PRIORITY)))
}

/// Raw `UserDuckingPreference` (absent = None).
pub fn ducking_raw() -> Option<u32> {
    hkcu()
        .open_subkey_with_flags(HKCU_AUDIO, KEY_READ)
        .ok()?
        .get_value::<u32, _>(DUCKING)
        .ok()
}

pub fn set_ducking_raw(value: u32) -> io::Result<()> {
    let (key, _) = hkcu().create_subkey(HKCU_AUDIO)?;
    key.set_value(DUCKING, &value)
}

pub fn mono_audio() -> bool {
    hkcu()
        .open_subkey_with_flags(HKCU_AUDIO, KEY_READ)
        .and_then(|k| k.get_value::<u32, _>(MONO))
        .is_ok_and(|v| v == 1)
}

pub fn set_mono_audio(enabled: bool) -> io::Result<()> {
    let (key, _) = hkcu().create_subkey(HKCU_AUDIO)?;
    key.set_value(MONO, &u32::from(enabled))
}

pub fn absolute_volume_disabled() -> bool {
    hklm()
        .open_subkey_with_flags(AVRCP_CT, KEY_READ)
        .and_then(|k| k.get_value::<u32, _>(ABSOLUTE_VOLUME))
        .is_ok_and(|v| v == 1)
}

/// Admin (HKLM).
pub fn set_absolute_volume_disabled(disabled: bool) -> io::Result<()> {
    let key = hklm().open_subkey_with_flags(AVRCP_CT, KEY_SET_VALUE)?;
    key.set_value(ABSOLUTE_VOLUME, &u32::from(disabled))
}

/// The headphones advertise Hands-Free or Headset: their cached SDP records
/// (UTF-16 or ASCII text in the binary values) name "Hands-Free" or "Headset".
pub fn hands_free_offered(address_hex: &str) -> bool {
    let Ok(key) = hklm().open_subkey_with_flags(
        format!(
            r"{BTHPORT_DEVICES}\{}\DynamicCachedServices",
            address_hex.to_ascii_lowercase()
        ),
        KEY_READ,
    ) else {
        return false;
    };
    key.enum_values().filter_map(Result::ok).any(|(_, value)| {
        let ascii: String = value.bytes.iter().map(|&b| b as char).collect();
        let wide: String = value
            .bytes
            .as_chunks::<2>()
            .0
            .iter()
            .map(|c| char::from_u32(u32::from(u16::from_le_bytes([c[0], c[1]]))).unwrap_or('?'))
            .collect();
        [ascii, wide]
            .iter()
            .map(|s| s.to_ascii_lowercase())
            .any(|s| s.contains("hands-free") || s.contains("handsfree") || s.contains("headset"))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_the_recorded_xm4_device_format() {
        // `{f19f064d-...},0` of the XM4 endpoint as read on the maintainer's PC (header + WAVEFORMATEXTENSIBLE start).
        let raw = [
            65, 0, 0, 0, 1, 0, 0, 0, 254, 255, 2, 0, 128, 187, 0, 0, 0, 238, 2, 0, 4, 0, 16, 0, 22,
            0, 16, 0, 3, 0, 0, 0,
        ];
        let f = propvariant_payload(&raw)
            .and_then(parse_wave_format)
            .expect("format");
        assert_eq!(
            (f.sample_rate, f.bits_per_sample, f.channels),
            (48_000, 16, 2)
        );
    }

    #[test]
    fn endpoint_ids_map_to_their_registry_keys() {
        let id = endpoint_id(Flow::Capture, "{3AADA0B7-295D-4C15-8D48-B0A698FEC3D1}");
        assert_eq!(
            id,
            "{0.0.1.00000000}.{3aada0b7-295d-4c15-8d48-b0a698fec3d1}"
        );
        assert_eq!(
            endpoint_key(&id),
            Some((Flow::Capture, "{3aada0b7-295d-4c15-8d48-b0a698fec3d1}"))
        );
        assert_eq!(endpoint_key("{0.0.9.0}.{x}"), None);
    }
}
