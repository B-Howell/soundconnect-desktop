import type { SegmentedOption } from "../primitives/SegmentedControl";

/**
 * The noise modes as the engine's `noiseView.mode` names them
 * (`src-tauri/src/noise_view.rs` `NoiseViewMode`): the three `MDR_NOISE_MODE_*`
 * effects plus wind-noise reduction, which protocol V1 devices (XM3 / XM4)
 * encode as noise control on with ambient level 0.
 */
export type NoiseMode = "off" | "cancelling" | "ambient" | "wind";

/**
 * The three choices of Sony's Ambient Sound Control switch. Wind-noise
 * reduction is not one of them: in the Sony app it is a slider position next
 * to noise cancelling, so it shows here as "Noise cancelling".
 */
export type NoiseSegment = "cancelling" | "ambient" | "off";

/** Which modes the connected device supports. */
export interface NoiseModeAvailability {
  canCancel: boolean;
  canAmbient: boolean;
  /** Wind-noise reduction (`noiseView.canWind`: V1 devices with noise cancelling). */
  canWind?: boolean;
}

/** Ambient sound level range as the Sony app and the upstream client's slider show it. */
export const AMBIENT_LEVEL_MIN = 1;
export const AMBIENT_LEVEL_MAX = 20;

/** The switch position a mode shows as: wind-noise reduction is a kind of noise cancelling. */
export function noiseSegmentFor(mode: NoiseMode): NoiseSegment {
  return mode === "wind" ? "cancelling" : mode;
}

const allSegments: readonly SegmentedOption<NoiseSegment>[] = [
  { value: "cancelling", label: "Noise cancelling", icon: "noise-cancelling" },
  { value: "ambient", label: "Ambient sound", icon: "ambient" },
  { value: "off", label: "Off", icon: "power" },
];

const offered: Record<NoiseSegment, (a: NoiseModeAvailability) => boolean> = {
  cancelling: (a) => a.canCancel,
  ambient: (a) => a.canAmbient,
  off: () => true,
};

/** Segments in the Sony app's order without the modes the device lacks; Off is always offered. */
export function availableNoiseSegments(availability: NoiseModeAvailability): SegmentedOption<NoiseSegment>[] {
  return allSegments.filter((option) => offered[option.value](availability));
}
