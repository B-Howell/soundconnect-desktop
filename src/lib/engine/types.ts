/**
 * The engine contract as TypeScript: every type mirrors a Rust serde shape
 * field for field, so the recorded payload in
 * `tests/fixtures/snapshots/xm4-ready.json` parses as `SnapshotPayload`.
 *
 * Sources (the contract):
 * - `src-tauri/crates/mdr/src/snapshot.rs` (`Snapshot`, `Texts`) and
 *   `types.rs` (the nested structs), all `#[serde(rename_all = "camelCase")]`;
 *   every reader is `Option`, so a field is `null` when libmdr refused it.
 * - `src-tauri/crates/mdr/src/enums.rs`: known variants serialize as camelCase
 *   strings, `Unrecognized(n)` as the number `n`, and deserialization accepts
 *   either form. Hence `Enum<"a" | "b">` below.
 * - `src-tauri/src/engine_service.rs` (`StatusView`, `SnapshotPayload`,
 *   `AlertView`, `DeviceView`, `EngineCommand`) and `noise_view.rs` (`NoiseView`).
 *
 * See docs/core/SoundConnect Desktop - Core Services.md.
 */

/** A libmdr enum: a known camelCase name, or the raw number for a value this build does not know. */
export type Enum<Known extends string> = Known | number;

/** `mdr::Protocol` (serialized as the variant name). */
export type Protocol = "V1" | "V2";

export type Availability = Enum<"unknown" | "unavailable" | "available">;
export type AudioCodec = Enum<"unknown" | "sbc" | "aac" | "ldac" | "aptx" | "aptxHd" | "lc3" | "other">;
export type BatteryPart = Enum<"main" | "left" | "right" | "case">;
export type ChargingState = Enum<"unknown" | "no" | "yes" | "complete">;
export type PlaybackStatusName = Enum<"unknown" | "stopped" | "playing" | "paused">;
export type PlaybackAction = "play" | "pause" | "next" | "previous";
export type NoiseModeName = Enum<"off" | "cancelling" | "ambient">;
export type AdaptiveSensitivity = Enum<"unknown" | "low" | "standard" | "high">;
export type NoiseButtonMode = Enum<"none" | "noiseAmbientOff" | "noiseAmbient" | "noiseOff" | "ambientOff">;
export type SpeechSensitivity = Enum<"unknown" | "auto" | "low" | "high">;
export type SpeakTimeout = Enum<"unknown" | "short" | "medium" | "long" | "manual">;
export type ListeningMode = Enum<"standard" | "backgroundMusic" | "cinema" | "voiceBoost" | "soundLeakageReduction">;
export type RoomSize = Enum<"unknown" | "small" | "medium" | "large">;
export type EqualizerPresetName =
  | "off"
  | "rock"
  | "pop"
  | "jazz"
  | "dance"
  | "edm"
  | "rAndBHipHop"
  | "acoustic"
  | "bright"
  | "excited"
  | "mellow"
  | "relaxed"
  | "vocal"
  | "treble"
  | "bass"
  | "speech"
  | "heavy"
  | "clear"
  | "hard"
  | "soft"
  | "gaming"
  | "fps1"
  | "fps2"
  | "fps3"
  | "custom"
  | "user1"
  | "user2"
  | "user3"
  | "user4"
  | "user5"
  | "unknown";
export type EqualizerPresetId = Enum<EqualizerPresetName>;
export type DseeTypeName = "unknown" | "standard" | "hx" | "hxAi" | "ultimate";
export type DseeType = Enum<DseeTypeName>;
export type AlertAction = Enum<"negative" | "positive">;
export type GeneralSettingType = Enum<"unknown" | "boolean">;
export type AssignableActionName =
  | "none"
  | "playback"
  | "noiseControl"
  | "noiseControlQuickAccess"
  | "trackControl"
  | "voiceRecognition"
  | "googleAssistant"
  | "amazonAlexa"
  | "tencentXiaowei"
  | "microsoftCortana"
  | "quickAccess"
  | "volume"
  | "playbackVoiceAssistantLimitation"
  | "tencentXiaoweiQMsc"
  | "teams"
  | "googleAssistantBtClassicCaution"
  | "amazonAlexaBtClassicCaution"
  | "tencentXiaoweiBtClassicCaution"
  | "quickAccessBtClassicCaution"
  | "noiseControlQuickAccessBtClassicCaution"
  | "tencentXiaoweiQMscBtClassicCaution"
  | "noiseControlMic"
  | "listeningModeQuickAccess"
  | "noiseControlListeningMode"
  | "chatMix"
  | "custom1"
  | "custom2"
  | "unknown";
