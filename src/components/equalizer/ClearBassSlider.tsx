import { Slider } from "../primitives/Slider";
import { formatSignedStep, type ValueRange } from "./equalizerBands";

export interface ClearBassSliderProps {
  value: number;
  range: ValueRange;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
  /** The gesture starts (true) and ends (false). */
  onGestureChange?: (active: boolean) => void;
  disabled?: boolean;
}

/** Sony's Clear Bass level as a stacked `Slider` with a signed value. */
export function ClearBassSlider({ value, range, onChange, onCommit, onGestureChange, disabled }: ClearBassSliderProps) {
  return (
    <Slider
      label="Clear Bass"
      value={value}
      min={range.min}
      max={range.max}
      origin={0}
      formatValue={formatSignedStep}
      onChange={onChange}
      onCommit={onCommit}
      onGestureChange={onGestureChange}
      disabled={disabled}
    />
  );
}
