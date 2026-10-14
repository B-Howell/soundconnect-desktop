//! `libmdr/include/mdr-c/Headphones.h`
//!
//! Constants and typedefs are generated line-for-line from the header's
//! `typedef uint32_t` / `#define ((T)Nu)` pairs (lines 11-311, 408-421), then
//! structs (313-454) and functions (485-643) in header order.

use crate::base::MDRResult;
use crate::connection::MDRConnection;
use core::ffi::{c_char, c_int, c_uchar, c_void};

/// Headphones.h:9 `typedef struct MDRHeadphones MDRHeadphones;` (opaque).
#[repr(C)]
pub struct MDRHeadphones {
    _p: [u8; 0],
}

/// Headphones.h:11 `typedef uint32_t MDRProtocolVersion;`
pub type MDRProtocolVersion = u32;
/// Headphones.h:12
pub const MDR_PROTOCOL_V1: MDRProtocolVersion = 1;
/// Headphones.h:13
pub const MDR_PROTOCOL_V2: MDRProtocolVersion = 2;

/// Headphones.h:15 `typedef uint32_t MDRBoolean;`
pub type MDRBoolean = u32;
/// Headphones.h:16
pub const MDR_FALSE: MDRBoolean = 0;
/// Headphones.h:17
pub const MDR_TRUE: MDRBoolean = 1;

/// Headphones.h:19 `typedef uint32_t MDRFeatureAvailability;`
pub type MDRFeatureAvailability = u32;
/// Headphones.h:20
pub const MDR_AVAILABILITY_UNKNOWN: MDRFeatureAvailability = 0;
/// Headphones.h:21
pub const MDR_AVAILABILITY_UNAVAILABLE: MDRFeatureAvailability = 1;
/// Headphones.h:22
pub const MDR_AVAILABILITY_AVAILABLE: MDRFeatureAvailability = 2;

/// Headphones.h:24 `typedef uint32_t MDRTimeoutType;`
pub type MDRTimeoutType = u32;
/// Headphones.h:25
pub const MDR_TIMEOUT_DEFAULT: MDRTimeoutType = 0;
/// Headphones.h:26
pub const MDR_TIMEOUT_ACK: MDRTimeoutType = 1;
/// Headphones.h:27
pub const MDR_TIMEOUT_ACK_RETRIES: MDRTimeoutType = 2;

/// Headphones.h:29 `typedef uint32_t MDRFeature;`
pub type MDRFeature = u32;
/// Headphones.h:30
pub const MDR_FEATURE_IDENTITY: MDRFeature = 1;
/// Headphones.h:31
pub const MDR_FEATURE_BATTERY_SINGLE: MDRFeature = 2;
/// Headphones.h:32
pub const MDR_FEATURE_BATTERY_LEFT_RIGHT: MDRFeature = 3;
/// Headphones.h:33
pub const MDR_FEATURE_BATTERY_CASE: MDRFeature = 4;
/// Headphones.h:34
pub const MDR_FEATURE_PLAYBACK_METADATA: MDRFeature = 5;
/// Headphones.h:35
pub const MDR_FEATURE_PLAYBACK_CONTROL: MDRFeature = 6;
/// Headphones.h:36
pub const MDR_FEATURE_PLAYBACK_VOLUME: MDRFeature = 7;
/// Headphones.h:37
pub const MDR_FEATURE_NOISE_CANCELLING: MDRFeature = 8;
/// Headphones.h:38
pub const MDR_FEATURE_AMBIENT_SOUND: MDRFeature = 9;
/// Headphones.h:39
pub const MDR_FEATURE_ADAPTIVE_AMBIENT_SOUND: MDRFeature = 10;
/// Headphones.h:40
pub const MDR_FEATURE_SPEAK_TO_CHAT: MDRFeature = 11;
/// Headphones.h:41
pub const MDR_FEATURE_LISTENING_MODE: MDRFeature = 12;
/// Headphones.h:42
pub const MDR_FEATURE_EQUALIZER: MDRFeature = 13;
/// Headphones.h:43
pub const MDR_FEATURE_DSEE: MDRFeature = 14;
/// Headphones.h:44
pub const MDR_FEATURE_PAIRED_DEVICE_MANAGEMENT: MDRFeature = 15;
/// Headphones.h:45
pub const MDR_FEATURE_PAIRING_MODE: MDRFeature = 16;
/// Headphones.h:46
pub const MDR_FEATURE_GENERAL_SETTINGS: MDRFeature = 17;
/// Headphones.h:47
pub const MDR_FEATURE_ASSIGNABLE_CONTROLS: MDRFeature = 18;
/// Headphones.h:48
pub const MDR_FEATURE_NOISE_CONTROL_BUTTON: MDRFeature = 19;
/// Headphones.h:49
pub const MDR_FEATURE_AUTO_POWER_OFF: MDRFeature = 20;
/// Headphones.h:50
pub const MDR_FEATURE_WEARING_DETECTION: MDRFeature = 21;
/// Headphones.h:51
pub const MDR_FEATURE_AUTO_PAUSE: MDRFeature = 22;
/// Headphones.h:52
pub const MDR_FEATURE_HEAD_GESTURE: MDRFeature = 23;
/// Headphones.h:53
pub const MDR_FEATURE_VOICE_GUIDANCE: MDRFeature = 24;
/// Headphones.h:54
pub const MDR_FEATURE_VOICE_GUIDANCE_VOLUME: MDRFeature = 25;
/// Headphones.h:55
pub const MDR_FEATURE_SHUTDOWN: MDRFeature = 26;
/// Headphones.h:56
pub const MDR_FEATURE_CONNECTION_MODE: MDRFeature = 27;
/// Headphones.h:57
pub const MDR_FEATURE_SAFE_LISTENING: MDRFeature = 28;
/// Headphones.h:58
pub const MDR_FEATURE_SOURCE_SWITCH_CONTROL: MDRFeature = 29;
/// Headphones.h:60
pub const MDR_FEATURE_LISTENING_BACKGROUND_MUSIC: MDRFeature = 30;
/// Headphones.h:61
pub const MDR_FEATURE_LISTENING_CINEMA: MDRFeature = 31;
/// Headphones.h:62
pub const MDR_FEATURE_LISTENING_VOICE_BOOST: MDRFeature = 32;
/// Headphones.h:63
pub const MDR_FEATURE_LISTENING_SOUND_LEAKAGE_REDUCTION: MDRFeature = 33;
/// Headphones.h:64
pub const MDR_FEATURE_WEARING_STATUS: MDRFeature = 34;
/// Headphones.h:65
pub const MDR_FEATURE_MAX_VALUE: MDRFeature = MDR_FEATURE_WEARING_STATUS;

