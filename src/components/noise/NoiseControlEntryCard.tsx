import { useMemo } from "react";
import { EntryCard } from "../page/EntryCard";
import { AmbientLevelMeter } from "./AmbientLevelMeter";
import { ambientPositionIndex, ambientPositions } from "./ambientPositions";
import { AMBIENT_LEVEL_MAX, type NoiseMode, type NoiseModeAvailability } from "./noiseModes";

export interface NoiseControlEntryCardProps extends NoiseModeAvailability {
  mode: NoiseMode;
  ambientLevel: number;
  focusOnVoice: boolean;
  /** Opens the Noise control page. */
  onOpen: () => void;
}

const modeNames: Record<NoiseMode, string> = {
  cancelling: "Noise cancelling",
  wind: "Wind noise reduction",
  ambient: "Ambient sound",
  off: "Off",
};

/** The summary under the mode, in the Sony app's terms. */
export function noiseSummary(mode: NoiseMode, ambientLevel: number, focusOnVoice: boolean): string {
  switch (mode) {
    case "cancelling":
      return "Blocks surrounding sound";
    case "wind":
      return "Also cuts the sound of wind";
    case "ambient":
      return `Level ${Math.round(ambientLevel)} of ${AMBIENT_LEVEL_MAX}${focusOnVoice ? " · Focus on voice" : ""}`;
    case "off":
      return "Ambient sound control is off";
  }
}

/** The Sound page's way into Noise control: the mode, its level summary, the slider in miniature, a chevron. */
export function NoiseControlEntryCard({
  mode,
  ambientLevel,
  focusOnVoice,
  canCancel,
  canAmbient,
  canWind,
  onOpen,
}: NoiseControlEntryCardProps) {
  const positions = useMemo(() => ambientPositions({ canCancel, canAmbient, canWind }), [canCancel, canAmbient, canWind]);
  const index = ambientPositionIndex(positions, mode, ambientLevel);
  return (
    <EntryCard
      title="Noise control"
      value={modeNames[mode]}
      detail={noiseSummary(mode, ambientLevel, focusOnVoice)}
      icon={mode === "ambient" ? "ambient" : mode === "off" ? "power" : "noise-cancelling"}
      visual={index >= 0 && positions.length > 1 ? <AmbientLevelMeter index={index} count={positions.length} /> : undefined}
      onOpen={onOpen}
    />
  );
}
