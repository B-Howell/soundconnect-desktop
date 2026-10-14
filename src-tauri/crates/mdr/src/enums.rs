//! Rust enums for the `typedef uint32_t` + `#define` value sets in `Headphones.h`.
//!
//! Generated from the header (one `c_enum!` per typedef, variants in header order,
//! variant = constant name without its prefix, in PascalCase). Every enum keeps an
//! `Unrecognized(u32)` arm so a newer engine can report values this build does not know.
//!
//! Serde: known variants serialize as camelCase strings (`"noiseCancelling"`),
//! `Unrecognized(n)` as the number `n`; deserialization accepts either form.

use mdr_sys::*;
use serde::de::{self, Deserializer};
use serde::ser::Serializer;
use serde::{Deserialize, Serialize};

/// `NoiseCancelling` -> `noiseCancelling`.
fn camel(variant: &str) -> String {
    let mut c = variant.chars();
    match c.next() {
        Some(f) => f.to_ascii_lowercase().to_string() + c.as_str(),
        None => String::new(),
    }
}

#[derive(Deserialize)]
#[serde(untagged)]
enum StrOrNum {
    Str(String),
    Num(u32),
}

macro_rules! c_enum {
    ($(#[$m:meta])* $name:ident : $cty:ident { $($(#[$vm:meta])* $v:ident = $c:ident,)* }) => {
        $(#[$m])*
        #[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
        pub enum $name {
            $(#[doc = concat!("`", stringify!($c), "`")] $v,)*
            /// A value this build does not know.
            Unrecognized(u32),
        }

        impl $name {
            /// Every known variant, in header order.
            pub const ALL: &'static [$name] = &[$($name::$v),*];

            /// Converts a raw C value.
            pub fn from_raw(raw: $cty) -> Self {
                match raw {
                    $(x if x == $c => $name::$v,)*
                    other => $name::Unrecognized(other),
                }
            }

            /// The raw C value.
            pub fn raw(self) -> $cty {
                match self {
                    $($name::$v => $c,)*
                    $name::Unrecognized(v) => v,
                }
            }

            /// The C constant name, e.g. `MDR_FEATURE_NOISE_CANCELLING` (None for `Unrecognized`).
            pub fn c_name(self) -> Option<&'static str> {
                match self {
                    $($name::$v => Some(stringify!($c)),)*
                    $name::Unrecognized(_) => None,
                }
            }

            /// The Rust variant name, e.g. `NoiseCancelling` (None for `Unrecognized`).
            pub fn variant_name(self) -> Option<&'static str> {
                match self {
                    $($name::$v => Some(stringify!($v)),)*
                    $name::Unrecognized(_) => None,
                }
            }
        }

        impl Serialize for $name {
            fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
                match self.variant_name() {
                    Some(v) => s.serialize_str(&camel(v)),
                    None => s.serialize_u32(self.raw()),
                }
            }
        }

        impl<'de> Deserialize<'de> for $name {
            fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
                match StrOrNum::deserialize(d)? {
                    StrOrNum::Num(n) => Ok($name::from_raw(n)),
                    StrOrNum::Str(s) => $name::ALL
                        .iter()
                        .copied()
                        .find(|v| v.variant_name().map(camel).as_deref() == Some(s.as_str()))
                        .ok_or_else(|| de::Error::custom(format!(concat!("unknown ", stringify!($name), " {:?}"), s))),
                }
            }
        }
    };
}

c_enum! {
    /// `MDRFeatureAvailability` (Headphones.h:20).
    Availability: MDRFeatureAvailability {
        Unknown = MDR_AVAILABILITY_UNKNOWN,
        Unavailable = MDR_AVAILABILITY_UNAVAILABLE,
        Available = MDR_AVAILABILITY_AVAILABLE,
    }
}

c_enum! {
    /// `MDRTimeoutType` (Headphones.h:25).
    TimeoutType: MDRTimeoutType {
        Default = MDR_TIMEOUT_DEFAULT,
        Ack = MDR_TIMEOUT_ACK,
        AckRetries = MDR_TIMEOUT_ACK_RETRIES,
    }
}

