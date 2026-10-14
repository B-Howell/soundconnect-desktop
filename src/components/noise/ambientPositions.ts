import { AMBIENT_LEVEL_MAX, AMBIENT_LEVEL_MIN, type NoiseMode, type NoiseModeAvailability } from "./noiseModes";

/**
 * One stop of Sony's Ambient Sound Control slider. In the Sony app the
 * slider's leftmost stops are "Noise canceling" and "Wind Noise Reduction",
 * then ambient sound levels 1 to 20; this is that list.
 */
export type AmbientPosition = { kind: "cancelling" } | { kind: "wind" } | { kind: "ambient"; level: number };

/**
 * The slider's stops for a device: noise cancelling (with `canCancel`), wind
 * noise reduction (with `canWind`), then levels 1..20 (with `canAmbient`).
 * On the recorded XM4 that is 22 stops: index 0 cancelling, 1 wind, and index
 * n (2..21) ambient level n - 1.
 */
export function ambientPositions({ canCancel, canAmbient, canWind }: NoiseModeAvailability): AmbientPosition[] {
  const positions: AmbientPosition[] = [];
  if (canCancel) positions.push({ kind: "cancelling" });
  if (canCancel && canWind) positions.push({ kind: "wind" });
  if (canAmbient) {
    for (let level = AMBIENT_LEVEL_MIN; level <= AMBIENT_LEVEL_MAX; level++) positions.push({ kind: "ambient", level });
  }
  return positions;
}

/** What a stop is called, in the Sony app's words (an ambient stop by its level alone, under the "Ambient sound level" label). */
export function ambientPositionLabel(position: AmbientPosition): string {
  switch (position.kind) {
    case "cancelling":
      return "Noise cancelling";
    case "wind":
      return "Wind noise reduction";
    case "ambient":
      return String(position.level);
  }
}

/**
 * The stop that shows a mode: cancelling and wind their own stops, ambient
 * the stop of its level (clamped to 1..20; a device reporting 0 reads as 1).
 * Off has no stop, and neither does a mode the list lacks: -1.
 */
export function ambientPositionIndex(positions: readonly AmbientPosition[], mode: NoiseMode, level: number): number {
  if (mode === "off") return -1;
  if (mode === "ambient") {
    const clamped = Math.min(Math.max(Math.round(level), AMBIENT_LEVEL_MIN), AMBIENT_LEVEL_MAX);
    return positions.findIndex((p) => p.kind === "ambient" && p.level === clamped);
  }
  return positions.findIndex((p) => p.kind === mode);
}
