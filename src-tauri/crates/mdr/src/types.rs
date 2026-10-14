//! Owned Rust mirrors of the `Headphones.h` structs (lines 313-454).
//!
//! Each type converts from its C struct (`From<MDR*>`) and, where libmdr has a
//! setter, back to it (`to_raw`). `MDRBoolean` becomes `bool`; enums become the
//! types in [`crate::enums`]. Serde field names are camelCase (renderer contract).

use crate::enums::*;
use mdr_sys::*;
use serde::{Deserialize, Serialize};
use std::ffi::{c_char, CStr};

fn b(v: MDRBoolean) -> bool {
    v != MDR_FALSE
}

fn mb(v: bool) -> MDRBoolean {
    if v {
        MDR_TRUE
    } else {
        MDR_FALSE
    }
}

/// Reads a fixed `char[N]` field up to its first NUL (or the whole array).
pub(crate) fn fixed_str(chars: &[c_char]) -> String {
    let bytes: Vec<u8> = chars
        .iter()
        .take_while(|&&c| c != 0)
        .map(|&c| c as u8)
        .collect();
    String::from_utf8_lossy(&bytes).into_owned()
}

/// `MDRModel` (Headphones.h:313).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Model {
    pub protocol_version: u32,
    pub audio_codec: AudioCodec,
    pub model_color: u8,
}

impl From<MDRModel> for Model {
    fn from(r: MDRModel) -> Self {
        Self {
            protocol_version: r.protocol_version,
            audio_codec: AudioCodec::from_raw(r.audio_codec),
            model_color: r.model_color,
        }
    }
}

/// `MDRBattery` (Headphones.h:320).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Battery {
    pub part: BatteryPart,
    pub present: bool,
    pub level_percent: u8,
    pub update_threshold_percent: u8,
    pub charging: ChargingState,
}

impl From<MDRBattery> for Battery {
    fn from(r: MDRBattery) -> Self {
        Self {
            part: BatteryPart::from_raw(r.part),
            present: b(r.present),
            level_percent: r.level_percent,
            update_threshold_percent: r.update_threshold_percent,
            charging: ChargingState::from_raw(r.charging),
        }
    }
}

/// `MDRPlayback` (Headphones.h:329) plus the track texts.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Playback {
    pub status: PlaybackStatus,
    pub volume: u8,
}

impl From<MDRPlayback> for Playback {
    fn from(r: MDRPlayback) -> Self {
        Self {
            status: PlaybackStatus::from_raw(r.status),
            volume: r.volume,
        }
    }
}

impl Playback {
    pub(crate) fn to_raw(&self) -> MDRPlayback {
        MDRPlayback {
            status: self.status.raw(),
            volume: self.volume,
        }
    }
}

/// `MDRNoiseControl` (Headphones.h:340).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoiseControl {
    pub mode: NoiseMode,
    pub ambient_level: u8,
    pub changing_asm_level: bool,
    pub focus_on_voice: bool,
    pub button_mode: NoiseButtonMode,
    pub adaptive_ambient: bool,
    pub adaptive_sensitivity: AdaptiveSensitivity,
}

impl From<MDRNoiseControl> for NoiseControl {
    fn from(r: MDRNoiseControl) -> Self {
        Self {
            mode: NoiseMode::from_raw(r.mode),
            ambient_level: r.ambient_level,
            changing_asm_level: b(r.changing_asm_level),
            focus_on_voice: b(r.focus_on_voice),
            button_mode: NoiseButtonMode::from_raw(r.button_mode),
            adaptive_ambient: b(r.adaptive_ambient),
            adaptive_sensitivity: AdaptiveSensitivity::from_raw(r.adaptive_sensitivity),
        }
    }
}

impl NoiseControl {
    pub(crate) fn to_raw(self) -> MDRNoiseControl {
        MDRNoiseControl {
            mode: self.mode.raw(),
            ambient_level: self.ambient_level,
            changing_asm_level: mb(self.changing_asm_level),
            focus_on_voice: mb(self.focus_on_voice),
            button_mode: self.button_mode.raw(),
            adaptive_ambient: mb(self.adaptive_ambient),
            adaptive_sensitivity: self.adaptive_sensitivity.raw(),
        }
    }
}