c_enum! {
    /// `MDRFeature` (Headphones.h:30).
    Feature: MDRFeature {
        Identity = MDR_FEATURE_IDENTITY,
        BatterySingle = MDR_FEATURE_BATTERY_SINGLE,
        BatteryLeftRight = MDR_FEATURE_BATTERY_LEFT_RIGHT,
        BatteryCase = MDR_FEATURE_BATTERY_CASE,
        PlaybackMetadata = MDR_FEATURE_PLAYBACK_METADATA,
        PlaybackControl = MDR_FEATURE_PLAYBACK_CONTROL,
        PlaybackVolume = MDR_FEATURE_PLAYBACK_VOLUME,
        NoiseCancelling = MDR_FEATURE_NOISE_CANCELLING,
        AmbientSound = MDR_FEATURE_AMBIENT_SOUND,
        AdaptiveAmbientSound = MDR_FEATURE_ADAPTIVE_AMBIENT_SOUND,
        SpeakToChat = MDR_FEATURE_SPEAK_TO_CHAT,
        ListeningMode = MDR_FEATURE_LISTENING_MODE,
        Equalizer = MDR_FEATURE_EQUALIZER,
        Dsee = MDR_FEATURE_DSEE,
        PairedDeviceManagement = MDR_FEATURE_PAIRED_DEVICE_MANAGEMENT,
        PairingMode = MDR_FEATURE_PAIRING_MODE,
        GeneralSettings = MDR_FEATURE_GENERAL_SETTINGS,
        AssignableControls = MDR_FEATURE_ASSIGNABLE_CONTROLS,
        NoiseControlButton = MDR_FEATURE_NOISE_CONTROL_BUTTON,
        AutoPowerOff = MDR_FEATURE_AUTO_POWER_OFF,
        WearingDetection = MDR_FEATURE_WEARING_DETECTION,
        AutoPause = MDR_FEATURE_AUTO_PAUSE,
        HeadGesture = MDR_FEATURE_HEAD_GESTURE,
        VoiceGuidance = MDR_FEATURE_VOICE_GUIDANCE,
        VoiceGuidanceVolume = MDR_FEATURE_VOICE_GUIDANCE_VOLUME,
        Shutdown = MDR_FEATURE_SHUTDOWN,
        ConnectionMode = MDR_FEATURE_CONNECTION_MODE,
        SafeListening = MDR_FEATURE_SAFE_LISTENING,
        SourceSwitchControl = MDR_FEATURE_SOURCE_SWITCH_CONTROL,
        ListeningBackgroundMusic = MDR_FEATURE_LISTENING_BACKGROUND_MUSIC,
        ListeningCinema = MDR_FEATURE_LISTENING_CINEMA,
        ListeningVoiceBoost = MDR_FEATURE_LISTENING_VOICE_BOOST,
        ListeningSoundLeakageReduction = MDR_FEATURE_LISTENING_SOUND_LEAKAGE_REDUCTION,
        WearingStatus = MDR_FEATURE_WEARING_STATUS,
    }
}

c_enum! {
    /// `MDRText` (Headphones.h:104).
    Text: MDRText {
        ModelName = MDR_TEXT_MODEL_NAME,
        UniqueId = MDR_TEXT_UNIQUE_ID,
        FirmwareVersion = MDR_TEXT_FIRMWARE_VERSION,
        ModelSeries = MDR_TEXT_MODEL_SERIES,
        ModelColor = MDR_TEXT_MODEL_COLOR,
        TrackTitle = MDR_TEXT_TRACK_TITLE,
        TrackAlbum = MDR_TEXT_TRACK_ALBUM,
        TrackArtist = MDR_TEXT_TRACK_ARTIST,
        PairedDeviceId = MDR_TEXT_PAIRED_DEVICE_ID,
        PairedDeviceName = MDR_TEXT_PAIRED_DEVICE_NAME,
        GeneralSettingSubject = MDR_TEXT_GENERAL_SETTING_SUBJECT,
        GeneralSettingSummary = MDR_TEXT_GENERAL_SETTING_SUMMARY,
        LastError = MDR_TEXT_LAST_ERROR,
        LastAlert = MDR_TEXT_LAST_ALERT,
        LastInteraction = MDR_TEXT_LAST_INTERACTION,
        LastDeviceMessage = MDR_TEXT_LAST_DEVICE_MESSAGE,
        EqualizerPresetName = MDR_TEXT_EQUALIZER_PRESET_NAME,
    }
}