/// Headphones.h:67 `typedef uint32_t MDREvent;`
pub type MDREvent = u32;
/// Headphones.h:68
pub const MDR_EVENT_NONE: MDREvent = 0;
/// Headphones.h:69
pub const MDR_EVENT_IDENTITY_CHANGED: MDREvent = 1;
/// Headphones.h:70
pub const MDR_EVENT_BATTERY_CHANGED: MDREvent = 2;
/// Headphones.h:71
pub const MDR_EVENT_PLAYBACK_CHANGED: MDREvent = 3;
/// Headphones.h:72
pub const MDR_EVENT_NOISE_CONTROL_CHANGED: MDREvent = 4;
/// Headphones.h:73
pub const MDR_EVENT_SPEAK_TO_CHAT_CHANGED: MDREvent = 5;
/// Headphones.h:74
pub const MDR_EVENT_LISTENING_MODE_CHANGED: MDREvent = 6;
/// Headphones.h:75
pub const MDR_EVENT_EQUALIZER_CHANGED: MDREvent = 7;
/// Headphones.h:76
pub const MDR_EVENT_PAIRED_DEVICES_CHANGED: MDREvent = 8;
/// Headphones.h:77
pub const MDR_EVENT_PAIRING_CHANGED: MDREvent = 9;
/// Headphones.h:78
pub const MDR_EVENT_GENERAL_SETTINGS_CHANGED: MDREvent = 10;
/// Headphones.h:79
pub const MDR_EVENT_ASSIGNABLE_CONTROLS_CHANGED: MDREvent = 11;
/// Headphones.h:80
pub const MDR_EVENT_POWER_CHANGED: MDREvent = 12;
/// Headphones.h:81
pub const MDR_EVENT_VOICE_GUIDANCE_CHANGED: MDREvent = 13;
/// Headphones.h:82
pub const MDR_EVENT_CONNECTION_MODE_CHANGED: MDREvent = 14;
/// Headphones.h:83
pub const MDR_EVENT_SAFE_LISTENING_CHANGED: MDREvent = 15;
/// Headphones.h:84
pub const MDR_EVENT_INITIALIZE_COMPLETE: MDREvent = 16;
/// Headphones.h:85
pub const MDR_EVENT_SYNC_COMPLETE: MDREvent = 17;
/// Headphones.h:86
pub const MDR_EVENT_APPLY_COMPLETE: MDREvent = 18;
/// Headphones.h:87
pub const MDR_EVENT_ALERT: MDREvent = 19;
/// Headphones.h:88
pub const MDR_EVENT_INTERACTION: MDREvent = 20;
/// Headphones.h:89
pub const MDR_EVENT_DEVICE_MESSAGE: MDREvent = 21;
/// Headphones.h:96
pub const MDR_EVENT_NEED_SYNC: MDREvent = 22;
/// Headphones.h:97
pub const MDR_EVENT_UNHANDLED: MDREvent = 23;
/// Headphones.h:98
pub const MDR_EVENT_WEARING_STATUS_CHANGED: MDREvent = 24;

/// Headphones.h:100 `typedef uint32_t MDRPacketDirection;`
pub type MDRPacketDirection = u32;
/// Headphones.h:101
pub const MDR_PACKET_DIRECTION_RX: MDRPacketDirection = 0;
/// Headphones.h:102
pub const MDR_PACKET_DIRECTION_TX: MDRPacketDirection = 1;

/// Headphones.h:104 `typedef uint32_t MDRText;`
pub type MDRText = u32;
/// Headphones.h:105
pub const MDR_TEXT_MODEL_NAME: MDRText = 1;
/// Headphones.h:106
pub const MDR_TEXT_UNIQUE_ID: MDRText = 2;
/// Headphones.h:107
pub const MDR_TEXT_FIRMWARE_VERSION: MDRText = 3;
/// Headphones.h:108
pub const MDR_TEXT_MODEL_SERIES: MDRText = 4;
/// Headphones.h:109
pub const MDR_TEXT_MODEL_COLOR: MDRText = 5;
/// Headphones.h:110
pub const MDR_TEXT_TRACK_TITLE: MDRText = 6;
/// Headphones.h:111
pub const MDR_TEXT_TRACK_ALBUM: MDRText = 7;
/// Headphones.h:112
pub const MDR_TEXT_TRACK_ARTIST: MDRText = 8;
/// Headphones.h:113
pub const MDR_TEXT_PAIRED_DEVICE_ID: MDRText = 9;
/// Headphones.h:114
pub const MDR_TEXT_PAIRED_DEVICE_NAME: MDRText = 10;
/// Headphones.h:115
pub const MDR_TEXT_GENERAL_SETTING_SUBJECT: MDRText = 11;
/// Headphones.h:116
pub const MDR_TEXT_GENERAL_SETTING_SUMMARY: MDRText = 12;
/// Headphones.h:117
pub const MDR_TEXT_LAST_ERROR: MDRText = 13;
/// Headphones.h:118
pub const MDR_TEXT_LAST_ALERT: MDRText = 14;
/// Headphones.h:119
pub const MDR_TEXT_LAST_INTERACTION: MDRText = 15;
/// Headphones.h:120
pub const MDR_TEXT_LAST_DEVICE_MESSAGE: MDRText = 16;
/// Headphones.h:122
pub const MDR_TEXT_EQUALIZER_PRESET_NAME: MDRText = 17;

/// Headphones.h:124 `typedef uint32_t MDRAudioCodec;`
pub type MDRAudioCodec = u32;
/// Headphones.h:125
pub const MDR_AUDIO_CODEC_UNKNOWN: MDRAudioCodec = 0;
/// Headphones.h:126
pub const MDR_AUDIO_CODEC_SBC: MDRAudioCodec = 1;
/// Headphones.h:127
pub const MDR_AUDIO_CODEC_AAC: MDRAudioCodec = 2;
/// Headphones.h:128
pub const MDR_AUDIO_CODEC_LDAC: MDRAudioCodec = 3;
/// Headphones.h:129
pub const MDR_AUDIO_CODEC_APTX: MDRAudioCodec = 4;
/// Headphones.h:130
pub const MDR_AUDIO_CODEC_APTX_HD: MDRAudioCodec = 5;
/// Headphones.h:131
pub const MDR_AUDIO_CODEC_LC3: MDRAudioCodec = 6;
/// Headphones.h:132
pub const MDR_AUDIO_CODEC_OTHER: MDRAudioCodec = 255;

