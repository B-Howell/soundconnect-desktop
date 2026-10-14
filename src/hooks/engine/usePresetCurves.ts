import { useMemo } from "react";
import type { EqualizerPreset } from "../../components/equalizer/PresetPicker";
import { eqPresetTableFor, presetCurve } from "../../lib/devices/eqPresets";
import { presetIds } from "../../lib/engine/ids";
import { useEngine } from "../../state/engineContext";

/**
 * The recorded curve of each advertised preset for the connected model and
 * firmware (`eqPresets.ts`), by preset id: Clear Bass first when the device
 * has it, then the bands; `null` for a listener-edited preset (Custom, User
 * Setting n). A preset the fixture lacks is left out; a model without a
 * fixture yields an empty map. Shared by the Equalizer page's preset grid and
 * the Sound page's entry card.
 */
export function usePresetCurves(
  presets: readonly EqualizerPreset[] | undefined,
  withClearBass: boolean,
): ReadonlyMap<number, readonly number[] | null> {
  const model = useEngine((state) => state.payload?.snapshot.texts.modelName ?? null);
  const firmware = useEngine((state) => state.payload?.snapshot.texts.firmwareVersion ?? null);
  return useMemo(() => {
    const table = eqPresetTableFor(model, firmware);
    const curves = new Map<number, readonly number[] | null>();
    for (const preset of presets ?? []) {
      const curve = presetCurve(table, String(presetIds.toName(preset.id)), withClearBass);
      if (curve !== undefined) curves.set(preset.id, curve);
    }
    return curves;
  }, [model, firmware, presets, withClearBass]);
}
