/**
 * The Windows audio page's model: four cards of rows from a snapshot. Each
 * row has the live state, the recommended state for music, one plain
 * sentence, and a control that yields the `Change` to apply. Pure, so it is
 * tested on the recording of the maintainer's PC.
 *
 * `ok`: the live state matches the recommendation (`null` when there is no
 * single right answer, or it cannot be known now). `counts`: a mismatch
 * counts toward "Needs attention" (the "Fix for music" items and a stopped
 * Bluetooth service; advisory rows such as power saving do not).
 */
import type { Change, DuckingMode, SettingsPage, WinAudioSnapshot } from "./types";

export interface PickerOption {
  value: string;
  label: string;
}

export type RowControl =
  | { type: "toggle"; checked: boolean; disabled?: boolean; change: (checked: boolean) => Change }
  | { type: "picker"; value: string; options: PickerOption[]; change: (value: string) => Change }
  | { type: "action"; label: string; change: Change }
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
  id: "calls" | "processing" | "format" | "connection";
  title: string;
  rows: SettingRow[];
}

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

function callsCard(s: WinAudioSnapshot): SettingCard {
  const stereo = s.stereo;
  const connected = stereo?.state === "active";
  const isStereo = (id: string | undefined) => !!stereo && id?.toLowerCase() === stereo.id.toLowerCase();
  const defaultRow = (id: string, title: string, description: string, communications: boolean): SettingRow => {
    const current = communications ? s.defaultCommunicationsRender : s.defaultRender;
    const ok = connected ? isStereo(current?.id) : null;
    return {
      id,
      title,
      description,
      current: current?.name ?? "None",
      recommended: stereo?.name ?? "The headphones",
      ok,
      counts: true,
      admin: false,
      control:
        connected && stereo && !ok
          ? {
              type: "action",
              label: "Use headphones",
              change: { kind: "setDefaultEndpoint", flow: "render", communications, id: stereo.id, name: stereo.name },
            }
          : { type: "none" },
    };
  };

  const mics = [...s.captureEndpoints];
  if (s.handsFreeCapture && !mics.some((m) => m.id === s.handsFreeCapture?.id)) mics.push(s.handsFreeCapture);
  const callsMic = s.defaultCommunicationsCapture;

  return {
    id: "calls",
    title: "Calls vs music",
    rows: [
      {
        id: "handsFree",
        title: "Hands-Free (mono call audio)",
        description:
          "When on, any app that uses the headphone mic switches all sound to mono call quality. Turn off for music; turn on to use the headphone mic.",
        current: s.handsFreeOffered ? onOff(s.handsFreeEnabled) : "Not offered",
        recommended: "Off",
        ok: s.handsFreeEnabled == null ? null : !s.handsFreeEnabled,
        counts: true,
        admin: true,
        control: {
          type: "toggle",
          checked: s.handsFreeEnabled === true,
          disabled: !s.handsFreeOffered || s.handsFreeEnabled == null,
          change: (enabled) => ({ kind: "setHandsFree", address: s.address, enabled }),
        },
      },
      defaultRow("defaultPlayback", "Default playback", "Where music, games and videos play.", false),
      defaultRow(
        "callsPlayback",
        "Playback for calls",
        "Where call apps play. The headphones' Headset (Hands-Free) here pulls them into mono.",
        true,
      ),
      {
        id: "callsMic",
        title: "Microphone for calls",
        description: "The mic call apps use. A mic other than the headphones' keeps music in stereo during calls.",
        current: callsMic?.name ?? "None",
        recommended: "Not the headphones",
        ok: callsMic ? !callsMic.isThisDevice : null,
        counts: true,
        admin: false,
        control:
          mics.length > 0
            ? {
                type: "picker",
                value: callsMic?.id ?? "",
                options: mics.map((m) => ({ value: m.id, label: m.name })),
                change: (id) => ({
                  kind: "setDefaultEndpoint",
                  flow: "capture",
                  communications: true,
                  id,
                  name: mics.find((m) => m.id === id)?.name ?? id,
                }),
              }
            : { type: "none" },
      },
    ],
  };
}

