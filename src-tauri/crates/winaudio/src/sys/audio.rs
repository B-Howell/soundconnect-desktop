//! Core Audio COM: default endpoints, volume, spatial sound (documented), and
//! the undocumented `IPolicyConfig` that `mmsys.cpl` uses for every write.
//!
//! `IPolicyConfig` is not in the `windows` crate. Its IID, CLSID and vtable
//! order below were checked against two independent public definitions
//! (AudioDeviceCmdlets 3.1.0.2's `CoreAudioApi.Interfaces.IPolicyConfig`, read
//! by reflection from the installed DLL, and the `IPolicyConfig.h` community
//! header in tartakynov/audioswitch); EarTrumpet's `IPolicyConfigWin7` agrees on
//! the IID and on slots 9-12. Every write is read back, so a changed vtable on
//! a future build shows up as `verified: false`, not as silent damage.

use std::ffi::c_void;

use windows::core::{GUID, HRESULT, HSTRING, PCWSTR};
use windows::Win32::Foundation::{PROPERTYKEY, RPC_E_CHANGED_MODE};
use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
use windows::Win32::Media::Audio::{
    eCapture, eCommunications, eConsole, eMultimedia, eRender, ERole, IMMDeviceEnumerator,
    ISpatialAudioClient, MMDeviceEnumerator, WAVEFORMATEX,
};
use windows::Win32::System::Com::StructuredStorage::PROPVARIANT;
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize, CLSCTX_ALL,
    COINIT_MULTITHREADED,
};
use windows::Win32::System::Variant::{VT_BOOL, VT_UI4};
use windows_core::BOOL;

use crate::model::Flow;

/// `CPolicyConfigClient`.
const CLSID_POLICY_CONFIG: GUID = GUID::from_u128(0x870af99c_171d_4f9e_af0d_e63df40c2bc9);

/// The local declaration; method names follow the C++ header.
#[allow(non_snake_case)]
mod ffi {
    use std::ffi::c_void;

    use windows::core::{HRESULT, PCWSTR};
    use windows::Win32::Foundation::PROPERTYKEY;
    use windows::Win32::Media::Audio::{ERole, WAVEFORMATEX};
    use windows::Win32::System::Com::StructuredStorage::PROPVARIANT;
    use windows_core::{IUnknown, IUnknown_Vtbl, BOOL};

    #[windows_core::interface("f8679f50-850a-41cf-9c72-430f290290c8")]
    pub unsafe trait IPolicyConfig: IUnknown {
        pub unsafe fn GetMixFormat(
            &self,
            device: PCWSTR,
            format: *mut *mut WAVEFORMATEX,
        ) -> HRESULT;
        pub unsafe fn GetDeviceFormat(
            &self,
            device: PCWSTR,
            default: BOOL,
            format: *mut *mut WAVEFORMATEX,
        ) -> HRESULT;
        pub unsafe fn ResetDeviceFormat(&self, device: PCWSTR) -> HRESULT;
        pub unsafe fn SetDeviceFormat(
            &self,
            device: PCWSTR,
            endpoint_format: *const WAVEFORMATEX,
            mix_format: *const WAVEFORMATEX,
        ) -> HRESULT;
        pub unsafe fn GetProcessingPeriod(
            &self,
            device: PCWSTR,
            default: BOOL,
            default_period: *mut i64,
            min_period: *mut i64,
        ) -> HRESULT;
        pub unsafe fn SetProcessingPeriod(&self, device: PCWSTR, period: *const i64) -> HRESULT;
        pub unsafe fn GetShareMode(&self, device: PCWSTR, mode: *mut c_void) -> HRESULT;
        pub unsafe fn SetShareMode(&self, device: PCWSTR, mode: *const c_void) -> HRESULT;
        pub unsafe fn GetPropertyValue(
            &self,
            device: PCWSTR,
            fx_store: BOOL,
            key: *const PROPERTYKEY,
            value: *mut PROPVARIANT,
        ) -> HRESULT;
        pub unsafe fn SetPropertyValue(
            &self,
            device: PCWSTR,
            fx_store: BOOL,
            key: *const PROPERTYKEY,
            value: *const PROPVARIANT,
        ) -> HRESULT;
        pub unsafe fn SetDefaultEndpoint(&self, device: PCWSTR, role: ERole) -> HRESULT;
        pub unsafe fn SetEndpointVisibility(&self, device: PCWSTR, visible: BOOL) -> HRESULT;
    }
}
use ffi::IPolicyConfig;