c_enum! {
    /// `MDRAudioCodec` (Headphones.h:125).
    AudioCodec: MDRAudioCodec {
        Unknown = MDR_AUDIO_CODEC_UNKNOWN,
        Sbc = MDR_AUDIO_CODEC_SBC,
        Aac = MDR_AUDIO_CODEC_AAC,
        Ldac = MDR_AUDIO_CODEC_LDAC,
        Aptx = MDR_AUDIO_CODEC_APTX,
        AptxHd = MDR_AUDIO_CODEC_APTX_HD,
        Lc3 = MDR_AUDIO_CODEC_LC3,
        Other = MDR_AUDIO_CODEC_OTHER,
    }
}

c_enum! {
    /// `MDRBatteryPart` (Headphones.h:135).
    BatteryPart: MDRBatteryPart {
        Main = MDR_BATTERY_MAIN,
        Left = MDR_BATTERY_LEFT,
        Right = MDR_BATTERY_RIGHT,
        Case = MDR_BATTERY_CASE,
    }
}

c_enum! {
    /// `MDRChargingState` (Headphones.h:141).
    ChargingState: MDRChargingState {
        Unknown = MDR_CHARGING_UNKNOWN,
        No = MDR_CHARGING_NO,
        Yes = MDR_CHARGING_YES,
        Complete = MDR_CHARGING_COMPLETE,
    }
}

c_enum! {
    /// `MDRPlaybackStatus` (Headphones.h:147).
    PlaybackStatus: MDRPlaybackStatus {
        Unknown = MDR_PLAYBACK_UNKNOWN,
        Stopped = MDR_PLAYBACK_STOPPED,
        Playing = MDR_PLAYBACK_PLAYING,
        Paused = MDR_PLAYBACK_PAUSED,
    }
}

c_enum! {
    /// `MDRPlaybackAction` (Headphones.h:153).
    PlaybackAction: MDRPlaybackAction {
        Play = MDR_PLAYBACK_PLAY,
        Pause = MDR_PLAYBACK_PAUSE,
        Next = MDR_PLAYBACK_NEXT,
        Previous = MDR_PLAYBACK_PREVIOUS,
    }
}

c_enum! {
    /// `MDRSourceSwitchControlResult` (Headphones.h:159).
    SourceSwitchResult: MDRSourceSwitchControlResult {
        Success = MDR_SOURCE_SWITCH_CONTROL_SUCCESS,
        Failed = MDR_SOURCE_SWITCH_CONTROL_FAILED,
        FailedOnCall = MDR_SOURCE_SWITCH_CONTROL_FAILED_ON_CALL,
        FailedNotConnected = MDR_SOURCE_SWITCH_CONTROL_FAILED_NOT_CONNECTED,
        FailedVoiceAssistant = MDR_SOURCE_SWITCH_CONTROL_FAILED_VOICE_ASSISTANT,
    }
}

c_enum! {
    /// `MDRNoiseMode` (Headphones.h:166).
    NoiseMode: MDRNoiseMode {
        Off = MDR_NOISE_MODE_OFF,
        Cancelling = MDR_NOISE_MODE_CANCELLING,
        // MDR_NOISE_MODE_V1_ON duplicates MDR_NOISE_MODE_CANCELLING; read back as the latter.
        Ambient = MDR_NOISE_MODE_AMBIENT,
    }
}

c_enum! {
    /// `MDRAdaptiveSensitivity` (Headphones.h:172).
    AdaptiveSensitivity: MDRAdaptiveSensitivity {
        Unknown = MDR_ADAPTIVE_SENSITIVITY_UNKNOWN,
        Low = MDR_ADAPTIVE_SENSITIVITY_LOW,
        Standard = MDR_ADAPTIVE_SENSITIVITY_STANDARD,
        High = MDR_ADAPTIVE_SENSITIVITY_HIGH,
    }
}

c_enum! {
    /// `MDRNoiseButtonMode` (Headphones.h:178).
    NoiseButtonMode: MDRNoiseButtonMode {
        None = MDR_NOISE_BUTTON_NONE,
        NoiseAmbientOff = MDR_NOISE_BUTTON_NOISE_AMBIENT_OFF,
        NoiseAmbient = MDR_NOISE_BUTTON_NOISE_AMBIENT,
        NoiseOff = MDR_NOISE_BUTTON_NOISE_OFF,
        AmbientOff = MDR_NOISE_BUTTON_AMBIENT_OFF,
    }
}

