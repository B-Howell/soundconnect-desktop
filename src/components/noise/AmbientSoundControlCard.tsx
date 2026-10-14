import { useMemo } from "react";
import { Card } from "../primitives/Card";
import { InfoNote } from "../primitives/InfoNote";
import { Reveal } from "../primitives/Reveal";
import { AmbientPositionSlider } from "./AmbientPositionSlider";
import { ambientPositionIndex, ambientPositions, type AmbientPosition } from "./ambientPositions";
import { FocusOnVoiceRow } from "./FocusOnVoiceRow";
import { NoiseModeSegment } from "./NoiseModeSegment";
import type { NoiseMode, NoiseSegment } from "./noiseModes";
import "./AmbientSoundControlCard.css";

export interface AmbientSoundControlCardProps {
  mode: NoiseMode;
  /** Ambient sound level, 1..20: the current one in ambient, else the one ambient resumes at. */
  ambientLevel: number;
  focusOnVoice: boolean;
  canCancel: boolean;
  canAmbient: boolean;
  /** The device offers wind-noise reduction (V1): the slider's second stop. */
  canWind?: boolean;
  canFocusOnVoice: boolean;
  disabled?: boolean;
  /** The switch: Noise cancelling, Ambient sound or Off. */
  onModeChange: (segment: NoiseSegment) => void;
  /** Every slider stop while dragging. */
  onPositionChange: (position: AmbientPosition) => void;
  /** Once per slider gesture, with the final stop. */
  onPositionCommit: (position: AmbientPosition) => void;
  /** The slider's gesture starts (true) and ends (false); hold device echoes meanwhile. */
  onPositionGestureChange?: (active: boolean) => void;
  onFocusOnVoiceChange: (on: boolean) => void;
}

/** Why the slider starts below level 1, in the Sony app's terms. */
function lowestStopsNote(canWind: boolean): string {
  return canWind
    ? "Lowest positions: Noise cancelling, Wind noise reduction."
    : "Lowest position: Noise cancelling.";
}

/**
 * Ambient Sound Control the Sony way: a Noise cancelling / Ambient sound /
 * Off switch and, unless Off, one slider whose stops run from noise
 * cancelling and wind noise reduction to ambient levels 1..20, with a note on
 * the two lowest stops; Focus on voice appears at the ambient levels.
 * Presentational: values in, intentions out.
 */
export function AmbientSoundControlCard({
  mode,
  ambientLevel,
  focusOnVoice,
  canCancel,
  canAmbient,
  canWind = false,
  canFocusOnVoice,
  disabled = false,
  onModeChange,
  onPositionChange,
  onPositionCommit,
  onPositionGestureChange,
  onFocusOnVoiceChange,
}: AmbientSoundControlCardProps) {
  const positions = useMemo(() => ambientPositions({ canCancel, canAmbient, canWind }), [canCancel, canAmbient, canWind]);
  const index = ambientPositionIndex(positions, mode, ambientLevel);
  return (
    <Card>
      <div className="ambient-card__mode">
        <NoiseModeSegment mode={mode} canCancel={canCancel} canAmbient={canAmbient} onChange={onModeChange} disabled={disabled} />
      </div>
      <Reveal show={mode !== "off" && positions.length > 1}>
        <div className="ambient-card__level">
          <AmbientPositionSlider
            positions={positions}
            index={index}
            onChange={onPositionChange}
            onCommit={onPositionCommit}
            onGestureChange={onPositionGestureChange}
            disabled={disabled}
          />
          {canCancel ? <InfoNote>{lowestStopsNote(canWind)}</InfoNote> : null}
        </div>
      </Reveal>
      <Reveal show={mode === "ambient" && canAmbient && canFocusOnVoice}>
        <ul className="ambient-card__rows">
          <FocusOnVoiceRow checked={focusOnVoice} onChange={onFocusOnVoiceChange} disabled={disabled} />
        </ul>
      </Reveal>
    </Card>
  );
}
