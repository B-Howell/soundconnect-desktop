/**
 * The engine sends libmdr enums as camelCase names (`"bright"`, `"hx"`) or, for
 * a value this build does not know, as the raw number. The presentational
 * components (Tasks 14-16) take the raw `MDR_*` numbers from
 * `libmdr/include/mdr-c/Headphones.h`. These tables convert between the two,
 * in header order (the order `src-tauri/crates/mdr/src/enums.rs` generates).
 */
import type {
  AssignableActionName,
  AudioCodec,
  DseeTypeName,
  Enum,
  EqualizerPresetName,
  KeyLocationName,
  KeyTypeName,
} from "./types";

/** A name -> number table plus its inverse; numbers pass straight through. */
export interface IdTable<Name extends string> {
  toId(value: Enum<Name>): number;
  /** The camelCase name for a known id, else the number itself (the engine accepts either). */
  toName(id: number): Enum<Name>;
}

export function idTable<Name extends string>(entries: Record<Name, number>): IdTable<Name> {
  const byId = new Map<number, Name>();
  for (const [name, id] of Object.entries(entries) as [Name, number][]) byId.set(id, name);
  return {
    toId: (value) => (typeof value === "number" ? value : entries[value]),
    toName: (id) => byId.get(id) ?? id,
  };
}

/** `MDR_EQ_*` (Headphones.h 212-242). */
export const presetIds = idTable<EqualizerPresetName>({
  off: 0,
  rock: 1,
  pop: 2,
  jazz: 3,
  dance: 4,
  edm: 5,
  rAndBHipHop: 6,
  acoustic: 7,
  bright: 8,
  excited: 9,
  mellow: 10,
  relaxed: 11,
  vocal: 12,
  treble: 13,
  bass: 14,
  speech: 15,
  heavy: 16,
  clear: 17,
  hard: 18,
  soft: 19,
  gaming: 20,
  fps1: 21,
  fps2: 22,
  fps3: 23,
  custom: 24,
  user1: 25,
  user2: 26,
  user3: 27,
  user4: 28,
  user5: 29,
  unknown: 255,
});

/** `MDR_DSEE_*` (Headphones.h 245-249). */
export const dseeIds = idTable<DseeTypeName>({ unknown: 0, standard: 1, hx: 2, hxAi: 3, ultimate: 4 });

/** `MDR_ASSIGNABLE_ACTION_KEY_*` (Headphones.h 409-415). */
export const keyLocationIds = idTable<KeyLocationName>({
  unknown: 0,
  left: 1,
  right: 2,
  custom: 3,
  c: 4,
  ncAmb: 5,
  ncAmbient: 6,
});

/** `MDR_ASSIGNABLE_ACTION_KEY_TYPE_*` (Headphones.h 418-421). */
export const keyTypeIds = idTable<KeyTypeName>({ unknown: 0, touchSensor: 1, button: 2, faceTap: 3 });

/** `MDR_ASSIGNABLE_*` (Headphones.h 266-294): NONE 0 through CUSTOM2 26, UNKNOWN 27. */
export const assignableActionIds = idTable<AssignableActionName>({
  none: 0,
  playback: 1,
  noiseControl: 2,
  noiseControlQuickAccess: 3,
  trackControl: 4,
  voiceRecognition: 5,
  googleAssistant: 6,
  amazonAlexa: 7,
  tencentXiaowei: 8,
  microsoftCortana: 9,
  quickAccess: 10,
  volume: 11,
  playbackVoiceAssistantLimitation: 12,
  tencentXiaoweiQMsc: 13,
  teams: 14,
  googleAssistantBtClassicCaution: 15,
  amazonAlexaBtClassicCaution: 16,
  tencentXiaoweiBtClassicCaution: 17,
  quickAccessBtClassicCaution: 18,
  noiseControlQuickAccessBtClassicCaution: 19,
  tencentXiaoweiQMscBtClassicCaution: 20,
  noiseControlMic: 21,
  listeningModeQuickAccess: 22,
  noiseControlListeningMode: 23,
  chatMix: 24,
  custom1: 25,
  custom2: 26,
  unknown: 27,
});

/**
 * English preset names from upstream `FormatEqualizerPreset` (client/Client.cpp)
 * and `client/I18N/Default.cpp` (`_Def(EqBright, "Bright")` ...). Upstream uses
 * them when the device advertised a preset without a name, as the XM4 does.
 */
const presetNames: Record<EqualizerPresetName, string> = {
  off: "Off",
  rock: "Rock",
  pop: "Pop",
  jazz: "Jazz",
  dance: "Dance",
  edm: "EDM",
  rAndBHipHop: "R&B/Hip-Hop",
  acoustic: "Acoustic",
  bright: "Bright",
  excited: "Excited",
  mellow: "Mellow",
  relaxed: "Relaxed",
  vocal: "Vocal",
  treble: "Treble",
  bass: "Bass",
  speech: "Speech",
  heavy: "Heavy",
  clear: "Clear",
  hard: "Hard",
  soft: "Soft",
  gaming: "Gaming",
  fps1: "FPS 1",
  fps2: "FPS 2",
  fps3: "FPS 3",
  custom: "Custom",
  user1: "User Setting 1",
  user2: "User Setting 2",
  user3: "User Setting 3",
  user4: "User Setting 4",
  user5: "User Setting 5",
  unknown: "Unknown",
};

/** The device's name when it sent one, else upstream's English name, else "Preset n". */
export function presetLabel(id: Enum<EqualizerPresetName>, deviceName = ""): string {
  if (deviceName) return deviceName;
  if (typeof id === "number") return `Preset ${id}`;
  return presetNames[id];
}

const codecLabels: Record<string, string> = {
  sbc: "SBC",
  aac: "AAC",
  ldac: "LDAC",
  aptx: "aptX",
  aptxHd: "aptX HD",
  lc3: "LC3",
};

/** The codec as Sony and Qualcomm write it, or undefined when the engine does not know it. */
export function codecLabel(codec: AudioCodec | undefined): string | undefined {
  return typeof codec === "string" ? codecLabels[codec] : undefined;
}