c_enum! {
    /// `MDRSpeechSensitivity` (Headphones.h:185).
    SpeechSensitivity: MDRSpeechSensitivity {
        Unknown = MDR_SPEECH_SENSITIVITY_UNKNOWN,
        Auto = MDR_SPEECH_SENSITIVITY_AUTO,
        Low = MDR_SPEECH_SENSITIVITY_LOW,
        High = MDR_SPEECH_SENSITIVITY_HIGH,
    }
}

c_enum! {
    /// `MDRSpeakTimeout` (Headphones.h:191).
    SpeakTimeout: MDRSpeakTimeout {
        Unknown = MDR_SPEAK_TIMEOUT_UNKNOWN,
        Short = MDR_SPEAK_TIMEOUT_SHORT,
        Medium = MDR_SPEAK_TIMEOUT_MEDIUM,
        Long = MDR_SPEAK_TIMEOUT_LONG,
        Manual = MDR_SPEAK_TIMEOUT_MANUAL,
    }
}

c_enum! {
    /// `MDRListeningMode` (Headphones.h:199).
    ListeningMode: MDRListeningMode {
        Standard = MDR_LISTENING_STANDARD,
        BackgroundMusic = MDR_LISTENING_BACKGROUND_MUSIC,
        Cinema = MDR_LISTENING_CINEMA,
        VoiceBoost = MDR_LISTENING_VOICE_BOOST,
        SoundLeakageReduction = MDR_LISTENING_SOUND_LEAKAGE_REDUCTION,
    }
}

c_enum! {
    /// `MDRRoomSize` (Headphones.h:206).
    RoomSize: MDRRoomSize {
        Unknown = MDR_ROOM_UNKNOWN,
        Small = MDR_ROOM_SMALL,
        Medium = MDR_ROOM_MEDIUM,
        Large = MDR_ROOM_LARGE,
    }
}

c_enum! {
    /// `MDREqualizerPreset` (Headphones.h:212).
    EqualizerPresetId: MDREqualizerPreset {
        Off = MDR_EQ_OFF,
        Rock = MDR_EQ_ROCK,
        Pop = MDR_EQ_POP,
        Jazz = MDR_EQ_JAZZ,
        Dance = MDR_EQ_DANCE,
        Edm = MDR_EQ_EDM,
        RAndBHipHop = MDR_EQ_R_AND_B_HIP_HOP,
        Acoustic = MDR_EQ_ACOUSTIC,
        Bright = MDR_EQ_BRIGHT,
        Excited = MDR_EQ_EXCITED,
        Mellow = MDR_EQ_MELLOW,
        Relaxed = MDR_EQ_RELAXED,
        Vocal = MDR_EQ_VOCAL,
        Treble = MDR_EQ_TREBLE,
        Bass = MDR_EQ_BASS,
        Speech = MDR_EQ_SPEECH,
        Heavy = MDR_EQ_HEAVY,
        Clear = MDR_EQ_CLEAR,
        Hard = MDR_EQ_HARD,
        Soft = MDR_EQ_SOFT,
        Gaming = MDR_EQ_GAMING,
        Fps1 = MDR_EQ_FPS_1,
        Fps2 = MDR_EQ_FPS_2,
        Fps3 = MDR_EQ_FPS_3,
        Custom = MDR_EQ_CUSTOM,
        User1 = MDR_EQ_USER_1,
        User2 = MDR_EQ_USER_2,
        User3 = MDR_EQ_USER_3,
        User4 = MDR_EQ_USER_4,
        User5 = MDR_EQ_USER_5,
        Unknown = MDR_EQ_UNKNOWN,
    }
}

c_enum! {
    /// `MDRDSEEType` (Headphones.h:245).
    DseeType: MDRDSEEType {
        Unknown = MDR_DSEE_UNKNOWN,
        Standard = MDR_DSEE_STANDARD,
        Hx = MDR_DSEE_HX,
        HxAi = MDR_DSEE_HX_AI,
        Ultimate = MDR_DSEE_ULTIMATE,
    }
}

