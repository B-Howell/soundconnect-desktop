import { TransportButton } from "./TransportButton";
import type { PlaybackStatus } from "./playbackStatus";
import "./TransportControls.css";

export interface TransportControlsProps {
  status: PlaybackStatus;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  disabled?: boolean;
}

/** Previous, play / pause (Pause only while playing), next. */
export function TransportControls({ status, onPlayPause, onNext, onPrevious, disabled }: TransportControlsProps) {
  const playing = status === "playing";
  return (
    <div className="transport-controls" role="group" aria-label="Playback">
      <TransportButton icon="skip-back" label="Previous track" onPress={onPrevious} disabled={disabled} />
      <TransportButton
        primary
        icon={playing ? "pause" : "play"}
        label={playing ? "Pause" : "Play"}
        onPress={onPlayPause}
        disabled={disabled}
      />
      <TransportButton icon="skip-forward" label="Next track" onPress={onNext} disabled={disabled} />
    </div>
  );
}
