import { useCallback } from "react";
import { Slider } from "../primitives/Slider";
import { ambientPositionLabel, type AmbientPosition } from "./ambientPositions";

export interface AmbientPositionSliderProps {
  /** The stops, lowest first (`ambientPositions`). */
  positions: readonly AmbientPosition[];
  /** Index of the stop the device is at. */
  index: number;
  /** Every stop while dragging (throttle any device command). */
  onChange: (position: AmbientPosition) => void;
  /** Once per gesture, with the stop the user ended on. */
  onCommit: (position: AmbientPosition) => void;
  onGestureChange?: (active: boolean) => void;
  disabled?: boolean;
}

/**
 * Sony's one Ambient Sound Control slider: its stops run from noise
 * cancelling through wind noise reduction to ambient levels 1..20, and the
 * value reads in those words ("Noise cancelling", "Wind noise reduction",
 * "12"), also as `aria-valuetext`.
 */
export function AmbientPositionSlider({ positions, index, onChange, onCommit, onGestureChange, disabled }: AmbientPositionSliderProps) {
  const at = useCallback(
    (value: number) => positions[Math.min(Math.max(Math.round(value), 0), positions.length - 1)],
    [positions],
  );
  const format = useCallback((value: number) => {
    const position = at(value);
    return position ? ambientPositionLabel(position) : "";
  }, [at]);
  const report = (handler: (position: AmbientPosition) => void) => (value: number) => {
    const position = at(value);
    if (position) handler(position);
  };
  return (
    <Slider
      label="Ambient sound level"
      value={Math.max(index, 0)}
      min={0}
      max={Math.max(positions.length - 1, 0)}
      onChange={report(onChange)}
      onCommit={report(onCommit)}
      onGestureChange={onGestureChange}
      formatValue={format}
      disabled={disabled || positions.length < 2}
    />
  );
}