function processingCard(s: WinAudioSnapshot): SettingCard {
  const stereo = s.stereo;
  const ducking = DUCKING_OPTIONS.find((o) => o.value === s.duckingMode)?.label ?? s.duckingMode;
  return {
    id: "processing",
    title: "Processing",
    rows: [
      {
        id: "enhancements",
        title: "Audio enhancements",
        description:
          "Windows effects applied before the sound reaches your headphones. Off lets Sony's EQ and DSEE work on the original sound.",
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
        description: "Virtual surround on top of the music. Off for music. Windows lets only its own Settings change it.",
        current: s.spatialSound === "on" ? "On" : s.spatialSound === "off" ? "Off" : "Unknown",
        recommended: "Off",
        ok: s.spatialSound === "on" ? false : s.spatialSound === "off" ? true : null,
        counts: true,
        admin: false,
        control: { type: "openSettings", page: "sound" },
      },
      {
        id: "mono",
        title: "Mono audio",
        description: "Plays the same mix in both ears. Music loses its stereo image.",
        current: onOff(s.monoAudio),
        recommended: "Off",
        ok: !s.monoAudio,
        counts: true,
        admin: false,
        control: { type: "toggle", checked: s.monoAudio, change: (enabled) => ({ kind: "setMonoAudio", enabled }) },
      },
      {
        id: "ducking",
        title: "Lower other sounds during calls",
        description: "Windows turns music down when a call app starts. \"Do nothing\" keeps your volume.",
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
    ],
  };
}

function formatCard(s: WinAudioSnapshot): SettingCard {
  const stereo = s.stereo;
  const format = s.defaultFormat;
  const exclusive = exclusiveValue(s);
  return {
    id: "format",
    title: "Format and volume",
    rows: [
      {
        id: "format",
        title: "Format",
        description: "The rate Windows mixes everything to. 48 kHz suits games and video; 44.1 kHz suits most music.",
        current: format ? `${khz(format.sampleRate)}, ${format.bitsPerSample}-bit` : "Unknown",
        recommended: "48 kHz",
        ok: null,
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
        description: "Lets one app take the headphones for itself. Little gain over Bluetooth, and it can silence everything else.",
        current: EXCLUSIVE_OPTIONS.find((o) => o.value === exclusive)?.label ?? "Unknown",
        recommended: "Allowed, with priority",
        ok: null,
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
        id: "absoluteVolume",
        title: "Absolute volume",
        description: "One volume for Windows and the headphones. Keep on. A change applies after the headphones reconnect.",
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
      {
        id: "volume",
        title: "Windows volume",
        description: "Windows' slider for the headphones. With absolute volume on, it is the headphones' own volume.",
        current: s.windowsVolumePercent == null ? "Not playing" : `${s.windowsVolumePercent}%`,
        recommended: null,
        ok: null,
        counts: false,
        admin: false,
        control: { type: "none" },
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
        title: "Codec",
        description: "Reported by the headphones. Windows sends SBC or AAC; LDAC needs other drivers.",
        current: s.codec ?? "Unknown",
        recommended: null,
        ok: null,
        counts: false,
        admin: false,
        control: { type: "none" },
      },
      {
        id: "adapter",
        title: "Bluetooth adapter",
        description: adapter?.driverVersion
          ? `Driver ${adapter.driverVersion}. Updates come from Windows Update or the PC maker.`
          : "The PC's Bluetooth radio.",
        current: adapter?.name ?? "Not found",
        recommended: null,
        ok: null,
        counts: false,
        admin: false,
        control: { type: "none" },
      },
      {
        id: "powerSaving",
        title: "Let Windows turn off the adapter",
        description: "Saves power, but can cause slow reconnects or a dropout after idle. Off keeps Bluetooth awake.",
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
        title: "Bluetooth Support Service",
        description: "The Windows service Bluetooth needs. Windows starts it when needed.",
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
        description: "Shares the air with Bluetooth. Use 5 GHz Wi-Fi or Ethernet if the sound stutters.",
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

/** The page's four cards, in order. */
export function winAudioCards(snapshot: WinAudioSnapshot): SettingCard[] {
  return [callsCard(snapshot), processingCard(snapshot), formatCard(snapshot), connectionCard(snapshot)];
}

/** Rows that count toward "Needs attention" and do not match the recommendation. */
export function attentionCount(cards: readonly SettingCard[]): number {
  return cards.flatMap((c) => c.rows).filter((r) => r.counts && r.ok === false).length;
}
