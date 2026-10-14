/**
 * The Windows audio page's model, from a snapshot: which of the two modes
 * Windows is in ("Stereo audio" or "Mono audio with mic"), what has drifted
 * from that mode, and three cards of the remaining settings. Each row has
 * the live state, the recommended state, one plain sentence, and a control
 * that yields the `Change` to apply. Pure, so it is tested on the recording
 * of the maintainer's PC.
 *
 * `ok`: the live state matches the recommendation (`null` when it cannot be
 * known now). `counts`: a mismatch counts toward "Needs attention" (the
 * items the stereo plan puts right and a stopped Bluetooth service; advisory
 * rows such as power saving, format and 2.4 GHz Wi-Fi do not).
 */
import type { Change, DuckingMode, FixKind, SettingsPage, WinAudioSnapshot } from "./types";

export interface PickerOption {
  value: string;
  label: string;
}

export type RowControl =
  | { type: "toggle"; checked: boolean; disabled?: boolean; change: (checked: boolean) => Change }
  | { type: "picker"; value: string; options: PickerOption[]; change: (value: string) => Change }
  | { type: "openSettings"; page: SettingsPage }
  | { type: "none" };

export interface SettingRow {
  id: string;
  title: string;
  description: string;
  current: string;
  /** null when the row only reports a fact. */
  recommended: string | null;
  ok: boolean | null;
  counts: boolean;
  /** Changing it needs the elevated helper (shield glyph, Windows prompt). */
  admin: boolean;
  control: RowControl;
}

export interface SettingCard {
  id: "processing" | "format" | "connection";
  title: string;
  rows: SettingRow[];
}

/** The two modes as the page names them. */
export const MODE_LABELS: Record<FixKind, string> = {
  stereo: "Stereo audio",
  monoMic: "Mono audio with mic",
};

const onOff = (value: boolean | null | undefined, unknown = "Unknown"): string =>
  value == null ? unknown : value ? "On" : "Off";

export const DUCKING_OPTIONS: { value: DuckingMode; label: string }[] = [
  { value: "muteOthers", label: "Mute all other sounds" },
  { value: "reduce80", label: "Reduce by 80%" },
  { value: "reduce50", label: "Reduce by 50%" },
  { value: "doNothing", label: "Do nothing" },
];

const EXCLUSIVE_OPTIONS: PickerOption[] = [
  { value: "off", label: "Off" },
  { value: "allowed", label: "Allowed" },
  { value: "priority", label: "Allowed, with priority" },
];

const RATES = [44_100, 48_000];

export function khz(rate: number): string {
  return `${rate % 1000 === 0 ? rate / 1000 : (rate / 1000).toFixed(1)} kHz`;
}

function exclusiveValue(s: WinAudioSnapshot): string {
  if (s.exclusiveModeAllowed === false) return "off";
  return s.exclusivePriority === false ? "allowed" : "priority";
}

/** The mode Windows is in: the hands-free profile on means "Mono audio with mic". */
export function audioMode(s: WinAudioSnapshot): FixKind {
  return s.handsFreeEnabled === true ? "monoMic" : "stereo";
}

const sameId = (a: string | undefined, b: string | undefined) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/**
 * What differs from the current mode's setup, one plain line each (the
 * mode's plan puts them right). Stereo: the headphones as both playback
 * defaults while connected, and no headphone mic as a default (it would pull
 * the link into mono). Mono with mic: voice chat on the headphones'
 * hands-free audio and mic once Windows lists them.
 */
export function modeDrift(s: WinAudioSnapshot, mode: FixKind = audioMode(s)): string[] {
  const drift: string[] = [];
  if (mode === "stereo") {
    const stereo = s.stereo;
    if (stereo?.state === "active") {
      if (!sameId(s.defaultRender?.id, stereo.id)) drift.push("The headphones aren't the default playback device.");
      if (!sameId(s.defaultCommunicationsRender?.id, stereo.id)) {
        drift.push("Calls don't play on the headphones' stereo output.");
      }
    }
    if (s.defaultCapture?.isThisDevice || s.defaultCommunicationsCapture?.isThisDevice) {
      drift.push("The headphone mic is a default microphone (forces mono).");
    }
  } else if (s.handsFreeRender && s.handsFreeCapture) {
    const render = sameId(s.defaultCommunicationsRender?.id, s.handsFreeRender.id);
    const capture = sameId(s.defaultCommunicationsCapture?.id, s.handsFreeCapture.id);
    if (!(render && capture)) drift.push("Voice chat doesn't use the headphone mic.");
  }
  return drift;
}

function processingCard(s: WinAudioSnapshot): SettingCard {
  const stereo = s.stereo;
  return {
    id: "processing",
    title: "Processing",
    rows: [
      {
        id: "enhancements",
        title: "Audio enhancements",
        description: "Windows effects on top of Sony's EQ and DSEE.",
        current: onOff(s.enhancementsEnabled),
        recommended: "Off",
        ok: s.enhancementsEnabled == null ? null : !s.enhancementsEnabled,
        counts: true,
        admin: false,
        control: stereo
          ? {
              type: "toggle",
              checked: s.enhancementsEnabled === true,
              disabled: s.enhancementsEnabled == null,
              change: (enabled) => ({ kind: "setEnhancements", endpointId: stereo.id, enabled }),
            }
          : { type: "none" },
      },
      {
        id: "spatial",
        title: "Spatial sound",
        description: "Virtual surround, set in Windows Settings.",
        current: s.spatialSound === "on" ? "On" : s.spatialSound === "off" ? "Off" : "Unknown",
        recommended: "Off",
        ok: s.spatialSound === "on" ? false : s.spatialSound === "off" ? true : null,
        counts: true,
        admin: false,
        control: { type: "openSettings", page: "sound" },
      },
      {
        id: "monoMix",
        title: "Mono mix (accessibility)",
        description: "Same sound in both ears, for one-ear listening.",
        current: onOff(s.monoAudio),
        recommended: "Off",
        ok: !s.monoAudio,
        counts: true,
        admin: false,
        control: { type: "toggle", checked: s.monoAudio, change: (enabled) => ({ kind: "setMonoAudio", enabled }) },
      },
    ],
  };
}

