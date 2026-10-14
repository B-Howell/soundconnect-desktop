/**
 * Equalizer value domains from the upstream C API and client.
 * `mdrHeadphonesGetEqualizerBands` returns `int8_t` bands; the upstream
 * ImGui client (`ImEqualizer` in client/Client.cpp) draws 5 bands at
 * -10..10 and 10 bands at -6..6, and Clear Bass (`MDREqualizer.clear_bass`,
 * `int8_t`) at -10..10, shown only next to 5 bands.
 */

export interface ValueRange {
  min: number;
  max: number;
}

export const CLEAR_BASS_RANGE: ValueRange = { min: -10, max: 10 };

const fiveBandLabels = ["400 Hz", "1 kHz", "2.5 kHz", "6.3 kHz", "16 kHz"];
const tenBandLabels = ["31 Hz", "63 Hz", "125 Hz", "250 Hz", "500 Hz", "1 kHz", "2 kHz", "4 kHz", "8 kHz", "16 kHz"];

/**
 * The band range upstream uses for this many bands: 5 bands -10..10, 10
 * bands -6..6. Any other count has no known range: upstream shows "EQ
 * Unavailable (bands={0})" and draws no sliders, so this returns null.
 */
export function defaultBandRange(count: number): ValueRange | null {
  if (count === 5) return { min: -10, max: 10 };
  if (count === 10) return { min: -6, max: 6 };
  return null;
}

/** Upstream's centre frequencies for 5 and 10 bands, otherwise "Band 1", "Band 2" ... */
export function defaultBandLabels(count: number): string[] {
  if (count === 5) return fiveBandLabels;
  if (count === 10) return tenBandLabels;
  return Array.from({ length: count }, (_, index) => `Band ${index + 1}`);
}

/** A signed step: "+3", "0", "−2" (a true minus sign, the width of the plus). */
export function formatSignedStep(value: number): string {
  const rounded = Math.round(value);
  if (rounded > 0) return `+${rounded}`;
  if (rounded < 0) return `−${-rounded}`;
  return "0";
}
