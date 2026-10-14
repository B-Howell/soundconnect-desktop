import { Card } from "../primitives/Card";
import { BandSliders } from "./BandSliders";
import { ClearBassSlider } from "./ClearBassSlider";
import { CLEAR_BASS_RANGE, defaultBandLabels, defaultBandRange, type ValueRange } from "./equalizerBands";
import { PresetPicker, type EqualizerPreset } from "./PresetPicker";
import "./EqualizerCard.css";

export interface EqualizerCardProps {
  /** The presets the device advertised, in its order, with its names. */
  presets: readonly EqualizerPreset[];
  presetId: number;
  /** Band levels as the device reports them (`int8_t`); the length is the device's band count. */
  bands: readonly number[];
  /** Labels per band; defaults to upstream's centre frequencies for 5 or 10 bands, else "Band n". */
  bandLabels?: readonly string[];
  /**
   * Band range; defaults to upstream's: -10..10 for 5 bands, -6..6 for 10.
   * For any other count without an explicit range the bands are not editable
   * (upstream refuses them too), so no guessed value can reach the device.
   */
  bandRange?: ValueRange;
  /** Clear Bass level; omit when the device has none (upstream shows it only with 5 bands). */
  clearBass?: number;
  clearBassRange?: ValueRange;
  /**
   * False when the device reports the equalizer unusable (`MDREqualizer.available`,
   * for example in a listening mode other than Standard): the controls are
   * disabled and the reason is shown.
   */
  available: boolean;
  disabled?: boolean;
  /** False where presets are picked elsewhere (the Equalizer page's preset grid): no "Preset" row. */
  showPresetPicker?: boolean;
  onPresetChange: (id: number) => void;
  /** Every change while a band moves (full array). */
  onBandsChange: (bands: number[]) => void;
  /** Once per band gesture (full array). */
  onBandsCommit: (bands: number[]) => void;
  onClearBassChange: (value: number) => void;
  onClearBassCommit: (value: number) => void;
  /** A band gesture starts (true) and ends (false); hold device echoes meanwhile. */
  onBandsGestureChange?: (active: boolean) => void;
  /** The Clear Bass gesture starts (true) and ends (false). */
  onClearBassGestureChange?: (active: boolean) => void;
}

/**
 * The equalizer: preset row (opens a sheet; optional), one inline slider per band and
 * Clear Bass. Presentational: values in, intentions out.
 */
export function EqualizerCard({
  presets,
  presetId,
  bands,
  bandLabels,
  bandRange,
  clearBass,
  clearBassRange = CLEAR_BASS_RANGE,
  available,
  disabled = false,
  showPresetPicker = true,
  onPresetChange,
  onBandsChange,
  onBandsCommit,
  onClearBassChange,
  onClearBassCommit,
  onBandsGestureChange,
  onClearBassGestureChange,
}: EqualizerCardProps) {
  const inert = disabled || !available;
  const range = bandRange ?? defaultBandRange(bands.length);
  return (
    <Card>
      {showPresetPicker ? (
        <ul className="equalizer-card__rows">
          <PresetPicker presets={presets} presetId={presetId} onChange={onPresetChange} disabled={inert} />
        </ul>
      ) : null}
      {!available ? (
        <p className="equalizer-card__note">Unavailable in this listening mode.</p>
      ) : null}
      {bands.length > 0 && !range ? (
        <p className="equalizer-card__note">Band editing is not available for {bands.length} bands.</p>
      ) : null}
      {bands.length > 0 && range ? (
        <div className="equalizer-card__block">
          <BandSliders
            bands={bands}
            labels={bandLabels ?? defaultBandLabels(bands.length)}
            range={range}
            onChange={onBandsChange}
            onCommit={onBandsCommit}
            onGestureChange={onBandsGestureChange}
            disabled={inert}
          />
        </div>
      ) : null}
      {clearBass !== undefined ? (
        <div className="equalizer-card__block equalizer-card__block--clear-bass">
          <ClearBassSlider
            value={clearBass}
            range={clearBassRange}
            onChange={onClearBassChange}
            onCommit={onClearBassCommit}
            onGestureChange={onClearBassGestureChange}
            disabled={inert}
          />
        </div>
      ) : null}
    </Card>
  );
}