/// Headphones.h:134 `typedef uint32_t MDRBatteryPart;`
pub type MDRBatteryPart = u32;
/// Headphones.h:135
pub const MDR_BATTERY_MAIN: MDRBatteryPart = 0;
/// Headphones.h:136
pub const MDR_BATTERY_LEFT: MDRBatteryPart = 1;
/// Headphones.h:137
pub const MDR_BATTERY_RIGHT: MDRBatteryPart = 2;
/// Headphones.h:138
pub const MDR_BATTERY_CASE: MDRBatteryPart = 3;

/// Headphones.h:140 `typedef uint32_t MDRChargingState;`
pub type MDRChargingState = u32;
/// Headphones.h:141
pub const MDR_CHARGING_UNKNOWN: MDRChargingState = 0;
/// Headphones.h:142
pub const MDR_CHARGING_NO: MDRChargingState = 1;
/// Headphones.h:143
pub const MDR_CHARGING_YES: MDRChargingState = 2;
/// Headphones.h:144
pub const MDR_CHARGING_COMPLETE: MDRChargingState = 3;

/// Headphones.h:146 `typedef uint32_t MDRPlaybackStatus;`
pub type MDRPlaybackStatus = u32;
/// Headphones.h:147
pub const MDR_PLAYBACK_UNKNOWN: MDRPlaybackStatus = 0;
/// Headphones.h:148
pub const MDR_PLAYBACK_STOPPED: MDRPlaybackStatus = 1;
/// Headphones.h:149
pub const MDR_PLAYBACK_PLAYING: MDRPlaybackStatus = 2;
/// Headphones.h:150
pub const MDR_PLAYBACK_PAUSED: MDRPlaybackStatus = 3;

/// Headphones.h:152 `typedef uint32_t MDRPlaybackAction;`
pub type MDRPlaybackAction = u32;
/// Headphones.h:153
pub const MDR_PLAYBACK_PLAY: MDRPlaybackAction = 1;
/// Headphones.h:154
pub const MDR_PLAYBACK_PAUSE: MDRPlaybackAction = 2;
/// Headphones.h:155
pub const MDR_PLAYBACK_NEXT: MDRPlaybackAction = 3;
/// Headphones.h:156
pub const MDR_PLAYBACK_PREVIOUS: MDRPlaybackAction = 4;

/// Headphones.h:158 `typedef uint32_t MDRSourceSwitchControlResult;`
pub type MDRSourceSwitchControlResult = u32;
/// Headphones.h:159
pub const MDR_SOURCE_SWITCH_CONTROL_SUCCESS: MDRSourceSwitchControlResult = 0;
/// Headphones.h:160
pub const MDR_SOURCE_SWITCH_CONTROL_FAILED: MDRSourceSwitchControlResult = 1;
/// Headphones.h:161
pub const MDR_SOURCE_SWITCH_CONTROL_FAILED_ON_CALL: MDRSourceSwitchControlResult = 2;
/// Headphones.h:162
pub const MDR_SOURCE_SWITCH_CONTROL_FAILED_NOT_CONNECTED: MDRSourceSwitchControlResult = 3;
/// Headphones.h:163
pub const MDR_SOURCE_SWITCH_CONTROL_FAILED_VOICE_ASSISTANT: MDRSourceSwitchControlResult = 4;

/// Headphones.h:165 `typedef uint32_t MDRNoiseMode;`
pub type MDRNoiseMode = u32;
/// Headphones.h:166
pub const MDR_NOISE_MODE_OFF: MDRNoiseMode = 0;
/// Headphones.h:167
pub const MDR_NOISE_MODE_CANCELLING: MDRNoiseMode = 1;
/// Headphones.h:168
pub const MDR_NOISE_MODE_V1_ON: MDRNoiseMode = 1;
/// Headphones.h:169
pub const MDR_NOISE_MODE_AMBIENT: MDRNoiseMode = 2;

/// Headphones.h:171 `typedef uint32_t MDRAdaptiveSensitivity;`
pub type MDRAdaptiveSensitivity = u32;
/// Headphones.h:172
pub const MDR_ADAPTIVE_SENSITIVITY_UNKNOWN: MDRAdaptiveSensitivity = 0;
/// Headphones.h:173
pub const MDR_ADAPTIVE_SENSITIVITY_LOW: MDRAdaptiveSensitivity = 1;
/// Headphones.h:174
pub const MDR_ADAPTIVE_SENSITIVITY_STANDARD: MDRAdaptiveSensitivity = 2;
/// Headphones.h:175
pub const MDR_ADAPTIVE_SENSITIVITY_HIGH: MDRAdaptiveSensitivity = 3;

/// Headphones.h:177 `typedef uint32_t MDRNoiseButtonMode;`
pub type MDRNoiseButtonMode = u32;
/// Headphones.h:178
pub const MDR_NOISE_BUTTON_NONE: MDRNoiseButtonMode = 0;
/// Headphones.h:179
pub const MDR_NOISE_BUTTON_NOISE_AMBIENT_OFF: MDRNoiseButtonMode = 1;
/// Headphones.h:180
pub const MDR_NOISE_BUTTON_NOISE_AMBIENT: MDRNoiseButtonMode = 2;
/// Headphones.h:181
pub const MDR_NOISE_BUTTON_NOISE_OFF: MDRNoiseButtonMode = 3;
/// Headphones.h:182
pub const MDR_NOISE_BUTTON_AMBIENT_OFF: MDRNoiseButtonMode = 4;

/// Headphones.h:184 `typedef uint32_t MDRSpeechSensitivity;`
pub type MDRSpeechSensitivity = u32;
/// Headphones.h:185
pub const MDR_SPEECH_SENSITIVITY_UNKNOWN: MDRSpeechSensitivity = 0;
/// Headphones.h:186
pub const MDR_SPEECH_SENSITIVITY_AUTO: MDRSpeechSensitivity = 1;
/// Headphones.h:187
pub const MDR_SPEECH_SENSITIVITY_LOW: MDRSpeechSensitivity = 2;
/// Headphones.h:188
pub const MDR_SPEECH_SENSITIVITY_HIGH: MDRSpeechSensitivity = 3;

