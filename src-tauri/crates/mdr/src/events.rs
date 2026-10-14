//! [`Event`]: one `MDR_EVENT_*` reported by `mdrHeadphonesPoll` (Headphones.h:67-98).

use mdr_sys::*;
use serde::Serialize;

/// A semantic event from the engine. Serializes as `{"type": "batteryChanged"}`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize)]
#[serde(tag = "type", content = "code", rename_all = "camelCase")]
pub enum Event {
    /// `MDR_EVENT_NONE`: nothing happened.
    None,
    /// `MDR_EVENT_IDENTITY_CHANGED`
    IdentityChanged,
    /// `MDR_EVENT_BATTERY_CHANGED`
    BatteryChanged,
    /// `MDR_EVENT_PLAYBACK_CHANGED`
    PlaybackChanged,
    /// `MDR_EVENT_NOISE_CONTROL_CHANGED`
    NoiseControlChanged,
    /// `MDR_EVENT_SPEAK_TO_CHAT_CHANGED`
    SpeakToChatChanged,
    /// `MDR_EVENT_LISTENING_MODE_CHANGED`
    ListeningModeChanged,
    /// `MDR_EVENT_EQUALIZER_CHANGED`
    EqualizerChanged,
    /// `MDR_EVENT_PAIRED_DEVICES_CHANGED`
    PairedDevicesChanged,
    /// `MDR_EVENT_PAIRING_CHANGED`
    PairingChanged,
    /// `MDR_EVENT_GENERAL_SETTINGS_CHANGED`
    GeneralSettingsChanged,
    /// `MDR_EVENT_ASSIGNABLE_CONTROLS_CHANGED`
    AssignableControlsChanged,
    /// `MDR_EVENT_POWER_CHANGED`
    PowerChanged,
    /// `MDR_EVENT_VOICE_GUIDANCE_CHANGED`
    VoiceGuidanceChanged,
    /// `MDR_EVENT_CONNECTION_MODE_CHANGED`
    ConnectionModeChanged,
    /// `MDR_EVENT_SAFE_LISTENING_CHANGED`
    SafeListeningChanged,
    /// `MDR_EVENT_INITIALIZE_COMPLETE`: call `request_sync` next (client/Client.cpp).
    InitializeComplete,
    /// `MDR_EVENT_SYNC_COMPLETE`: refresh everything.
    SyncComplete,
    /// `MDR_EVENT_APPLY_COMPLETE`: a commit finished.
    ApplyComplete,
    /// `MDR_EVENT_ALERT`: read `MDR_TEXT_LAST_ALERT`, answer with `respond_to_alert`.
    Alert,
    /// `MDR_EVENT_INTERACTION`
    Interaction,
    /// `MDR_EVENT_DEVICE_MESSAGE`
    DeviceMessage,
    /// `MDR_EVENT_NEED_SYNC`: call `request_sync` once `is_ready`.
    NeedSync,
    /// `MDR_EVENT_WEARING_STATUS_CHANGED`
    WearingStatusChanged,
    /// `MDR_EVENT_UNHANDLED` (23: libmdr received a command it does not handle) or a
    /// value this build does not know. Carries the raw code; nothing to act on.
    Unhandled(u32),
}

impl Event {
    /// Maps a raw `MDREvent`.
    pub fn from_raw(raw: MDREvent) -> Self {
        match raw {
            MDR_EVENT_NONE => Event::None,
            MDR_EVENT_IDENTITY_CHANGED => Event::IdentityChanged,
            MDR_EVENT_BATTERY_CHANGED => Event::BatteryChanged,
            MDR_EVENT_PLAYBACK_CHANGED => Event::PlaybackChanged,
            MDR_EVENT_NOISE_CONTROL_CHANGED => Event::NoiseControlChanged,
            MDR_EVENT_SPEAK_TO_CHAT_CHANGED => Event::SpeakToChatChanged,
            MDR_EVENT_LISTENING_MODE_CHANGED => Event::ListeningModeChanged,
            MDR_EVENT_EQUALIZER_CHANGED => Event::EqualizerChanged,
            MDR_EVENT_PAIRED_DEVICES_CHANGED => Event::PairedDevicesChanged,
            MDR_EVENT_PAIRING_CHANGED => Event::PairingChanged,
            MDR_EVENT_GENERAL_SETTINGS_CHANGED => Event::GeneralSettingsChanged,
            MDR_EVENT_ASSIGNABLE_CONTROLS_CHANGED => Event::AssignableControlsChanged,
            MDR_EVENT_POWER_CHANGED => Event::PowerChanged,
            MDR_EVENT_VOICE_GUIDANCE_CHANGED => Event::VoiceGuidanceChanged,
            MDR_EVENT_CONNECTION_MODE_CHANGED => Event::ConnectionModeChanged,
            MDR_EVENT_SAFE_LISTENING_CHANGED => Event::SafeListeningChanged,
            MDR_EVENT_INITIALIZE_COMPLETE => Event::InitializeComplete,
            MDR_EVENT_SYNC_COMPLETE => Event::SyncComplete,
            MDR_EVENT_APPLY_COMPLETE => Event::ApplyComplete,
            MDR_EVENT_ALERT => Event::Alert,
            MDR_EVENT_INTERACTION => Event::Interaction,
            MDR_EVENT_DEVICE_MESSAGE => Event::DeviceMessage,
            MDR_EVENT_NEED_SYNC => Event::NeedSync,
            MDR_EVENT_WEARING_STATUS_CHANGED => Event::WearingStatusChanged,
            other => Event::Unhandled(other),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_header_event_maps_to_a_named_variant() {
        for raw in 0..=MDR_EVENT_WEARING_STATUS_CHANGED {
            let e = Event::from_raw(raw);
            if raw == MDR_EVENT_UNHANDLED {
                assert_eq!(e, Event::Unhandled(MDR_EVENT_UNHANDLED));
            } else {
                assert!(!matches!(e, Event::Unhandled(_)), "{raw} unmapped");
            }
        }
        assert_eq!(Event::from_raw(999), Event::Unhandled(999));
        assert_eq!(
            serde_json::to_string(&Event::BatteryChanged).unwrap(),
            r#"{"type":"batteryChanged"}"#
        );
    }
}