/// `MDRSpeakToChat` (Headphones.h:351).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeakToChat {
    pub enabled: bool,
    pub sensitivity: SpeechSensitivity,
    pub timeout: SpeakTimeout,
}

impl From<MDRSpeakToChat> for SpeakToChat {
    fn from(r: MDRSpeakToChat) -> Self {
        Self {
            enabled: b(r.enabled),
            sensitivity: SpeechSensitivity::from_raw(r.sensitivity),
            timeout: SpeakTimeout::from_raw(r.timeout),
        }
    }
}

impl SpeakToChat {
    pub(crate) fn to_raw(self) -> MDRSpeakToChat {
        MDRSpeakToChat {
            enabled: mb(self.enabled),
            sensitivity: self.sensitivity.raw(),
            timeout: self.timeout.raw(),
        }
    }
}

/// `MDRListening` (Headphones.h:358).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Listening {
    pub mode: ListeningMode,
    pub background_room: RoomSize,
}

impl From<MDRListening> for Listening {
    fn from(r: MDRListening) -> Self {
        Self {
            mode: ListeningMode::from_raw(r.mode),
            background_room: RoomSize::from_raw(r.background_room),
        }
    }
}

impl Listening {
    pub(crate) fn to_raw(self) -> MDRListening {
        MDRListening {
            mode: self.mode.raw(),
            background_room: self.background_room.raw(),
        }
    }
}

/// `MDREqualizer` (Headphones.h:364) plus its bands (`mdrHeadphonesGetEqualizerBands`).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Equalizer {
    pub preset: EqualizerPresetId,
    pub clear_bass: i8,
    pub band_count: u32,
    pub dsee_enabled: bool,
    pub dsee_type: DseeType,
    pub available: bool,
    pub dsee_available: bool,
    pub bands: Vec<i8>,
}

impl Equalizer {
    pub(crate) fn from_raw(r: MDREqualizer, bands: Vec<i8>) -> Self {
        Self {
            preset: EqualizerPresetId::from_raw(r.preset),
            clear_bass: r.clear_bass,
            band_count: r.band_count,
            dsee_enabled: b(r.dsee_enabled),
            dsee_type: DseeType::from_raw(r.dsee_type),
            available: b(r.available),
            dsee_available: b(r.dsee_available),
            bands,
        }
    }

    /// The C struct; `bands` is set separately with `set_equalizer_bands`.
    pub(crate) fn to_raw(&self) -> MDREqualizer {
        MDREqualizer {
            preset: self.preset.raw(),
            clear_bass: self.clear_bass,
            band_count: self.band_count,
            dsee_enabled: mb(self.dsee_enabled),
            dsee_type: self.dsee_type.raw(),
            available: mb(self.available),
            dsee_available: mb(self.dsee_available),
        }
    }
}

/// One advertised preset (`mdrHeadphonesGetEqualizerPresets` + `MDR_TEXT_EQUALIZER_PRESET_NAME`).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EqualizerPreset {
    pub id: EqualizerPresetId,
    pub name: String,
}

/// `MDRPairedDevice` (Headphones.h:375).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairedDevice {
    pub connected: bool,
    pub playback_device: bool,
    pub mac_address: String,
    pub name: String,
}

impl From<MDRPairedDevice> for PairedDevice {
    fn from(r: MDRPairedDevice) -> Self {
        Self {
            connected: b(r.connected),
            playback_device: b(r.playback_device),
            mac_address: fixed_str(&r.macAddress),
            name: fixed_str(&r.name),
        }
    }
}

/// `MDRPairing` (Headphones.h:390).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pairing {
    pub enabled: bool,
}

/// `MDRGeneralSettingInfo` (Headphones.h:395).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneralSettingInfo {
    pub index: u32,
    pub kind: GeneralSettingType,
    pub writable: bool,
}

