import { Slider } from "../primitives/Slider";
import { ToggleRow } from "../primitives/ToggleRow";
import { formatSignedStep } from "../equalizer/equalizerBands";
import "./VoiceGuidanceRow.css";

/** Voice guidance volume range as the upstream client's slider shows it (`SliderInt(..., -2, 2)`). */
export const VOICE_GUIDANCE_VOLUME_MIN = -2;
export const VOICE_GUIDANCE_VOLUME_MAX = 2;

export interface VoiceGuidanceRowProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  /** Guidance volume; pass only when the device has one (the v1 family has none). */
  volume?: number;
  onVolumeChange?: (volume: number) => void;
  onVolumeCommit?: (volume: number) => void;
  disabled?: boolean;
}

/**
 * The voice guidance switch and, when the device reports one, its volume
 * slider beneath, as list rows inside a `<ul>`.
 */
export function VoiceGuidanceRow({
  enabled,
  onEnabledChange,
  volume,
  onVolumeChange,
  onVolumeCommit,
  disabled,
}: VoiceGuidanceRowProps) {
  return (
    <>
      <ToggleRow
        title="Voice guidance"
        checked={enabled}
        onChange={onEnabledChange}
        disabled={disabled}
      />
      {volume !== undefined ? (
        <li className="voice-guidance__volume">
          <Slider
            label="Voice guidance volume"
            value={volume}
            min={VOICE_GUIDANCE_VOLUME_MIN}
            max={VOICE_GUIDANCE_VOLUME_MAX}
            origin={0}
            formatValue={formatSignedStep}
            onChange={(value) => onVolumeChange?.(value)}
            onCommit={onVolumeCommit}
            disabled={disabled || !enabled}
          />
        </li>
      ) : null}
    </>
  );
}