export type AssignableAction = Enum<AssignableActionName>;
export type WearingPowerMode = Enum<"unavailable" | "disabled" | "whenRemoved">;
export type WearingStatus = Enum<"unknown" | "worn" | "leftRemoved" | "rightRemoved" | "removed">;
export type AudioPriority = Enum<"unknown" | "quality" | "stability">;
export type KeyLocationName = "unknown" | "left" | "right" | "custom" | "c" | "ncAmb" | "ncAmbient";
export type KeyLocation = Enum<KeyLocationName>;
export type KeyTypeName = "unknown" | "touchSensor" | "button" | "faceTap";
export type KeyType = Enum<KeyTypeName>;

export interface Model {
  protocolVersion: number;
  audioCodec: AudioCodec;
  modelColor: number;
}

export interface Battery {
  part: BatteryPart;
  present: boolean;
  levelPercent: number;
  updateThresholdPercent: number;
  charging: ChargingState;
}

export interface Playback {
  status: PlaybackStatusName;
  volume: number;
}

/** The raw `MDRNoiseControl`; on V1 `ambientLevel` 255 is cancelling and 0 wind. The UI reads `NoiseView`. */
export interface NoiseControl {
  mode: NoiseModeName;
  ambientLevel: number;
  changingAsmLevel: boolean;
  focusOnVoice: boolean;
  buttonMode: NoiseButtonMode;
  adaptiveAmbient: boolean;
  adaptiveSensitivity: AdaptiveSensitivity;
}

export interface SpeakToChat {
  enabled: boolean;
  sensitivity: SpeechSensitivity;
  timeout: SpeakTimeout;
}

export interface Listening {
  mode: ListeningMode;
  backgroundRoom: RoomSize;
}

export interface Equalizer {
  preset: EqualizerPresetId;
  clearBass: number;
  bandCount: number;
  dseeEnabled: boolean;
  dseeType: DseeType;
  available: boolean;
  dseeAvailable: boolean;
  bands: number[];
}

export interface EqualizerPreset {
  id: EqualizerPresetId;
  /** The device's name for it; empty when it sent none (the XM4 sends none). */
  name: string;
}

export interface PairedDevice {
  connected: boolean;
  playbackDevice: boolean;
  macAddress: string;
  name: string;
}

export interface Pairing {
  enabled: boolean;
}

export interface GeneralSettingInfo {
  index: number;
  kind: GeneralSettingType;
  writable: boolean;
}

export interface GeneralSetting {
  index: number;
  info: GeneralSettingInfo;
  value: boolean;
  /** A text key such as `TOUCH_PANEL_SETTING`, not display text. */
  subject: string;
  /** A text key such as `MULTIPOINT_SETTING_SUMMARY`, or empty. */
  summary: string;
}

export interface AssignableControl {
  location: KeyLocation;
  kind: KeyType;
  action: AssignableAction;
  /** Functions this location accepts (`#[serde(default)]`: may be empty). */
  options: AssignableAction[];
}

export interface Power {
  autoPowerOffMinutes: number;
  wearingPower: WearingPowerMode;
  autoPause: boolean;
  headGesture: boolean;
  shutdownRequested: boolean;
}

export interface VoiceGuidance {
  enabled: boolean;
  volume: number;
}

export interface ConnectionMode {
  audioPriority: AudioPriority;
}

export interface SafeListening {
  soundPressure: number;
  preview: boolean;
}

export interface Texts {
  modelName: string | null;
  firmwareVersion: string | null;
  uniqueId: string | null;
  modelSeries: string | null;
  modelColor: string | null;
  lastAlert: string | null;
  trackTitle: string | null;
  trackAlbum: string | null;
  trackArtist: string | null;
}

