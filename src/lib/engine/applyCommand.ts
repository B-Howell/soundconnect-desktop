/**
 * What a device command does to a snapshot payload, as a pure function. The
 * mock engine applies it to its local copy (so the UI responds in a browser),
 * and the store applies it as an optimistic patch until the device's own
 * snapshot confirms it.
 *
 * Noise control follows `src-tauri/src/noise_view.rs` `noise_request`: on V1
 * `cancelling` is mode ON (== `cancelling`) with level 255, `wind` ON with 0,
 * `ambient` ON with the level clamped to 1..20, `off` mode OFF; on V2 `mode`
 * carries the effect and `wind` is rejected (left unchanged here).
 * `noiseView.ambientLevel` keeps the last ambient level outside ambient.
 */
import type { EngineCommand, NoiseControl, NoiseView, NoiseViewMode, PairedDevice, SnapshotPayload } from "./types";

export const AMBIENT_MIN = 1;
export const AMBIENT_MAX = 20;
const V1_LEVEL_CANCELLING = 255;
const V1_LEVEL_WIND = 0;

const clampLevel = (level: number): number => Math.min(Math.max(Math.round(level), AMBIENT_MIN), AMBIENT_MAX);

interface NoiseRequest {
  mode: NoiseViewMode;
  level?: number;
  focus?: boolean;
}

function applyNoise(payload: SnapshotPayload, { mode, level, focus }: NoiseRequest): SnapshotPayload {
  const view = payload.noiseView;
  const raw = payload.snapshot.noiseControl;
  if (!view) return payload;
  const v1 = payload.snapshot.protocol === "V1";
  if (mode === "wind" && !v1) return payload;
  const ambientLevel = mode === "ambient" ? clampLevel(level ?? view.ambientLevel) : view.ambientLevel;
  const focusOnVoice = focus ?? view.focusOnVoice;
  const noiseView: NoiseView = { ...view, mode, ambientLevel, focusOnVoice };
  let noiseControl: NoiseControl | null = raw;
  if (raw) {
    const next: NoiseControl = { ...raw, changingAsmLevel: false, focusOnVoice };
    if (mode === "off") next.mode = "off";
    else if (v1) {
      next.mode = "cancelling";
      next.ambientLevel = mode === "cancelling" ? V1_LEVEL_CANCELLING : mode === "wind" ? V1_LEVEL_WIND : ambientLevel;
    } else {
      next.mode = mode === "ambient" ? "ambient" : "cancelling";
      if (mode === "ambient") next.ambientLevel = ambientLevel;
    }
    noiseControl = next;
  }
  return { noiseView, snapshot: { ...payload.snapshot, noiseControl } };
}

type Snap = SnapshotPayload["snapshot"];

/** Replaces one snapshot field when it is present (a `null` field stays null). */
function patchField<K extends keyof Snap>(
  payload: SnapshotPayload,
  key: K,
  update: (value: NonNullable<Snap[K]>) => Snap[K],
): SnapshotPayload {
  const value = payload.snapshot[key];
  if (value === null || value === undefined) return payload;
  return { ...payload, snapshot: { ...payload.snapshot, [key]: update(value as NonNullable<Snap[K]>) } };
}