/// Headphones.h:190 `typedef uint32_t MDRSpeakTimeout;`
pub type MDRSpeakTimeout = u32;
/// Headphones.h:191
pub const MDR_SPEAK_TIMEOUT_UNKNOWN: MDRSpeakTimeout = 0;
/// Headphones.h:192
pub const MDR_SPEAK_TIMEOUT_SHORT: MDRSpeakTimeout = 1;
/// Headphones.h:193
pub const MDR_SPEAK_TIMEOUT_MEDIUM: MDRSpeakTimeout = 2;
/// Headphones.h:194
pub const MDR_SPEAK_TIMEOUT_LONG: MDRSpeakTimeout = 3;
/// Headphones.h:195
pub const MDR_SPEAK_TIMEOUT_MANUAL: MDRSpeakTimeout = 4;

/// Headphones.h:198 `typedef uint32_t MDRListeningMode;`
pub type MDRListeningMode = u32;
/// Headphones.h:199
pub const MDR_LISTENING_STANDARD: MDRListeningMode = 0;
/// Headphones.h:200
pub const MDR_LISTENING_BACKGROUND_MUSIC: MDRListeningMode = 1;
/// Headphones.h:201
pub const MDR_LISTENING_CINEMA: MDRListeningMode = 2;
/// Headphones.h:202
pub const MDR_LISTENING_VOICE_BOOST: MDRListeningMode = 3;
/// Headphones.h:203
pub const MDR_LISTENING_SOUND_LEAKAGE_REDUCTION: MDRListeningMode = 4;

/// Headphones.h:205 `typedef uint32_t MDRRoomSize;`
pub type MDRRoomSize = u32;
/// Headphones.h:206
pub const MDR_ROOM_UNKNOWN: MDRRoomSize = 0;
/// Headphones.h:207
pub const MDR_ROOM_SMALL: MDRRoomSize = 1;
/// Headphones.h:208
pub const MDR_ROOM_MEDIUM: MDRRoomSize = 2;
/// Headphones.h:209
pub const MDR_ROOM_LARGE: MDRRoomSize = 3;

/// Headphones.h:211 `typedef uint32_t MDREqualizerPreset;`
pub type MDREqualizerPreset = u32;
/// Headphones.h:212
pub const MDR_EQ_OFF: MDREqualizerPreset = 0;
/// Headphones.h:213
pub const MDR_EQ_ROCK: MDREqualizerPreset = 1;
/// Headphones.h:214
pub const MDR_EQ_POP: MDREqualizerPreset = 2;
/// Headphones.h:215
pub const MDR_EQ_JAZZ: MDREqualizerPreset = 3;
/// Headphones.h:216
pub const MDR_EQ_DANCE: MDREqualizerPreset = 4;
/// Headphones.h:217
pub const MDR_EQ_EDM: MDREqualizerPreset = 5;
/// Headphones.h:218
pub const MDR_EQ_R_AND_B_HIP_HOP: MDREqualizerPreset = 6;
/// Headphones.h:219
pub const MDR_EQ_ACOUSTIC: MDREqualizerPreset = 7;
/// Headphones.h:220
pub const MDR_EQ_BRIGHT: MDREqualizerPreset = 8;
/// Headphones.h:221
pub const MDR_EQ_EXCITED: MDREqualizerPreset = 9;
/// Headphones.h:222
pub const MDR_EQ_MELLOW: MDREqualizerPreset = 10;
/// Headphones.h:223
pub const MDR_EQ_RELAXED: MDREqualizerPreset = 11;
/// Headphones.h:224
pub const MDR_EQ_VOCAL: MDREqualizerPreset = 12;
/// Headphones.h:225
pub const MDR_EQ_TREBLE: MDREqualizerPreset = 13;
/// Headphones.h:226
pub const MDR_EQ_BASS: MDREqualizerPreset = 14;
/// Headphones.h:227
pub const MDR_EQ_SPEECH: MDREqualizerPreset = 15;
/// Headphones.h:228
pub const MDR_EQ_HEAVY: MDREqualizerPreset = 16;
/// Headphones.h:229
pub const MDR_EQ_CLEAR: MDREqualizerPreset = 17;
/// Headphones.h:230
pub const MDR_EQ_HARD: MDREqualizerPreset = 18;
/// Headphones.h:231
pub const MDR_EQ_SOFT: MDREqualizerPreset = 19;
/// Headphones.h:232
pub const MDR_EQ_GAMING: MDREqualizerPreset = 20;
/// Headphones.h:233
pub const MDR_EQ_FPS_1: MDREqualizerPreset = 21;
/// Headphones.h:234
pub const MDR_EQ_FPS_2: MDREqualizerPreset = 22;
/// Headphones.h:235
pub const MDR_EQ_FPS_3: MDREqualizerPreset = 23;
/// Headphones.h:236
pub const MDR_EQ_CUSTOM: MDREqualizerPreset = 24;
/// Headphones.h:237
pub const MDR_EQ_USER_1: MDREqualizerPreset = 25;
/// Headphones.h:238
pub const MDR_EQ_USER_2: MDREqualizerPreset = 26;
/// Headphones.h:239
pub const MDR_EQ_USER_3: MDREqualizerPreset = 27;
/// Headphones.h:240
pub const MDR_EQ_USER_4: MDREqualizerPreset = 28;
/// Headphones.h:241
pub const MDR_EQ_USER_5: MDREqualizerPreset = 29;
/// Headphones.h:242
pub const MDR_EQ_UNKNOWN: MDREqualizerPreset = 255;

/// Headphones.h:244 `typedef uint32_t MDRDSEEType;`
pub type MDRDSEEType = u32;
/// Headphones.h:245
pub const MDR_DSEE_UNKNOWN: MDRDSEEType = 0;
/// Headphones.h:246
pub const MDR_DSEE_STANDARD: MDRDSEEType = 1;
/// Headphones.h:247
pub const MDR_DSEE_HX: MDRDSEEType = 2;
/// Headphones.h:248
pub const MDR_DSEE_HX_AI: MDRDSEEType = 3;
/// Headphones.h:249
pub const MDR_DSEE_ULTIMATE: MDRDSEEType = 4;