/** `mdr::Feature` keys as `Snapshot.features` names them (`MDR_FEATURE_` stripped). */
export type FeatureName =
  | "IDENTITY"
  | "BATTERY_SINGLE"
  | "BATTERY_LEFT_RIGHT"
  | "BATTERY_CASE"
  | "PLAYBACK_METADATA"
  | "PLAYBACK_CONTROL"
  | "PLAYBACK_VOLUME"
  | "NOISE_CANCELLING"
  | "AMBIENT_SOUND"
  | "ADAPTIVE_AMBIENT_SOUND"
  | "SPEAK_TO_CHAT"
  | "LISTENING_MODE"
  | "EQUALIZER"
  | "DSEE"
  | "PAIRED_DEVICE_MANAGEMENT"
  | "PAIRING_MODE"
  | "GENERAL_SETTINGS"
  | "ASSIGNABLE_CONTROLS"
  | "NOISE_CONTROL_BUTTON"
  | "AUTO_POWER_OFF"
  | "WEARING_DETECTION"
  | "AUTO_PAUSE"
  | "HEAD_GESTURE"
  | "VOICE_GUIDANCE"
  | "VOICE_GUIDANCE_VOLUME"
  | "SHUTDOWN"
  | "CONNECTION_MODE"
  | "SAFE_LISTENING"
  | "SOURCE_SWITCH_CONTROL"
  | "LISTENING_BACKGROUND_MUSIC"
  | "LISTENING_CINEMA"
  | "LISTENING_VOICE_BOOST"
  | "LISTENING_SOUND_LEAKAGE_REDUCTION"
  | "WEARING_STATUS";

/** `mdr::Snapshot`: everything the engine knows at one instant. */
export interface Snapshot {
  protocol: Protocol;
  initialized: boolean;
  /** True once the first sync finished; snapshots are also published while initialising. */
  ready: boolean;
  dirty: boolean;
  model: Model | null;
  batteries: Battery[] | null;
  playback: Playback | null;
  noiseControl: NoiseControl | null;
  speakToChat: SpeakToChat | null;
  listening: Listening | null;
  equalizer: Equalizer | null;
  equalizerPresets: EqualizerPreset[] | null;
  pairedDevices: PairedDevice[] | null;
  pairing: Pairing | null;
  sourceSwitchControl: boolean | null;
  generalSettings: GeneralSetting[] | null;
  assignableControls: AssignableControl[] | null;
  power: Power | null;
  voiceGuidance: VoiceGuidance | null;
  connectionMode: ConnectionMode | null;
  safeListening: SafeListening | null;
  wearingStatus: WearingStatus | null;
  /** Keyed by feature name (a `BTreeMap<String, Availability>`); unknown keys may appear. */
  features: Partial<Record<FeatureName, Availability>>;
  texts: Texts;
}

/** `noise_view::NoiseViewMode`. `wind` exists only on protocol V1. */
export type NoiseViewMode = "off" | "cancelling" | "ambient" | "wind";

/** `noise_view::NoiseView`: noise control normalised across protocols; never the raw V1 byte. */
export interface NoiseView {
  mode: NoiseViewMode;
  /** Always 1..20: the current level in ambient, else the level ambient would resume at. */
  ambientLevel: number;
  focusOnVoice: boolean;
  canCancel: boolean;
  canAmbient: boolean;
  canWind: boolean;
  canFocusOnVoice: boolean;
}

/** `engine:snapshot` payload (`SnapshotPayload`). */
export interface SnapshotPayload {
  snapshot: Snapshot;
  /** `null` when the device reports no noise control. */
  noiseView: NoiseView | null;
}

/** `engine_service::ConnState` (`rename_all = "lowercase"`). */
export type ConnectionState = "disconnected" | "discovering" | "connecting" | "initialising" | "ready";

/**
 * The headphones the engine remembers (the last device that connected), so
 * the app can name them and offer Connect before anything is in range.
 */
export interface RememberedDevice {
  address: string;
  /** The Bluetooth name Windows shows. */
  name: string;
  /** `texts.modelName` from the last session ("" when unknown), for the product image and pairing hints. */
  modelName: string;
  /** "" when unknown. */
  firmware: string;
  protocol: Protocol;
  /** Unix time in milliseconds of the last Ready. */
  lastSeen: number;
}

/** Why a connect attempt failed (`engine:status` `reason`, with `state: "disconnected"`). */
export type ConnectFailureReason = "notConnectedToWindows" | "busy" | "timeout" | "refused";

/**
 * `engine:status` `reason`: a failure (with `disconnected`), or
 * `reconnectingAfterSettingChange` (with `connecting` / `initialising`): the
 * headphones dropped the link to apply a setting (connection quality) and the
 * engine is reconnecting by itself for up to 20 s.
 */
export type StatusReason = ConnectFailureReason | "reconnectingAfterSettingChange";

/** `engine:status` payload (`StatusView`); absent keys are omitted (`skip_serializing_if = "Option::is_none"`). */
export interface EngineStatus {
  state: ConnectionState;
  deviceName?: string;
  address?: string;
  protocol?: Protocol;
  lastError?: string;
  /** The remembered headphones; `null` (or absent) before any device has connected or after "Forget". */
  remembered?: RememberedDevice | null;
  /** Set on `disconnected` after a failed connect, and on `connecting` while reconnecting after a setting change. */
  reason?: StatusReason;
}

