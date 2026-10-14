/**
 * The `winaudio` crate's model as the renderer receives it (serde camelCase):
 * `src-tauri/crates/winaudio/src/model.rs`. Recorded instance:
 * `src-tauri/fixtures/winaudio/test-pc.json`.
 */

export type EndpointState = "active" | "disabled" | "notPresent" | "unplugged";
export type Flow = "render" | "capture";
export type DuckingMode = "muteOthers" | "reduce80" | "reduce50" | "doNothing";
/**
 * The page's two modes (the crate's `FixKind`): "Stereo audio" (games, music,
 * video; headphone mic off) or "Mono audio with mic" (the hands-free profile).
 */
export type FixKind = "stereo" | "monoMic";
export type SpatialSound = "off" | "on" | "unknown";

export interface Endpoint {
  id: string;
  name: string;
  state: EndpointState;
  bluetooth: boolean;
}

export interface DefaultEndpoint {
  id: string;
  name: string;
  isThisDevice: boolean;
}

export interface AudioFormat {
  sampleRate: number;
  bitsPerSample: number;
  channels: number;
}

export interface Adapter {
  name: string;
  driverVersion: string | null;
  powerSavingAllowed: boolean | null;
}

export interface WinAudioSnapshot {
  address: string;
  stereo: Endpoint | null;
  handsFreeRender: Endpoint | null;
  handsFreeCapture: Endpoint | null;
  handsFreeOffered: boolean;
  handsFreeEnabled: boolean | null;
  defaultRender: DefaultEndpoint | null;
  defaultCommunicationsRender: DefaultEndpoint | null;
  defaultCapture: DefaultEndpoint | null;
  defaultCommunicationsCapture: DefaultEndpoint | null;
  captureEndpoints: Endpoint[];
  enhancementsEnabled: boolean | null;
  spatialSound: SpatialSound | string;
  monoAudio: boolean;
  defaultFormat: AudioFormat | null;
  exclusiveModeAllowed: boolean | null;
  exclusivePriority: boolean | null;
  duckingMode: DuckingMode;
  absoluteVolumeDisabled: boolean;
  windowsVolumePercent: number | null;
  adapter: Adapter | null;
  bluetoothServiceRunning: boolean | null;
  codec: string | null;
  wifi24Active: boolean | null;
  errors: string[];
}

/** One allow-listed change (`Change`, tagged by `kind`). */
export type Change =
  | { kind: "setDefaultEndpoint"; flow: Flow; communications: boolean; id: string; name: string }
  | { kind: "useHandsFreeForCommunications"; address: string }
  | { kind: "setEnhancements"; endpointId: string; enabled: boolean }
  | { kind: "setFormat"; endpointId: string; sampleRate: number; bitsPerSample: number }
  | { kind: "setExclusiveMode"; endpointId: string; allowed: boolean; priority: boolean }
  | { kind: "setDucking"; mode: DuckingMode }
  | { kind: "setMonoAudio"; enabled: boolean }
  | { kind: "setHandsFree"; address: string; enabled: boolean }
  | { kind: "setAbsoluteVolumeDisabled"; disabled: boolean }
  | { kind: "setAdapterPowerSaving"; allowed: boolean };

/** The kinds the elevated helper runs (`Change::needs_admin`). */
const ADMIN_KINDS: ReadonlySet<Change["kind"]> = new Set([
  "setHandsFree",
  "setAbsoluteVolumeDisabled",
  "setAdapterPowerSaving",
]);

export function needsAdmin(change: Change): boolean {
  return ADMIN_KINDS.has(change.kind);
}

export interface ChangeResult {
  change: Change;
  /** The write call succeeded. */
  applied: boolean;
  /** The value read back afterwards matches. */
  verified: boolean;
  error: string | null;
}

export interface PlannedChange {
  change: Change;
  /** One plain sentence for the preview. */
  summary: string;
  admin: boolean;
}

export interface Plan {
  changes: PlannedChange[];
  notes: string[];
}

/** Windows Settings pages the app may open (`winaudio_open_settings`). */
export type SettingsPage = "sound" | "accessibility";
