import { Slider } from "../primitives/Slider";
import { formatSignedStep, type ValueRange } from "./equalizerBands";
import "./BandSliders.css";

export interface BandSlidersProps {
  bands: readonly number[];
  /** One label per band ("400 Hz" ...). */
  labels: readonly string[];
  range: ValueRange;
  /** Every change while a band moves, as the full band array. */
  onChange: (bands: number[]) => void;
  /** Once per band gesture, with the full band array (what the device write takes). */
  onCommit: (bands: number[]) => void;
  /** A band's gesture starts (true) and ends (false). */
  onGestureChange?: (active: boolean) => void;
  disabled?: boolean;
}

function withBand(bands: readonly number[], index: number, value: number): number[] {
  const next = [...bands];
  next[index] = value;
  return next;
}

/**
 * One compact inline `Slider` per equalizer band, horizontal rather than
 * iOS-style vertical faders: native range inputs keep keyboard and
 * screen-reader support, and a 44 px row per band fits the narrow window.
 */
export function BandSliders({ bands, labels, range, onChange, onCommit, onGestureChange, disabled }: BandSlidersProps) {
  return (
    <div className="band-sliders" role="group" aria-label="Equalizer bands">
      {bands.map((band, index) => (
        <Slider
          key={index}
          layout="inline"
          label={labels[index] ?? `Band ${index + 1}`}
          value={band}
          min={range.min}
          max={range.max}
          origin={0}
          formatValue={formatSignedStep}
          onChange={(value) => onChange(withBand(bands, index, value))}
          onCommit={(value) => onCommit(withBand(bands, index, value))}
          onGestureChange={onGestureChange}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
