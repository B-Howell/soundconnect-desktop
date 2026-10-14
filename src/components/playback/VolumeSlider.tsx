import { Icon } from "../icons/Icon";
import { Slider } from "../primitives/Slider";

export interface VolumeSliderProps {
  volume: number;
  /** Device maximum (30 on Sony headphones, the range the upstream client's slider uses). */
  maxVolume: number;
  onChange: (volume: number) => void;
  onCommit: (volume: number) => void;
  /** The gesture starts (true) and ends (false). */
  onGestureChange?: (active: boolean) => void;
  disabled?: boolean;
}

/** Headphone playback volume, 0..maxVolume, labelled with the speaker glyph. */
export function VolumeSlider({ volume, maxVolume, onChange, onCommit, onGestureChange, disabled }: VolumeSliderProps) {
  return (
    <Slider
      label="Volume"
      leading={<Icon name="speaker" />}
      value={volume}
      min={0}
      max={maxVolume}
      onChange={onChange}
      onCommit={onCommit}
      onGestureChange={onGestureChange}
      disabled={disabled}
    />
  );
}