impl From<MDRGeneralSettingInfo> for GeneralSettingInfo {
    fn from(r: MDRGeneralSettingInfo) -> Self {
        Self {
            index: r.index,
            kind: GeneralSettingType::from_raw(r.r#type),
            writable: b(r.writable),
        }
    }
}

/// A general setting: its info, `MDRGeneralSetting.boolean_value` (Headphones.h:402)
/// and the `MDR_TEXT_GENERAL_SETTING_SUBJECT` / `_SUMMARY` texts at its index.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneralSetting {
    pub index: u32,
    pub info: GeneralSettingInfo,
    pub value: bool,
    pub subject: String,
    pub summary: String,
}

/// `MDRAssignableControl` (Headphones.h:423) plus the actions offered for its key.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssignableControl {
    pub location: KeyLocation,
    pub kind: KeyType,
    pub action: AssignableAction,
    /// `mdrHeadphonesGetAssignableControlActions(location)`; empty when not reported.
    #[serde(default)]
    pub options: Vec<AssignableAction>,
}

impl From<MDRAssignableControl> for AssignableControl {
    fn from(r: MDRAssignableControl) -> Self {
        Self {
            location: KeyLocation::from_raw(r.location),
            kind: KeyType::from_raw(r.r#type),
            action: AssignableAction::from_raw(r.action),
            options: Vec::new(),
        }
    }
}

impl AssignableControl {
    pub(crate) fn to_raw(&self) -> MDRAssignableControl {
        MDRAssignableControl {
            location: self.location.raw(),
            r#type: self.kind.raw(),
            action: self.action.raw(),
        }
    }
}

/// `MDRPower` (Headphones.h:430).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Power {
    pub auto_power_off_minutes: u32,
    pub wearing_power: WearingPowerMode,
    pub auto_pause: bool,
    pub head_gesture: bool,
    pub shutdown_requested: bool,
}

impl From<MDRPower> for Power {
    fn from(r: MDRPower) -> Self {
        Self {
            auto_power_off_minutes: r.auto_power_off_minutes,
            wearing_power: WearingPowerMode::from_raw(r.wearing_power),
            auto_pause: b(r.auto_pause),
            head_gesture: b(r.head_gesture),
            shutdown_requested: b(r.shutdown_requested),
        }
    }
}

impl Power {
    pub(crate) fn to_raw(self) -> MDRPower {
        MDRPower {
            auto_power_off_minutes: self.auto_power_off_minutes,
            wearing_power: self.wearing_power.raw(),
            auto_pause: mb(self.auto_pause),
            head_gesture: mb(self.head_gesture),
            shutdown_requested: mb(self.shutdown_requested),
        }
    }
}

/// `MDRVoiceGuidance` (Headphones.h:439).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceGuidance {
    pub enabled: bool,
    pub volume: i8,
}

impl From<MDRVoiceGuidance> for VoiceGuidance {
    fn from(r: MDRVoiceGuidance) -> Self {
        Self {
            enabled: b(r.enabled),
            volume: r.volume,
        }
    }
}

impl VoiceGuidance {
    pub(crate) fn to_raw(self) -> MDRVoiceGuidance {
        MDRVoiceGuidance {
            enabled: mb(self.enabled),
            volume: self.volume,
        }
    }
}

/// `MDRConnectionMode` (Headphones.h:445).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionMode {
    pub audio_priority: AudioPriority,
}

/// `MDRSafeListening` (Headphones.h:450).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SafeListening {
    pub sound_pressure: u8,
    pub preview: bool,
}

impl From<MDRSafeListening> for SafeListening {
    fn from(r: MDRSafeListening) -> Self {
        Self {
            sound_pressure: r.sound_pressure,
            preview: b(r.preview),
        }
    }
}

impl SafeListening {
    pub(crate) fn to_raw(self) -> MDRSafeListening {
        MDRSafeListening {
            sound_pressure: self.sound_pressure,
            preview: mb(self.preview),
        }
    }
}

pub(crate) fn bool_raw(v: bool) -> MDRBoolean {
    mb(v)
}

pub(crate) fn raw_bool(v: MDRBoolean) -> bool {
    b(v)
}

/// Reads a NUL-terminated buffer filled by `mdrHeadphonesGetText`.
pub(crate) fn text_from_buf(buf: &[u8]) -> String {
    let s = CStr::from_bytes_until_nul(buf)
        .map(|c| c.to_bytes())
        .unwrap_or(buf);
    String::from_utf8_lossy(s).into_owned()
}
