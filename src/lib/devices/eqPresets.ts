/**
 * Recorded equalizer preset curves per headphone model. Each fixture under
 * `tests/fixtures/eq-presets/<model>-<firmware>.json` was read from real
 * headphones by `src-tauri/crates/mdr/examples/eq_presets.rs` (select each
 * preset, read the bands the device reports). Nothing here is invented: a
 * model without a fixture has no curves, and the Equalizer page then shows its
 * presets without sparklines.
 */

/** One recorded preset (`id` is the camelCase `MDR_EQ_*` name, as in the snapshot). */
export interface RecordedPreset {
  id: string;
  name: string;
  bands: number[];
  clearBass: number;
}

export interface EqPresetTable {
  model: string;
  firmware: string;
  bandLabels: string[];
  bandRange: [number, number];
  clearBassRange: [number, number];
  presets: RecordedPreset[];
}

/** Presets whose bands the listener sets: their curve is whatever was saved, not the preset's. */
const EDITABLE_PRESETS = new Set(["custom", "user1", "user2", "user3", "user4", "user5"]);

export function isEditablePreset(id: string): boolean {
  return EDITABLE_PRESETS.has(id);
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((n) => typeof n === "number" && Number.isFinite(n));
}

/** Validates a fixture's shape; returns null when anything is off, so a bad file shows no curves. */
export function parseEqPresetTable(raw: unknown): EqPresetTable | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  if (typeof t.model !== "string" || typeof t.firmware !== "string") return null;
  if (!Array.isArray(t.bandLabels) || !t.bandLabels.every((l) => typeof l === "string")) return null;
  if (!isNumberArray(t.bandRange) || t.bandRange.length !== 2) return null;
  if (!isNumberArray(t.clearBassRange) || t.clearBassRange.length !== 2) return null;
  if (!Array.isArray(t.presets)) return null;
  const presets: RecordedPreset[] = [];
  for (const p of t.presets as Record<string, unknown>[]) {
    if (!p || typeof p.id !== "string" || typeof p.name !== "string") return null;
    if (!isNumberArray(p.bands) || p.bands.length !== t.bandLabels.length) return null;
    if (typeof p.clearBass !== "number") return null;
    presets.push({ id: p.id, name: p.name, bands: p.bands, clearBass: p.clearBass });
  }
  return {
    model: t.model,
    firmware: t.firmware,
    bandLabels: t.bandLabels as string[],
    bandRange: [t.bandRange[0], t.bandRange[1]],
    clearBassRange: [t.clearBassRange[0], t.clearBassRange[1]],
    presets,
  };
}

const fixtures = import.meta.glob("../../../tests/fixtures/eq-presets/*.json", {
  eager: true,
  import: "default",
});

const tables: EqPresetTable[] = Object.values(fixtures)
  .map(parseEqPresetTable)
  .filter((t): t is EqPresetTable => t !== null);

/**
 * The recorded table for this model, preferring the same firmware; null when
 * the model was never recorded. `from` overrides the bundled fixtures (tests).
 */
export function eqPresetTableFor(
  model: string | null | undefined,
  firmware?: string | null,
  from: readonly EqPresetTable[] = tables,
): EqPresetTable | null {
  if (!model) return null;
  const forModel = from.filter((t) => t.model === model);
  return forModel.find((t) => t.firmware === firmware) ?? forModel[0] ?? null;
}

/**
 * A preset's sparkline values: `null` for a listener-edited preset (drawn as a
 * flat "Custom" line), the recorded Clear Bass then bands (or bands alone) for
 * a recorded preset, `undefined` when nothing was recorded (no sparkline).
 */
export function presetCurve(
  table: EqPresetTable | null,
  id: string,
  withClearBass: boolean,
): readonly number[] | null | undefined {
  if (isEditablePreset(id)) return null;
  const recorded = table?.presets.find((preset) => preset.id === id);
  if (!recorded) return undefined;
  return withClearBass ? [recorded.clearBass, ...recorded.bands] : recorded.bands;
}