/// `PKEY_AudioEndpoint_Disable_SysFx` (FX store).
const PKEY_DISABLE_SYSFX: PROPERTYKEY = PROPERTYKEY {
    fmtid: GUID::from_u128(0x1da5d803_d492_4edd_8c23_e0c0ffee7f0e),
    pid: 5,
};
/// Exclusive mode: allow (pid 3) and priority (pid 4), endpoint store.
const EXCLUSIVE_FMTID: GUID = GUID::from_u128(0xb3f8fa53_0004_438e_9003_51a46e139bfc);

/// COM for the calling thread for as long as the guard lives. A thread that
/// already has another apartment (`RPC_E_CHANGED_MODE`) is used as it is.
pub struct Com {
    owned: bool,
}

impl Com {
    pub fn init() -> Self {
        let hr = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
        Self {
            owned: hr.is_ok() && hr != RPC_E_CHANGED_MODE,
        }
    }
}

impl Drop for Com {
    fn drop(&mut self) {
        if self.owned {
            unsafe { CoUninitialize() };
        }
    }
}

fn enumerator() -> windows::core::Result<IMMDeviceEnumerator> {
    unsafe { CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) }
}

fn policy() -> windows::core::Result<IPolicyConfig> {
    unsafe { CoCreateInstance(&CLSID_POLICY_CONFIG, None, CLSCTX_ALL) }
}

fn roles(communications: bool) -> &'static [ERole] {
    if communications {
        &[eCommunications]
    } else {
        &[eConsole, eMultimedia]
    }
}

/// The default endpoint id for the flow and role group (console for "default").
pub fn default_endpoint(flow: Flow, communications: bool) -> windows::core::Result<Option<String>> {
    let data_flow = match flow {
        Flow::Render => eRender,
        Flow::Capture => eCapture,
    };
    let device =
        match unsafe { enumerator()?.GetDefaultAudioEndpoint(data_flow, roles(communications)[0]) }
        {
            Ok(d) => d,
            // E_NOTFOUND: no endpoint of that flow at all.
            Err(e) if e.code() == HRESULT(0x8007_0490_u32 as i32) => return Ok(None),
            Err(e) => return Err(e),
        };
    unsafe {
        let raw = device.GetId()?;
        let id = raw.to_string().unwrap_or_default();
        CoTaskMemFree(Some(raw.0 as *const c_void));
        Ok(Some(id))
    }
}

/// Sets the default for every role of the group (console + multimedia, or communications).
pub fn set_default_endpoint(id: &str, communications: bool) -> windows::core::Result<()> {
    let policy = policy()?;
    let id = HSTRING::from(id);
    for role in roles(communications) {
        unsafe { policy.SetDefaultEndpoint(PCWSTR(id.as_ptr()), *role).ok()? };
    }
    Ok(())
}

fn set_property(
    id: &str,
    fx: bool,
    key: &PROPERTYKEY,
    value: &PROPVARIANT,
) -> windows::core::Result<()> {
    let id = HSTRING::from(id);
    unsafe {
        policy()?
            .SetPropertyValue(PCWSTR(id.as_ptr()), BOOL::from(fx), key, value)
            .ok()
    }
}

fn propvariant_u32(value: u32) -> PROPVARIANT {
    let mut pv = PROPVARIANT::default();
    unsafe {
        let inner = &mut *pv.Anonymous.Anonymous;
        inner.vt = VT_UI4;
        inner.Anonymous.ulVal = value;
    }
    pv
}

fn propvariant_bool(value: bool) -> PROPVARIANT {
    let mut pv = PROPVARIANT::default();
    unsafe {
        let inner = &mut *pv.Anonymous.Anonymous;
        inner.vt = VT_BOOL;
        inner.Anonymous.boolVal =
            windows::Win32::Foundation::VARIANT_BOOL(if value { -1 } else { 0 });
    }
    pv
}