c_enum! {
    /// `MDRPairedDeviceCommand` (Headphones.h:252).
    PairedDeviceCommand: MDRPairedDeviceCommand {
        Connect = MDR_PAIRED_DEVICE_CONNECT,
        Disconnect = MDR_PAIRED_DEVICE_DISCONNECT,
        SelectPlayback = MDR_PAIRED_DEVICE_SELECT_PLAYBACK,
        Unpair = MDR_PAIRED_DEVICE_UNPAIR,
    }
}

c_enum! {
    /// `MDRAlertAction` (Headphones.h:258).
    AlertAction: MDRAlertAction {
        Negative = MDR_ALERT_ACTION_NEGATIVE,
        Positive = MDR_ALERT_ACTION_POSITIVE,
    }
}

c_enum! {
    /// `MDRGeneralSettingType` (Headphones.h:262).
    GeneralSettingType: MDRGeneralSettingType {
        Unknown = MDR_GENERAL_SETTING_UNKNOWN,
        Boolean = MDR_GENERAL_SETTING_BOOLEAN,
    }
}

c_enum! {
    /// `MDRAssignableAction` (Headphones.h:266).
    AssignableAction: MDRAssignableAction {
        None = MDR_ASSIGNABLE_NONE,
        Playback = MDR_ASSIGNABLE_PLAYBACK,
        NoiseControl = MDR_ASSIGNABLE_NOISE_CONTROL,
        NoiseControlQuickAccess = MDR_ASSIGNABLE_NOISE_CONTROL_QUICK_ACCESS,
        TrackControl = MDR_ASSIGNABLE_TRACK_CONTROL,
        VoiceRecognition = MDR_ASSIGNABLE_VOICE_RECOGNITION,
        GoogleAssistant = MDR_ASSIGNABLE_GOOGLE_ASSISTANT,
        AmazonAlexa = MDR_ASSIGNABLE_AMAZON_ALEXA,
        TencentXiaowei = MDR_ASSIGNABLE_TENCENT_XIAOWEI,
        MicrosoftCortana = MDR_ASSIGNABLE_MICROSOFT_CORTANA,
        QuickAccess = MDR_ASSIGNABLE_QUICK_ACCESS,
        Volume = MDR_ASSIGNABLE_VOLUME,
        PlaybackVoiceAssistantLimitation = MDR_ASSIGNABLE_PLAYBACK_VOICE_ASSISTANT_LIMITATION,
        TencentXiaoweiQMsc = MDR_ASSIGNABLE_TENCENT_XIAOWEI_Q_MSC,
        Teams = MDR_ASSIGNABLE_TEAMS,
        GoogleAssistantBtClassicCaution = MDR_ASSIGNABLE_GOOGLE_ASSISTANT_BT_CLASSIC_CAUTION,
        AmazonAlexaBtClassicCaution = MDR_ASSIGNABLE_AMAZON_ALEXA_BT_CLASSIC_CAUTION,
        TencentXiaoweiBtClassicCaution = MDR_ASSIGNABLE_TENCENT_XIAOWEI_BT_CLASSIC_CAUTION,
        QuickAccessBtClassicCaution = MDR_ASSIGNABLE_QUICK_ACCESS_BT_CLASSIC_CAUTION,
        NoiseControlQuickAccessBtClassicCaution = MDR_ASSIGNABLE_NOISE_CONTROL_QUICK_ACCESS_BT_CLASSIC_CAUTION,
        TencentXiaoweiQMscBtClassicCaution = MDR_ASSIGNABLE_TENCENT_XIAOWEI_Q_MSC_BT_CLASSIC_CAUTION,
        NoiseControlMic = MDR_ASSIGNABLE_NOISE_CONTROL_MIC,
        ListeningModeQuickAccess = MDR_ASSIGNABLE_LISTENING_MODE_QUICK_ACCESS,
        NoiseControlListeningMode = MDR_ASSIGNABLE_NOISE_CONTROL_LISTENING_MODE,
        ChatMix = MDR_ASSIGNABLE_CHAT_MIX,
        Custom1 = MDR_ASSIGNABLE_CUSTOM1,
        Custom2 = MDR_ASSIGNABLE_CUSTOM2,
        Unknown = MDR_ASSIGNABLE_UNKNOWN,
    }
}

