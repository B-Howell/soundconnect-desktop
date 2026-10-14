//! [`Snapshot`]: everything the engine currently knows, as one serializable value.
//!
//! This is the renderer contract (camelCase JSON). Every reader is optional: a
//! field is `null` when libmdr refused the read (feature unsupported, not yet
//! received, or not initialized).

use crate::enums::{Availability, WearingStatus};
use crate::protocol::Protocol;
use crate::types::*;
use serde::Serialize;
use std::collections::BTreeMap;

/// Device texts (`MDR_TEXT_*`, Headphones.h:104-122).
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Texts {
    /// `MDR_TEXT_MODEL_NAME`
    pub model_name: Option<String>,
    /// `MDR_TEXT_FIRMWARE_VERSION`
    pub firmware_version: Option<String>,
    /// `MDR_TEXT_UNIQUE_ID`
    pub unique_id: Option<String>,
    /// `MDR_TEXT_MODEL_SERIES`
    pub model_series: Option<String>,
    /// `MDR_TEXT_MODEL_COLOR`
    pub model_color: Option<String>,
    /// `MDR_TEXT_LAST_ALERT`
    pub last_alert: Option<String>,
    /// `MDR_TEXT_TRACK_TITLE`
    pub track_title: Option<String>,
    /// `MDR_TEXT_TRACK_ALBUM`
    pub track_album: Option<String>,
    /// `MDR_TEXT_TRACK_ARTIST`
    pub track_artist: Option<String>,
}

/// The full engine state at one instant.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub protocol: Protocol,
    pub initialized: bool,
    pub ready: bool,
    pub dirty: bool,
    pub model: Option<Model>,
    pub batteries: Option<Vec<Battery>>,
    pub playback: Option<Playback>,
    pub noise_control: Option<NoiseControl>,
    pub speak_to_chat: Option<SpeakToChat>,
    pub listening: Option<Listening>,
    pub equalizer: Option<Equalizer>,
    pub equalizer_presets: Option<Vec<EqualizerPreset>>,
    pub paired_devices: Option<Vec<PairedDevice>>,
    pub pairing: Option<Pairing>,
    pub source_switch_control: Option<bool>,
    pub general_settings: Option<Vec<GeneralSetting>>,
    pub assignable_controls: Option<Vec<AssignableControl>>,
    pub power: Option<Power>,
    pub voice_guidance: Option<VoiceGuidance>,
    pub connection_mode: Option<ConnectionMode>,
    pub safe_listening: Option<SafeListening>,
    pub wearing_status: Option<WearingStatus>,
    /// Keyed by `MDR_FEATURE_*` name without the prefix, e.g. `NOISE_CANCELLING`.
    pub features: BTreeMap<String, Availability>,
    pub texts: Texts,
}
