import { useMemo } from "react";
import type { EqualizerCardProps } from "../../components/equalizer/EqualizerCard";
import type { DseeRowProps } from "../../components/sound/DseeRow";
import { dseeIds, presetIds, presetLabel } from "../../lib/engine/ids";
import { hasFeature, type Snapshot } from "../../lib/engine/types";
import { useEngine } from "../../state/engineContext";
import { useEngineSend, useSliderCommand } from "./useEngineCommand";

/** Upstream shows Clear Bass only `if (gState.mEqualizerBands.size() == 5)`. */
const CLEAR_BASS_BAND_COUNT = 5;

/** The values both Sound cards show; the hook adds the callbacks. */
export function toEqualizerValues(snapshot: Snapshot) {
  const eq = snapshot.equalizer;
  if (!eq) return { equalizer: null, dsee: null };
  const equalizer = hasFeature(snapshot, "EQUALIZER")
    ? {
        presets: (snapshot.equalizerPresets ?? []).map((preset) => ({
          id: presetIds.toId(preset.id),
          name: presetLabel(preset.id, preset.name),
        })),
        presetId: presetIds.toId(eq.preset),
        bands: eq.bands,
        clearBass: eq.bands.length === CLEAR_BASS_BAND_COUNT ? eq.clearBass : undefined,
        available: eq.available,
      }
    : null;
  const dsee = hasFeature(snapshot, "DSEE")
    ? { available: eq.dseeAvailable, enabled: eq.dseeEnabled, type: dseeIds.toId(eq.dseeType) }
    : null;
  return { equalizer, dsee };
}

export interface EqualizerProps {
  equalizer?: EqualizerCardProps;
  dsee?: DseeRowProps;
}

/**
 * The Sound page's cards from `equalizer` and `equalizerPresets`: presets in
 * the device's order, named by the device or, when it sent no name (the XM4),
 * by upstream's English names; the bands; Clear Bass only with five bands;
 * `available`; and DSEE (`dseeAvailable`, `dseeEnabled`, `dseeType`). A preset
 * pick sends `setEqualizerPreset` with the camelCase id; bands send the whole
 * array with `setEqualizerBands` and Clear Bass `setClearBass`, both live
 * (throttled) and on commit; the switch sends `setDsee`. Each part is left out
 * when its feature (`EQUALIZER`, `DSEE`) is not available.
 */
export function useEqualizerProps(): EqualizerProps {
  const snapshot = useEngine((state) => state.payload?.snapshot ?? null);
  const send = useEngineSend();
  const bands = useSliderCommand("setEqualizerBands", (value: number[]) => ({ type: "setEqualizerBands", bands: value }));
  const clearBass = useSliderCommand("setClearBass", (value: number) => ({ type: "setClearBass", level: value }));

  return useMemo(() => {
    if (!snapshot) return {};
    const values = toEqualizerValues(snapshot);
    return {
      equalizer: values.equalizer
        ? {
            ...values.equalizer,
            onPresetChange: (id: number) => send({ type: "setEqualizerPreset", preset: presetIds.toName(id) }),
            onBandsChange: bands.onChange,
            onBandsCommit: bands.onCommit,
            onBandsGestureChange: bands.onGestureChange,
            onClearBassChange: clearBass.onChange,
            onClearBassCommit: clearBass.onCommit,
            onClearBassGestureChange: clearBass.onGestureChange,
          }
        : undefined,
      dsee: values.dsee
        ? { ...values.dsee, onChange: (enabled: boolean) => send({ type: "setDsee", enabled }) }
        : undefined,
    };
  }, [snapshot, send, bands, clearBass]);
}