/** The payload as it should look once the device has applied `command`. Service commands change nothing. */
export function applyCommand(payload: SnapshotPayload, command: EngineCommand): SnapshotPayload {
  switch (command.type) {
    case "setNoise":
      return applyNoise(payload, { mode: command.mode, level: command.ambientLevel, focus: command.focusOnVoice });
    case "setAmbientLevel":
      return applyNoise(payload, { mode: "ambient", level: command.level });
    case "setFocusOnVoice":
      return payload.noiseView
        ? applyNoise(payload, { mode: payload.noiseView.mode, focus: command.enabled })
        : payload;
    case "setEqualizerPreset":
      return patchField(payload, "equalizer", (eq) => ({ ...eq, preset: command.preset }));
    case "setEqualizerBands":
      return patchField(payload, "equalizer", (eq) => ({ ...eq, bands: [...command.bands] }));
    case "setClearBass":
      return patchField(payload, "equalizer", (eq) => ({ ...eq, clearBass: command.level }));
    case "setDsee":
      return patchField(payload, "equalizer", (eq) => ({ ...eq, dseeEnabled: command.enabled }));
    case "playback":
      if (command.action !== "play" && command.action !== "pause") return payload;
      return patchField(payload, "playback", (p) => ({
        ...p,
        status: command.action === "play" ? "playing" : "paused",
      }));
    case "setVolume":
      return patchField(payload, "playback", (p) => ({ ...p, volume: command.volume }));
    case "setPower": {
      const { type: _type, ...fields } = command;
      const defined = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
      return patchField(payload, "power", (p) => ({ ...p, ...defined }));
    }
    case "setVoiceGuidance":
      return patchField(payload, "voiceGuidance", (v) => ({
        enabled: command.enabled,
        volume: command.volume ?? v.volume,
      }));
    case "setGeneralSetting":
      return patchField(payload, "generalSettings", (settings) =>
        settings.map((s) => (s.index === command.index ? { ...s, value: command.value } : s)),
      );
    case "setAssignableControls":
      return patchField(payload, "assignableControls", (controls) =>
        command.controls.map((next) => {
          const current = controls.find((c) => c.location === next.location);
          // The device reports the options per location; a write may leave them out.
          return { ...next, options: next.options.length > 0 ? next.options : (current?.options ?? []) };
        }),
      );
    case "setSpeakToChat":
      return patchField(payload, "speakToChat", () => ({
        enabled: command.enabled,
        sensitivity: command.sensitivity,
        timeout: command.timeout,
      }));
    case "setConnectionMode":
      return patchField(payload, "connectionMode", () => ({ audioPriority: command.audioPriority }));
    case "setPairedDevice":
      return patchField(payload, "pairedDevices", (devices) => applyPairedDevice(devices, command));
    case "setPairing":
      return patchField(payload, "pairing", () => ({ enabled: command.enabled }));
    case "setAutoPause":
      return patchField(payload, "power", (p) => ({ ...p, autoPause: command.enabled }));
    case "setMultipoint":
      return patchField(payload, "generalSettings", (settings) =>
        settings.map((s) => (s.subject === MULTIPOINT_SUBJECT ? { ...s, value: command.enabled } : s)),
      );
    case "powerOff":
    case "respondToAlert":
    case "disconnect":
    case "reconnect":
    case "connect":
    case "scan":
    case "forgetDevice":
    case "setAutoConnect":
    case "openBluetoothSettings":
      return payload;
  }
}

/** The general setting that carries "Connect to 2 devices simultaneously" (`setMultipoint` writes it). */
export const MULTIPOINT_SUBJECT = "MULTIPOINT_SETTING";

/**
 * A paired-device action as the device list will report it once done:
 * connect marks the device connected; disconnect clears connected and
 * playback; selectPlayback makes it the only playback device (it must be
 * connected); unpair removes it.
 */
function applyPairedDevice(
  devices: PairedDevice[],
  command: Extract<EngineCommand, { type: "setPairedDevice" }>,
): PairedDevice[] {
  const id = command.deviceId;
  switch (command.command) {
    case "connect":
      return devices.map((d) => (d.macAddress === id ? { ...d, connected: true } : d));
    case "disconnect":
      return devices.map((d) => (d.macAddress === id ? { ...d, connected: false, playbackDevice: false } : d));
    case "selectPlayback":
      return devices.map((d) => ({ ...d, playbackDevice: d.macAddress === id && d.connected }));
    case "unpair":
      return devices.filter((d) => d.macAddress !== id);
  }
}

/** The patch slot shared by `setNoise` and `setAmbientLevel` (hold it while the ambient slider moves). */
export const NOISE_SLOT = "noise";

/**
 * The optimistic-patch slot a command occupies: a newer command for the same
 * slot replaces the older patch. Null for commands with no visible effect to
 * predict (next / previous track, service commands, power off, alert answers).
 */
export function commandKey(command: EngineCommand): string | null {
  switch (command.type) {
    case "playback":
      return command.action === "play" || command.action === "pause" ? "playback.status" : null;
    case "setGeneralSetting":
      return `setGeneralSetting.${command.index}`;
    // The noise segment and the ambient slider both choose the mode (the
    // slider's two lowest positions send setNoise): one slot, newest wins.
    case "setNoise":
    case "setAmbientLevel":
      return NOISE_SLOT;
    // Connecting, disconnecting and unpairing take the device seconds and may
    // fail; the list shows only what the headphones report (the Devices page
    // shows a pending line meanwhile).
    case "setPairedDevice":
      return null;
    case "setPower":
      return `setPower.${Object.keys(command)
        .filter((k) => k !== "type" && command[k as keyof typeof command] !== undefined)
        .sort()
        .join(",")}`;
    case "powerOff":
    case "respondToAlert":
    case "disconnect":
    case "reconnect":
    case "connect":
    case "scan":
    case "forgetDevice":
    case "setAutoConnect":
    case "openBluetoothSettings":
      return null;
    default:
      return command.type;
  }
}

/** Raw noise bytes and the dirty flag are engine bookkeeping, not what the user sees. */
function visible(payload: SnapshotPayload): unknown {
  const { noiseControl: _raw, dirty: _dirty, ...rest } = payload.snapshot;
  return { ...rest, noiseView: payload.noiseView };
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** True when `payload` already shows what `command` would change (the device confirmed it). */
export function reflects(payload: SnapshotPayload, command: EngineCommand): boolean {
  return deepEqual(visible(applyCommand(payload, command)), visible(payload));
}