/// Headphones.h:251 `typedef uint32_t MDRPairedDeviceCommand;`
pub type MDRPairedDeviceCommand = u32;
/// Headphones.h:252
pub const MDR_PAIRED_DEVICE_CONNECT: MDRPairedDeviceCommand = 1;
/// Headphones.h:253
pub const MDR_PAIRED_DEVICE_DISCONNECT: MDRPairedDeviceCommand = 2;
/// Headphones.h:254
pub const MDR_PAIRED_DEVICE_SELECT_PLAYBACK: MDRPairedDeviceCommand = 3;
/// Headphones.h:255
pub const MDR_PAIRED_DEVICE_UNPAIR: MDRPairedDeviceCommand = 4;

/// Headphones.h:257 `typedef uint32_t MDRAlertAction;`
pub type MDRAlertAction = u32;
/// Headphones.h:258
pub const MDR_ALERT_ACTION_NEGATIVE: MDRAlertAction = 0;
/// Headphones.h:259
pub const MDR_ALERT_ACTION_POSITIVE: MDRAlertAction = 1;

/// Headphones.h:261 `typedef uint32_t MDRGeneralSettingType;`
pub type MDRGeneralSettingType = u32;
/// Headphones.h:262
pub const MDR_GENERAL_SETTING_UNKNOWN: MDRGeneralSettingType = 0;
/// Headphones.h:263
pub const MDR_GENERAL_SETTING_BOOLEAN: MDRGeneralSettingType = 1;

/// Headphones.h:265 `typedef uint32_t MDRAssignableAction;`
pub type MDRAssignableAction = u32;
/// Headphones.h:266
pub const MDR_ASSIGNABLE_NONE: MDRAssignableAction = 0;
/// Headphones.h:267
pub const MDR_ASSIGNABLE_PLAYBACK: MDRAssignableAction = 1;
/// Headphones.h:268
pub const MDR_ASSIGNABLE_NOISE_CONTROL: MDRAssignableAction = 2;
/// Headphones.h:269
pub const MDR_ASSIGNABLE_NOISE_CONTROL_QUICK_ACCESS: MDRAssignableAction = 3;
/// Headphones.h:270
pub const MDR_ASSIGNABLE_TRACK_CONTROL: MDRAssignableAction = 4;
/// Headphones.h:271
pub const MDR_ASSIGNABLE_VOICE_RECOGNITION: MDRAssignableAction = 5;
/// Headphones.h:272
pub const MDR_ASSIGNABLE_GOOGLE_ASSISTANT: MDRAssignableAction = 6;
/// Headphones.h:273
pub const MDR_ASSIGNABLE_AMAZON_ALEXA: MDRAssignableAction = 7;
/// Headphones.h:274
pub const MDR_ASSIGNABLE_TENCENT_XIAOWEI: MDRAssignableAction = 8;
/// Headphones.h:275
pub const MDR_ASSIGNABLE_MICROSOFT_CORTANA: MDRAssignableAction = 9;
/// Headphones.h:276
pub const MDR_ASSIGNABLE_QUICK_ACCESS: MDRAssignableAction = 10;
/// Headphones.h:277
pub const MDR_ASSIGNABLE_VOLUME: MDRAssignableAction = 11;
/// Headphones.h:278
pub const MDR_ASSIGNABLE_PLAYBACK_VOICE_ASSISTANT_LIMITATION: MDRAssignableAction = 12;
/// Headphones.h:279
pub const MDR_ASSIGNABLE_TENCENT_XIAOWEI_Q_MSC: MDRAssignableAction = 13;
/// Headphones.h:280
pub const MDR_ASSIGNABLE_TEAMS: MDRAssignableAction = 14;
/// Headphones.h:281
pub const MDR_ASSIGNABLE_GOOGLE_ASSISTANT_BT_CLASSIC_CAUTION: MDRAssignableAction = 15;
/// Headphones.h:282
pub const MDR_ASSIGNABLE_AMAZON_ALEXA_BT_CLASSIC_CAUTION: MDRAssignableAction = 16;
/// Headphones.h:283
pub const MDR_ASSIGNABLE_TENCENT_XIAOWEI_BT_CLASSIC_CAUTION: MDRAssignableAction = 17;
/// Headphones.h:284
pub const MDR_ASSIGNABLE_QUICK_ACCESS_BT_CLASSIC_CAUTION: MDRAssignableAction = 18;
/// Headphones.h:285
pub const MDR_ASSIGNABLE_NOISE_CONTROL_QUICK_ACCESS_BT_CLASSIC_CAUTION: MDRAssignableAction = 19;
/// Headphones.h:286
pub const MDR_ASSIGNABLE_TENCENT_XIAOWEI_Q_MSC_BT_CLASSIC_CAUTION: MDRAssignableAction = 20;
/// Headphones.h:287
pub const MDR_ASSIGNABLE_NOISE_CONTROL_MIC: MDRAssignableAction = 21;
/// Headphones.h:288
pub const MDR_ASSIGNABLE_LISTENING_MODE_QUICK_ACCESS: MDRAssignableAction = 22;
/// Headphones.h:289
pub const MDR_ASSIGNABLE_NOISE_CONTROL_LISTENING_MODE: MDRAssignableAction = 23;
/// Headphones.h:290
pub const MDR_ASSIGNABLE_CHAT_MIX: MDRAssignableAction = 24;
/// Headphones.h:291
pub const MDR_ASSIGNABLE_CUSTOM1: MDRAssignableAction = 25;
/// Headphones.h:292
pub const MDR_ASSIGNABLE_CUSTOM2: MDRAssignableAction = 26;
/// Headphones.h:293
pub const MDR_ASSIGNABLE_UNKNOWN: MDRAssignableAction = 27;

/// Headphones.h:295 `typedef uint32_t MDRWearingPowerMode;`
pub type MDRWearingPowerMode = u32;
/// Headphones.h:296
pub const MDR_WEARING_POWER_UNAVAILABLE: MDRWearingPowerMode = 0;
/// Headphones.h:297
pub const MDR_WEARING_POWER_DISABLED: MDRWearingPowerMode = 1;
/// Headphones.h:298
pub const MDR_WEARING_POWER_WHEN_REMOVED: MDRWearingPowerMode = 2;