/// Audio enhancements on or off (writes `Disable_SysFx` in the FX store).
pub fn set_enhancements(id: &str, enabled: bool) -> windows::core::Result<()> {
    set_property(
        id,
        true,
        &PKEY_DISABLE_SYSFX,
        &propvariant_u32(u32::from(!enabled)),
    )
}

/// Exclusive mode allow / priority (endpoint store, VT_BOOL).
pub fn set_exclusive_mode(id: &str, allowed: bool, priority: bool) -> windows::core::Result<()> {
    for (pid, value) in [(3, allowed), (4, priority)] {
        let key = PROPERTYKEY {
            fmtid: EXCLUSIVE_FMTID,
            pid,
        };
        set_property(id, false, &key, &propvariant_bool(value))?;
    }
    Ok(())
}

/// The shared-mode format: the endpoint's current format with a new rate and
/// bit depth (channel layout and sub-format kept), as both device and mix format.
pub fn set_device_format(id: &str, sample_rate: u32, bits: u16) -> windows::core::Result<()> {
    let policy = policy()?;
    let wid = HSTRING::from(id);
    unsafe {
        let mut current: *mut WAVEFORMATEX = std::ptr::null_mut();
        policy
            .GetDeviceFormat(PCWSTR(wid.as_ptr()), BOOL::from(false), &mut current)
            .ok()?;
        if current.is_null() {
            return Err(windows::core::Error::from_hresult(
                windows::Win32::Foundation::E_POINTER,
            ));
        }
        // Copy header + extension (cbSize bytes) so WAVEFORMATEXTENSIBLE survives.
        let len = std::mem::size_of::<WAVEFORMATEX>() + usize::from((*current).cbSize);
        let mut buf = vec![0u8; len];
        std::ptr::copy_nonoverlapping(current.cast::<u8>(), buf.as_mut_ptr(), len);
        CoTaskMemFree(Some(current as *const c_void));
        let fmt = buf.as_mut_ptr().cast::<WAVEFORMATEX>();
        let channels = (*fmt).nChannels;
        let block_align = channels * (bits / 8);
        (*fmt).nSamplesPerSec = sample_rate;
        (*fmt).wBitsPerSample = bits;
        (*fmt).nBlockAlign = block_align;
        (*fmt).nAvgBytesPerSec = sample_rate * u32::from(block_align);
        if (*fmt).cbSize >= 22 {
            // WAVEFORMATEXTENSIBLE.Samples.wValidBitsPerSample follows the header.
            let valid = buf
                .as_mut_ptr()
                .add(std::mem::size_of::<WAVEFORMATEX>())
                .cast::<u16>();
            valid.write_unaligned(bits);
        }
        policy.SetDeviceFormat(PCWSTR(wid.as_ptr()), fmt, fmt).ok()
    }
}

/// Windows' master volume on the endpoint, 0-100.
pub fn volume_percent(id: &str) -> windows::core::Result<u8> {
    let wid = HSTRING::from(id);
    unsafe {
        let device = enumerator()?.GetDevice(PCWSTR(wid.as_ptr()))?;
        let volume: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None)?;
        let level = volume.GetMasterVolumeLevelScalar()?;
        Ok((level * 100.0).round().clamp(0.0, 100.0) as u8)
    }
}

/// Best effort: a spatial format is active when the endpoint offers dynamic
/// audio objects (`ISpatialAudioClient::GetMaxDynamicObjectCount` > 0).
pub fn spatial_sound(id: &str) -> &'static str {
    let wid = HSTRING::from(id);
    let count = unsafe {
        enumerator()
            .and_then(|e| e.GetDevice(PCWSTR(wid.as_ptr())))
            .and_then(|d| d.Activate::<ISpatialAudioClient>(CLSCTX_ALL, None))
            .and_then(|c| c.GetMaxDynamicObjectCount())
    };
    match count {
        Ok(0) => "off",
        Ok(_) => "on",
        Err(_) => "unknown",
    }
}