/** One device in an `engine:devices` event (the answer to `scan`). */
export interface ScannedDevice {
  address: string;
  name: string;
  /** True for the remembered headphones. */
  remembered: boolean;
}

/** `engine:devices` payload. */
export interface DevicesEvent {
  devices: ScannedDevice[];
}

/**
 * The engine's own question before a connection-quality change: the
 * WH-1000XM4 applies it by dropping Bluetooth for a few seconds
 * (docs/core/evidence/toggle-dropouts-debug.md). OK sends the change, Not now
 * keeps the current setting; afterwards the engine reconnects by itself.
 */
export const CONFIRM_CONNECTION_MODE_CHANGE = "CONFIRM_CONNECTION_MODE_CHANGE";

/**
 * `engine:alert` payload (`AlertView`); `autoResponse` is set when the service
 * already answered it, and `requiresChoice` is true when it waits for
 * `respondToAlert` (a device yes/no question, or the engine's own
 * `CONFIRM_CONNECTION_MODE_CHANGE` before a connection-quality change).
 */
export interface AlertEvent {
  message: string;
  autoResponse: AlertAction | null;
  requiresChoice?: boolean;
}

/** `engine_devices` item (`DeviceView`). */
export interface DeviceInfo {
  address: string;
  name: string;
}

/** Speak-to-Chat sensitivities a write accepts (the snapshot may also report `unknown`). */
export type SpeakToChatSensitivity = "auto" | "low" | "high";
/** Speak-to-Chat close timeouts a write accepts: about 5 s, 15 s, 30 s, or never. */
export type SpeakToChatTimeout = "short" | "medium" | "long" | "manual";
/** Bluetooth connection quality a write accepts. */
export type AudioPriorityChoice = "quality" | "stability";
/** What `setPairedDevice` asks the headphones to do with one paired device (`deviceId` is its MAC address). */
export type PairedDeviceAction = "connect" | "disconnect" | "selectPlayback" | "unpair";

/**
 * `engine_service::EngineCommand`: `#[serde(tag = "type", rename_all = "camelCase",
 * rename_all_fields = "camelCase")]`. Optional fields are Rust `Option`s.
 */
export type EngineCommand =
  | { type: "setNoise"; mode: NoiseViewMode; ambientLevel?: number; focusOnVoice?: boolean }
  | { type: "setAmbientLevel"; level: number }
  | { type: "setFocusOnVoice"; enabled: boolean }
  | { type: "setEqualizerPreset"; preset: EqualizerPresetId }
  | { type: "setEqualizerBands"; bands: number[] }
  | { type: "setClearBass"; level: number }
  | { type: "setDsee"; enabled: boolean }
  | { type: "playback"; action: PlaybackAction }
  | { type: "setVolume"; volume: number }
  | {
      type: "setPower";
      autoPowerOffMinutes?: number;
      wearingPower?: WearingPowerMode;
      autoPause?: boolean;
      headGesture?: boolean;
    }
  | { type: "setVoiceGuidance"; enabled: boolean; volume?: number }
  | { type: "setGeneralSetting"; index: number; value: boolean }
  | { type: "setAssignableControls"; controls: AssignableControl[] }
  | { type: "setSpeakToChat"; enabled: boolean; sensitivity: SpeakToChatSensitivity; timeout: SpeakToChatTimeout }
  | { type: "setConnectionMode"; audioPriority: AudioPriorityChoice }
  | { type: "setPairedDevice"; command: PairedDeviceAction; deviceId: string }
  | { type: "setPairing"; enabled: boolean }
  | { type: "setAutoPause"; enabled: boolean }
  | { type: "setMultipoint"; enabled: boolean }
  | { type: "powerOff" }
  | { type: "respondToAlert"; positive: boolean }
  | { type: "disconnect" }
  | { type: "reconnect" }
  | { type: "connect"; address: string }
  | { type: "scan" }
  | { type: "forgetDevice"; address: string }
  | { type: "setAutoConnect"; enabled: boolean }
  | { type: "openBluetoothSettings" };

export type EngineCommandType = EngineCommand["type"];

/** True when the snapshot reports `feature` available. */
export function hasFeature(snapshot: Snapshot, feature: FeatureName): boolean {
  return snapshot.features[feature] === "available";
}