/// Headphones.h:300 `typedef uint32_t MDRWearingStatus;`
pub type MDRWearingStatus = u32;
/// Headphones.h:301
pub const MDR_WEARING_STATUS_UNKNOWN: MDRWearingStatus = 0;
/// Headphones.h:302
pub const MDR_WEARING_STATUS_WORN: MDRWearingStatus = 1;
/// Headphones.h:303
pub const MDR_WEARING_STATUS_LEFT_REMOVED: MDRWearingStatus = 2;
/// Headphones.h:304
pub const MDR_WEARING_STATUS_RIGHT_REMOVED: MDRWearingStatus = 3;
/// Headphones.h:305
pub const MDR_WEARING_STATUS_REMOVED: MDRWearingStatus = 4;

/// Headphones.h:307 `typedef uint32_t MDRAudioPriority;`
pub type MDRAudioPriority = u32;
/// Headphones.h:308
pub const MDR_AUDIO_PRIORITY_UNKNOWN: MDRAudioPriority = 0;
/// Headphones.h:309
pub const MDR_AUDIO_PRIORITY_QUALITY: MDRAudioPriority = 1;
/// Headphones.h:310
pub const MDR_AUDIO_PRIORITY_STABILITY: MDRAudioPriority = 2;

/// Headphones.h:408 `typedef uint32_t MDRAssignableActionKeyLocation;`
pub type MDRAssignableActionKeyLocation = u32;
/// Headphones.h:409
pub const MDR_ASSIGNABLE_ACTION_KEY_UNKNOWN: MDRAssignableActionKeyLocation = 0;
/// Headphones.h:410
pub const MDR_ASSIGNABLE_ACTION_KEY_LEFT: MDRAssignableActionKeyLocation = 1;
/// Headphones.h:411
pub const MDR_ASSIGNABLE_ACTION_KEY_RIGHT: MDRAssignableActionKeyLocation = 2;
/// Headphones.h:412
pub const MDR_ASSIGNABLE_ACTION_KEY_CUSTOM: MDRAssignableActionKeyLocation = 3;
/// Headphones.h:413
pub const MDR_ASSIGNABLE_ACTION_KEY_C: MDRAssignableActionKeyLocation = 4;
/// Headphones.h:414
pub const MDR_ASSIGNABLE_ACTION_KEY_NC_AMB: MDRAssignableActionKeyLocation = 5;
/// Headphones.h:415
pub const MDR_ASSIGNABLE_ACTION_KEY_NC_AMBIENT: MDRAssignableActionKeyLocation = 6;

/// Headphones.h:417 `typedef uint32_t MDRAssignableActionKeyType;`
pub type MDRAssignableActionKeyType = u32;
/// Headphones.h:418
pub const MDR_ASSIGNABLE_ACTION_KEY_TYPE_UNKNOWN: MDRAssignableActionKeyType = 0;
/// Headphones.h:419
pub const MDR_ASSIGNABLE_ACTION_KEY_TYPE_TOUCH_SENSOR: MDRAssignableActionKeyType = 1;
/// Headphones.h:420
pub const MDR_ASSIGNABLE_ACTION_KEY_TYPE_BUTTON: MDRAssignableActionKeyType = 2;
/// Headphones.h:421
pub const MDR_ASSIGNABLE_ACTION_KEY_TYPE_FACE_TAP: MDRAssignableActionKeyType = 3;

// ---------------------------------------------------------------------------
// Structs (Headphones.h:313-454)
// ---------------------------------------------------------------------------

/// Headphones.h:313-318
#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
pub struct MDRModel {
    pub protocol_version: u32,
    pub audio_codec: MDRAudioCodec,
    pub model_color: u8,
}

/// Headphones.h:320-327
#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
pub struct MDRBattery {
    pub part: MDRBatteryPart,
    pub present: MDRBoolean,
    pub level_percent: u8,
    pub update_threshold_percent: u8,
    pub charging: MDRChargingState,
}

/// Headphones.h:329-333
#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
pub struct MDRPlayback {
    pub status: MDRPlaybackStatus,
    pub volume: u8,
}

/// Headphones.h:335-338
#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
pub struct MDRPlaybackCommand {
    pub action: MDRPlaybackAction,
}

/// Headphones.h:340-349
#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
pub struct MDRNoiseControl {
    pub mode: MDRNoiseMode,
    pub ambient_level: u8,
    pub changing_asm_level: MDRBoolean,
    pub focus_on_voice: MDRBoolean,
    pub button_mode: MDRNoiseButtonMode,
    pub adaptive_ambient: MDRBoolean,
    pub adaptive_sensitivity: MDRAdaptiveSensitivity,
}

/// Headphones.h:351-356
#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
pub struct MDRSpeakToChat {
    pub enabled: MDRBoolean,
    pub sensitivity: MDRSpeechSensitivity,
    pub timeout: MDRSpeakTimeout,
}

/// Headphones.h:358-362
#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
pub struct MDRListening {
    pub mode: MDRListeningMode,
    pub background_room: MDRRoomSize,
}

/// Headphones.h:364-373
#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
pub struct MDREqualizer {
    pub preset: MDREqualizerPreset,
    pub clear_bass: i8,
    pub band_count: u32,
    pub dsee_enabled: MDRBoolean,
    pub dsee_type: MDRDSEEType,
    pub available: MDRBoolean,
    pub dsee_available: MDRBoolean,
}

/// Headphones.h:375-381
#[repr(C)]
#[derive(Clone, Copy, Debug)]
pub struct MDRPairedDevice {
    pub connected: MDRBoolean,
    pub playback_device: MDRBoolean,
    pub macAddress: [c_char; 18],
    pub name: [c_char; 128],
}

impl Default for MDRPairedDevice {
    fn default() -> Self {
        Self {
            connected: 0,
            playback_device: 0,
            macAddress: [0; 18],
            name: [0; 128],
        }
    }
}

/// Headphones.h:383-388
#[repr(C)]
#[derive(Clone, Copy, Debug)]
pub struct MDRPairedDeviceAction {
    pub command: MDRPairedDeviceCommand,
    pub device_id: *const c_char,
    pub device_id_size: u32,
}

/// Headphones.h:390-393
#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
pub struct MDRPairing {
    pub enabled: MDRBoolean,
}

/// Headphones.h:395-400
#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
pub struct MDRGeneralSettingInfo {
    pub index: u32,
    pub r#type: MDRGeneralSettingType,
    pub writable: MDRBoolean,
}

/// Headphones.h:402-406
#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
pub struct MDRGeneralSetting {
    pub index: u32,
    pub boolean_value: MDRBoolean,
}

