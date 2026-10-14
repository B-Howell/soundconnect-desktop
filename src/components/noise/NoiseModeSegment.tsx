import { useMemo, type MouseEvent } from "react";
import { SegmentedControl } from "../primitives/SegmentedControl";
import {
  availableNoiseSegments,
  noiseSegmentFor,
  type NoiseMode,
  type NoiseModeAvailability,
  type NoiseSegment,
} from "./noiseModes";

export interface NoiseModeSegmentProps extends NoiseModeAvailability {
  /** The device's mode; wind-noise reduction shows as Noise cancelling. */
  mode: NoiseMode;
  onChange: (segment: NoiseSegment) => void;
  disabled?: boolean;
}

/**
 * Sony's Ambient Sound Control switch: Noise cancelling / Ambient sound / Off,
 * only the modes the device supports. Wind-noise reduction shows as Noise
 * cancelling; the segmented control ignores a click on its checked segment,
 * so in wind mode a click (or Space / Enter) on Noise cancelling is caught
 * here and sent, else the Status page's switch could not leave wind.
 */
export function NoiseModeSegment({ mode, canCancel, canAmbient, onChange, disabled }: NoiseModeSegmentProps) {
  const options = useMemo(() => availableNoiseSegments({ canCancel, canAmbient }), [canCancel, canAmbient]);
  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (mode === "wind" && !disabled && (event.target as Element).closest('[data-value="cancelling"]')) {
      onChange("cancelling");
    }
  };
  return (
    <div onClickCapture={onClickCapture}>
      <SegmentedControl
        label="Ambient sound control"
        options={options}
        value={noiseSegmentFor(mode)}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}
