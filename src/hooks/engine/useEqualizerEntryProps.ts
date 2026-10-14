import { useMemo } from "react";
import type { EqualizerEntryCardProps } from "../../components/equalizer/EqualizerEntryCard";
import { curveSeries } from "../../components/equalizer/eqCurve";
import { CLEAR_BASS_RANGE, defaultBandLabels, defaultBandRange, formatSignedStep } from "../../components/equalizer/equalizerBands";
import { useEqualizerProps } from "./useEqualizerProps";
import { usePresetCurves } from "./usePresetCurves";

/**
 * The Sound page's Equalizer entry card, without its `onOpen`: the current
 * preset's name, "Clear Bass n" when the device has it, and the curve, the
 * preset's recorded one (`usePresetCurves`) or, for a listener-edited preset
 * or a model without a fixture, the live bands. Null without the equalizer.
 */
export function useEqualizerEntryProps(): Omit<EqualizerEntryCardProps, "onOpen"> | null {
  const { equalizer } = useEqualizerProps();
  const curves = usePresetCurves(equalizer?.presets, equalizer?.clearBass !== undefined);
  return useMemo(() => {
    if (!equalizer) return null;
    const { bands, clearBass, presets, presetId } = equalizer;
    const range = equalizer.bandRange ?? defaultBandRange(bands.length) ?? CLEAR_BASS_RANGE;
    const recorded = curves.get(presetId);
    const live = curveSeries(bands, equalizer.bandLabels ?? defaultBandLabels(bands.length), clearBass).values;
    return {
      presetName: presets.find((preset) => preset.id === presetId)?.name ?? "Custom",
      detail: !equalizer.available
        ? "Unavailable in this listening mode"
        : clearBass !== undefined
          ? `Clear Bass ${formatSignedStep(clearBass)}`
          : undefined,
      curve: recorded ?? live,
      range,
    };
  }, [equalizer, curves]);
}