/// Headphones.h:423-428
#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
pub struct MDRAssignableControl {
    pub location: MDRAssignableActionKeyLocation,
    pub r#type: MDRAssignableActionKeyType,
    pub action: MDRAssignableAction,
}

/// Headphones.h:430-437
#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
pub struct MDRPower {
    pub auto_power_off_minutes: u32,
    pub wearing_power: MDRWearingPowerMode,
    pub auto_pause: MDRBoolean,
    pub head_gesture: MDRBoolean,
    pub shutdown_requested: MDRBoolean,
}

/// Headphones.h:439-443
#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
pub struct MDRVoiceGuidance {
    pub enabled: MDRBoolean,
    pub volume: i8,
}

/// Headphones.h:445-448
#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
pub struct MDRConnectionMode {
    pub audio_priority: MDRAudioPriority,
}

/// Headphones.h:450-454
#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
pub struct MDRSafeListening {
    pub sound_pressure: u8,
    pub preview: MDRBoolean,
}

/// Headphones.h:457-458 See `mdrHeadphonesSetPacketCallback`.
pub type MDRPacketCallback = Option<
    unsafe extern "C" fn(
        user_data: *mut c_void,
        direction: MDRPacketDirection,
        frame: *const c_uchar,
        frame_size: c_int,
    ),
>;

// ---------------------------------------------------------------------------
// Functions (Headphones.h:485-643)
// ---------------------------------------------------------------------------