c_enum! {
    /// `MDRWearingPowerMode` (Headphones.h:296).
    WearingPowerMode: MDRWearingPowerMode {
        Unavailable = MDR_WEARING_POWER_UNAVAILABLE,
        Disabled = MDR_WEARING_POWER_DISABLED,
        WhenRemoved = MDR_WEARING_POWER_WHEN_REMOVED,
    }
}

c_enum! {
    /// `MDRWearingStatus` (Headphones.h:301).
    WearingStatus: MDRWearingStatus {
        Unknown = MDR_WEARING_STATUS_UNKNOWN,
        Worn = MDR_WEARING_STATUS_WORN,
        LeftRemoved = MDR_WEARING_STATUS_LEFT_REMOVED,
        RightRemoved = MDR_WEARING_STATUS_RIGHT_REMOVED,
        Removed = MDR_WEARING_STATUS_REMOVED,
    }
}

c_enum! {
    /// `MDRAudioPriority` (Headphones.h:308).
    AudioPriority: MDRAudioPriority {
        Unknown = MDR_AUDIO_PRIORITY_UNKNOWN,
        Quality = MDR_AUDIO_PRIORITY_QUALITY,
        Stability = MDR_AUDIO_PRIORITY_STABILITY,
    }
}

c_enum! {
    /// `MDRAssignableActionKeyLocation` (Headphones.h:409).
    KeyLocation: MDRAssignableActionKeyLocation {
        Unknown = MDR_ASSIGNABLE_ACTION_KEY_UNKNOWN,
        Left = MDR_ASSIGNABLE_ACTION_KEY_LEFT,
        Right = MDR_ASSIGNABLE_ACTION_KEY_RIGHT,
        Custom = MDR_ASSIGNABLE_ACTION_KEY_CUSTOM,
        C = MDR_ASSIGNABLE_ACTION_KEY_C,
        NcAmb = MDR_ASSIGNABLE_ACTION_KEY_NC_AMB,
        NcAmbient = MDR_ASSIGNABLE_ACTION_KEY_NC_AMBIENT,
    }
}

c_enum! {
    /// `MDRAssignableActionKeyType` (Headphones.h:418).
    KeyType: MDRAssignableActionKeyType {
        Unknown = MDR_ASSIGNABLE_ACTION_KEY_TYPE_UNKNOWN,
        TouchSensor = MDR_ASSIGNABLE_ACTION_KEY_TYPE_TOUCH_SENSOR,
        Button = MDR_ASSIGNABLE_ACTION_KEY_TYPE_BUTTON,
        FaceTap = MDR_ASSIGNABLE_ACTION_KEY_TYPE_FACE_TAP,
    }
}

impl Feature {
    /// The snapshot key: the `MDR_FEATURE_*` name without its prefix, e.g. `NOISE_CANCELLING`.
    pub fn key(self) -> String {
        match self.c_name() {
            Some(n) => n.trim_start_matches("MDR_FEATURE_").to_string(),
            None => format!("FEATURE_{}", self.raw()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn raw_round_trips_and_unknown_values_survive() {
        for f in Feature::ALL {
            assert_eq!(Feature::from_raw(f.raw()), *f);
        }
        assert_eq!(Feature::ALL.len() as u32, MDR_FEATURE_MAX_VALUE);
        assert_eq!(Feature::from_raw(99), Feature::Unrecognized(99));
        assert_eq!(Feature::NoiseCancelling.key(), "NOISE_CANCELLING");
        // MDR_NOISE_MODE_V1_ON == MDR_NOISE_MODE_CANCELLING
        assert_eq!(
            NoiseMode::from_raw(MDR_NOISE_MODE_V1_ON),
            NoiseMode::Cancelling
        );
    }

    #[test]
    fn serde_uses_camel_case_strings_and_numbers_for_unrecognized() {
        assert_eq!(
            serde_json::to_string(&EqualizerPresetId::RAndBHipHop).unwrap(),
            "\"rAndBHipHop\""
        );
        assert_eq!(
            serde_json::to_string(&ChargingState::Unrecognized(7)).unwrap(),
            "7"
        );
        let v: NoiseMode = serde_json::from_str("\"ambient\"").unwrap();
        assert_eq!(v, NoiseMode::Ambient);
        let v: NoiseMode = serde_json::from_str("2").unwrap();
        assert_eq!(v, NoiseMode::Ambient);
        assert!(serde_json::from_str::<NoiseMode>("\"loud\"").is_err());
    }
}