function formatCard(s: WinAudioSnapshot): SettingCard {
  const stereo = s.stereo;
  const format = s.defaultFormat;
  const exclusive = exclusiveValue(s);
  const ducking = DUCKING_OPTIONS.find((o) => o.value === s.duckingMode)?.label ?? s.duckingMode;
  return {
    id: "format",
    title: "Format and volume",
    rows: [
      {
        id: "format",
        title: "Default format",
        description: "The rate Windows mixes all audio to.",
        current: format ? `${khz(format.sampleRate)}, ${format.bitsPerSample}-bit` : "Unknown",
        recommended: "48 kHz",
        ok: format ? format.sampleRate === 48_000 : null,
        counts: false,
        admin: false,
        control:
          stereo && format
            ? {
                type: "picker",
                value: String(format.sampleRate),
                options: RATES.map((r) => ({ value: String(r), label: `${khz(r)}, 16-bit` })),
                change: (rate) => ({
                  kind: "setFormat",
                  endpointId: stereo.id,
                  sampleRate: Number(rate),
                  bitsPerSample: 16,
                }),
              }
            : { type: "none" },
      },
      {
        id: "exclusive",
        title: "Exclusive mode",
        description: "Lets one app take over the headphones.",
        current: EXCLUSIVE_OPTIONS.find((o) => o.value === exclusive)?.label ?? "Unknown",
        recommended: "Allowed, with priority",
        ok: s.exclusiveModeAllowed == null ? null : exclusive === "priority",
        counts: false,
        admin: false,
        control: stereo
          ? {
              type: "picker",
              value: exclusive,
              options: EXCLUSIVE_OPTIONS,
              change: (value) => ({
                kind: "setExclusiveMode",
                endpointId: stereo.id,
                allowed: value !== "off",
                priority: value === "priority",
              }),
            }
          : { type: "none" },
      },
      {
        id: "ducking",
        title: "Lower other sounds during calls",
        description: "Turns other audio down when a voice app starts.",
        current: ducking,
        recommended: "Do nothing",
        ok: s.duckingMode === "doNothing",
        counts: true,
        admin: false,
        control: {
          type: "picker",
          value: s.duckingMode,
          options: DUCKING_OPTIONS,
          change: (mode) => ({ kind: "setDucking", mode: mode as DuckingMode }),
        },
      },
      {
        id: "absoluteVolume",
        title: "Absolute volume",
        description: "One volume for Windows and the headphones; applies after reconnecting.",
        current: onOff(!s.absoluteVolumeDisabled),
        recommended: "On",
        ok: !s.absoluteVolumeDisabled,
        counts: true,
        admin: true,
        control: {
          type: "toggle",
          checked: !s.absoluteVolumeDisabled,
          change: (on) => ({ kind: "setAbsoluteVolumeDisabled", disabled: !on }),
        },
      },
    ],
  };
}

function connectionCard(s: WinAudioSnapshot): SettingCard {
  const adapter = s.adapter;
  return {
    id: "connection",
    title: "Connection",
    rows: [
      {
        id: "codec",
        title: "Codec reported by headphones",
        description: "Windows sends SBC or AAC.",
        current: s.codec ?? "Unknown",
        recommended: null,
        ok: null,
        counts: false,
        admin: false,
        control: { type: "none" },
      },
      {
        id: "powerSaving",
        title: "Adapter power saving",
        description: "Can cause dropouts and slow reconnects.",
        current: onOff(adapter?.powerSavingAllowed),
        recommended: "Off",
        ok: adapter?.powerSavingAllowed == null ? null : !adapter.powerSavingAllowed,
        counts: false,
        admin: true,
        control:
          adapter?.powerSavingAllowed == null
            ? { type: "none" }
            : {
                type: "toggle",
                checked: adapter.powerSavingAllowed,
                change: (allowed) => ({ kind: "setAdapterPowerSaving", allowed }),
              },
      },
      {
        id: "service",
        title: "Bluetooth service",
        description: "Required for Bluetooth.",
        current: s.bluetoothServiceRunning == null ? "Unknown" : s.bluetoothServiceRunning ? "Running" : "Stopped",
        recommended: "Running",
        ok: s.bluetoothServiceRunning,
        counts: true,
        admin: false,
        control: { type: "none" },
      },
      {
        id: "wifi",
        title: "2.4 GHz Wi-Fi",
        description: "Can interfere with Bluetooth audio.",
        current: s.wifi24Active == null ? "Unknown" : s.wifi24Active ? "In use" : "Not in use",
        recommended: "Not in use",
        ok: s.wifi24Active == null ? null : !s.wifi24Active,
        counts: false,
        admin: false,
        control: { type: "none" },
      },
    ],
  };
}

/** The page's three cards of settings, in order. */
export function winAudioCards(snapshot: WinAudioSnapshot): SettingCard[] {
  return [processingCard(snapshot), formatCard(snapshot), connectionCard(snapshot)];
}

/**
 * "Needs attention (n)": the mode's drift plus rows that count and do not
 * match the recommendation.
 */
export function attentionCount(cards: readonly SettingCard[], drift: readonly string[] = []): number {
  return drift.length + cards.flatMap((c) => c.rows).filter((r) => r.counts && r.ok === false).length;
}