extern "C" {
    /// Headphones.h:485 `connection` must already be connected and outlive the instance.
    pub fn mdrHeadphonesCreate(
        abiVersion: u32,
        connection: *mut MDRConnection,
        protocolVersion: MDRProtocolVersion,
        ppHeadphones: *mut *mut MDRHeadphones,
    ) -> MDRResult;
    /// Headphones.h:490
    pub fn mdrHeadphonesDestroy(headphones: *mut MDRHeadphones);
    /// Headphones.h:494
    pub fn mdrHeadphonesIsInitialized(headphones: *const MDRHeadphones) -> MDRBoolean;
    /// Headphones.h:500
    pub fn mdrHeadphonesIsReady(headphones: *const MDRHeadphones) -> MDRBoolean;
    /// Headphones.h:505
    pub fn mdrHeadphonesIsDirty(headphones: *const MDRHeadphones) -> MDRBoolean;
    /// Headphones.h:510 MUST be called prior to other operations.
    pub fn mdrHeadphonesRequestInit(headphones: *mut MDRHeadphones) -> MDRResult;
    /// Headphones.h:517
    pub fn mdrHeadphonesRequestSync(headphones: *mut MDRHeadphones) -> MDRResult;
    /// Headphones.h:524
    pub fn mdrHeadphonesRequestCommit(headphones: *mut MDRHeadphones) -> MDRResult;
    /// Headphones.h:530 Non-blocking; one event per call (`MDR_EVENT_NONE` when idle).
    pub fn mdrHeadphonesPoll(headphones: *mut MDRHeadphones, out_event: *mut MDREvent)
        -> MDRResult;
    /// Headphones.h:535
    pub fn mdrHeadphonesSetTimeout(
        headphones: *mut MDRHeadphones,
        r#type: MDRTimeoutType,
        value: c_int,
    ) -> MDRResult;
    /// Headphones.h:541 NULL callback disables observation.
    pub fn mdrHeadphonesSetPacketCallback(
        headphones: *mut MDRHeadphones,
        callback: MDRPacketCallback,
        user_data: *mut c_void,
    );
    /// Headphones.h:544
    pub fn mdrHeadphonesGetFeature(
        headphones: *mut MDRHeadphones,
        feature: MDRFeature,
        out_availability: *mut MDRFeatureAvailability,
    ) -> MDRResult;
    /// Headphones.h:546 Two-call: NULL buffer with `*inout_size == 0` returns the size incl. NUL.
    pub fn mdrHeadphonesGetText(
        headphones: *mut MDRHeadphones,
        text: MDRText,
        index: u32,
        buffer: *mut c_char,
        inout_size: *mut u32,
    ) -> MDRResult;
    /// Headphones.h:550
    pub fn mdrHeadphonesGetModel(
        headphones: *mut MDRHeadphones,
        out_identity: *mut MDRModel,
    ) -> MDRResult;
    /// Headphones.h:551
    pub fn mdrHeadphonesGetBatteries(
        headphones: *mut MDRHeadphones,
        batteries: *mut MDRBattery,
        inout_count: *mut u32,
    ) -> MDRResult;
    /// Headphones.h:552
    pub fn mdrHeadphonesGetPlayback(
        headphones: *mut MDRHeadphones,
        out_playback: *mut MDRPlayback,
    ) -> MDRResult;
    /// Headphones.h:553
    pub fn mdrHeadphonesSetPlayback(
        headphones: *mut MDRHeadphones,
        playback: *const MDRPlayback,
    ) -> MDRResult;
    /// Headphones.h:554
    pub fn mdrHeadphonesPlayback(
        headphones: *mut MDRHeadphones,
        command: *const MDRPlaybackCommand,
    ) -> MDRResult;
    /// Headphones.h:557
    pub fn mdrHeadphonesGetNoiseControl(
        headphones: *mut MDRHeadphones,
        out_noise_control: *mut MDRNoiseControl,
    ) -> MDRResult;
    /// Headphones.h:558
    pub fn mdrHeadphonesSetNoiseControl(
        headphones: *mut MDRHeadphones,
        noise_control: *const MDRNoiseControl,
    ) -> MDRResult;
    /// Headphones.h:559
    pub fn mdrHeadphonesGetSpeakToChat(
        headphones: *mut MDRHeadphones,
        out_speak_to_chat: *mut MDRSpeakToChat,
    ) -> MDRResult;
    /// Headphones.h:560
    pub fn mdrHeadphonesSetSpeakToChat(
        headphones: *mut MDRHeadphones,
        speak_to_chat: *const MDRSpeakToChat,
    ) -> MDRResult;
    /// Headphones.h:561
    pub fn mdrHeadphonesGetListening(
        headphones: *mut MDRHeadphones,
        out_listening: *mut MDRListening,
    ) -> MDRResult;
    /// Headphones.h:562
    pub fn mdrHeadphonesSetListening(
        headphones: *mut MDRHeadphones,
        listening: *const MDRListening,
    ) -> MDRResult;
    /// Headphones.h:563
    pub fn mdrHeadphonesGetEqualizer(
        headphones: *mut MDRHeadphones,
        out_equalizer: *mut MDREqualizer,
    ) -> MDRResult;
    /// Headphones.h:564
    pub fn mdrHeadphonesSetEqualizer(
        headphones: *mut MDRHeadphones,
        equalizer: *const MDREqualizer,
    ) -> MDRResult;
    /// Headphones.h:565
    pub fn mdrHeadphonesGetEqualizerBands(
        headphones: *mut MDRHeadphones,
        bands: *mut i8,
        inout_count: *mut u32,
    ) -> MDRResult;
    /// Headphones.h:566
    pub fn mdrHeadphonesSetEqualizerBands(
        headphones: *mut MDRHeadphones,
        bands: *const i8,
        count: u32,
    ) -> MDRResult;
    /// Headphones.h:573 Names are `MDR_TEXT_EQUALIZER_PRESET_NAME` indexed like this list.
    pub fn mdrHeadphonesGetEqualizerPresets(
        headphones: *mut MDRHeadphones,
        presets: *mut MDREqualizerPreset,
        inout_count: *mut u32,
    ) -> MDRResult;
    /// Headphones.h:577
    pub fn mdrHeadphonesGetPairedDevices(
        headphones: *mut MDRHeadphones,
        devices: *mut MDRPairedDevice,
        inout_count: *mut u32,
    ) -> MDRResult;
    /// Headphones.h:579
    pub fn mdrHeadphonesSetPairedDevice(
        headphones: *mut MDRHeadphones,
        action: *const MDRPairedDeviceAction,
    ) -> MDRResult;
    /// Headphones.h:580
    pub fn mdrHeadphonesGetPairing(
        headphones: *mut MDRHeadphones,
        out_pairing: *mut MDRPairing,
    ) -> MDRResult;
    /// Headphones.h:581
    pub fn mdrHeadphonesSetPairing(
        headphones: *mut MDRHeadphones,
        pairing: *const MDRPairing,
    ) -> MDRResult;
    /// Headphones.h:592
    pub fn mdrHeadphonesGetSourceSwitchControl(
        headphones: *mut MDRHeadphones,
        out_enabled: *mut MDRBoolean,
    ) -> MDRResult;
    /// Headphones.h:593
    pub fn mdrHeadphonesSetSourceSwitchControl(
        headphones: *mut MDRHeadphones,
        enabled: MDRBoolean,
    ) -> MDRResult;
    /// Headphones.h:605
    pub fn mdrHeadphonesGetSourceSwitchControlResult(
        headphones: *mut MDRHeadphones,
        out_result: *mut MDRSourceSwitchControlResult,
    ) -> MDRResult;
    /// Headphones.h:614 `MDR_RESULT_ERROR_NOT_FOUND` if the device has not asked anything.
    pub fn mdrHeadphonesRequestRespondToAlert(
        headphones: *mut MDRHeadphones,
        action: MDRAlertAction,
    ) -> MDRResult;
    /// Headphones.h:617
    pub fn mdrHeadphonesGetGeneralSettingInfo(
        headphones: *mut MDRHeadphones,
        settings: *mut MDRGeneralSettingInfo,
        inout_count: *mut u32,
    ) -> MDRResult;
    /// Headphones.h:619
    pub fn mdrHeadphonesGetGeneralSetting(
        headphones: *mut MDRHeadphones,
        index: u32,
        out_setting: *mut MDRGeneralSetting,
    ) -> MDRResult;
    /// Headphones.h:621
    pub fn mdrHeadphonesSetGeneralSetting(
        headphones: *mut MDRHeadphones,
        setting: *const MDRGeneralSetting,
    ) -> MDRResult;
    /// Headphones.h:622
    pub fn mdrHeadphonesGetAssignableControls(
        headphones: *mut MDRHeadphones,
        out_controls: *mut MDRAssignableControl,
        inout_count: *mut u32,
    ) -> MDRResult;
    /// Headphones.h:624
    pub fn mdrHeadphonesGetAssignableControlActions(
        headphones: *mut MDRHeadphones,
        key: MDRAssignableActionKeyLocation,
        out_options: *mut MDRAssignableAction,
        inout_count: *mut u32,
    ) -> MDRResult;
    /// Headphones.h:627
    pub fn mdrHeadphonesSetAssignableControls(
        headphones: *mut MDRHeadphones,
        controls: *const MDRAssignableControl,
        count: u32,
    ) -> MDRResult;
    /// Headphones.h:631
    pub fn mdrHeadphonesGetPower(
        headphones: *mut MDRHeadphones,
        out_power: *mut MDRPower,
    ) -> MDRResult;
    /// Headphones.h:632
    pub fn mdrHeadphonesSetPower(
        headphones: *mut MDRHeadphones,
        power: *const MDRPower,
    ) -> MDRResult;
    /// Headphones.h:633
    pub fn mdrHeadphonesGetVoiceGuidance(
        headphones: *mut MDRHeadphones,
        out_voice_guidance: *mut MDRVoiceGuidance,
    ) -> MDRResult;
    /// Headphones.h:634
    pub fn mdrHeadphonesSetVoiceGuidance(
        headphones: *mut MDRHeadphones,
        voice_guidance: *const MDRVoiceGuidance,
    ) -> MDRResult;
    /// Headphones.h:635
    pub fn mdrHeadphonesGetConnectionMode(
        headphones: *mut MDRHeadphones,
        out_mode: *mut MDRConnectionMode,
    ) -> MDRResult;
    /// Headphones.h:636
    pub fn mdrHeadphonesSetConnectionMode(
        headphones: *mut MDRHeadphones,
        mode: *const MDRConnectionMode,
    ) -> MDRResult;
    /// Headphones.h:637
    pub fn mdrHeadphonesGetSafeListening(
        headphones: *mut MDRHeadphones,
        out_safe_listening: *mut MDRSafeListening,
    ) -> MDRResult;
    /// Headphones.h:638
    pub fn mdrHeadphonesSetSafeListening(
        headphones: *mut MDRHeadphones,
        safe_listening: *const MDRSafeListening,
    ) -> MDRResult;
    /// Headphones.h:643 Requires `MDR_FEATURE_WEARING_STATUS`.
    pub fn mdrHeadphonesGetWearingStatus(
        headphones: *mut MDRHeadphones,
        out_status: *mut MDRWearingStatus,
    ) -> MDRResult;
}
