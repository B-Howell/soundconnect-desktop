import type { ValueRange } from "./equalizerBands";
import { EqSparkline } from "./EqSparkline";
import "./PresetGrid.css";

const CUSTOM_CAPTION = "Custom";

export interface PresetTile {
  /** The device's preset id (`MDREqualizerPreset`). */
  id: number;
  name: string;
  /**
   * The recorded curve (Clear Bass first, then the bands); `null` for a preset
   * the listener edits (flat line, "Custom"); omitted when this model has no
   * recording (no sparkline at all).
   */
  curve?: readonly number[] | null;
}

export interface PresetGridProps {
  presets: readonly PresetTile[];
  presetId: number;
  range: ValueRange;
  onChange: (id: number) => void;
  disabled?: boolean;
}

/**
 * The presets as a grid of small cards, each with its name and a sparkline of
 * what it does; the selected one is `aria-pressed` and outlined in the accent.
 * Picking one reports its id.
 */
export function PresetGrid({ presets, presetId, range, onChange, disabled }: PresetGridProps) {
  return (
    <div className="preset-grid" role="group" aria-label="Equalizer presets">
      {presets.map((preset) => {
        const selected = preset.id === presetId;
        return (
          <button
            key={preset.id}
            type="button"
            className={selected ? "preset-grid__card preset-grid__card--selected" : "preset-grid__card"}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(preset.id)}
          >
            <span className="preset-grid__name">{preset.name}</span>
            {preset.curve === null ? (
              <span className="preset-grid__custom">
                <EqSparkline values={[0, 0]} range={range} />
                {preset.name === CUSTOM_CAPTION ? null : <span className="preset-grid__caption">{CUSTOM_CAPTION}</span>}
              </span>
            ) : preset.curve ? (
              <EqSparkline values={preset.curve} range={range} />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
