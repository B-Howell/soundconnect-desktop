import { Card } from "../primitives/Card";
import { TrackInfo } from "./TrackInfo";
import { TransportControls } from "./TransportControls";
import { VolumeSlider } from "./VolumeSlider";
import type { PlaybackStatus } from "./playbackStatus";
import "./NowPlayingCard.css";

export interface NowPlayingCardProps {
  title?: string;
  artist?: string;
  album?: string;
  status: PlaybackStatus;
  volume: number;
  maxVolume: number;
  codec?: string;
  disabled?: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  /** Every volume while dragging. */
  onVolumeChange: (volume: number) => void;
  /** Once per gesture, with the final volume. */
  onVolumeCommit: (volume: number) => void;
  /** The volume gesture starts (true) and ends (false); hold device echoes meanwhile. */
  onVolumeGestureChange?: (active: boolean) => void;
}

/** Home's now playing card: track, transport row, volume. Values in, intentions out. */
export function NowPlayingCard({
  title,
  artist,
  album,
  status,
  volume,
  maxVolume,
  codec,
  disabled = false,
  onPlayPause,
  onNext,
  onPrevious,
  onVolumeChange,
  onVolumeCommit,
  onVolumeGestureChange,
}: NowPlayingCardProps) {
  return (
    <Card inset>
      <div className="now-playing">
        <TrackInfo title={title} artist={artist} album={album} codec={codec} />
        <TransportControls
          status={status}
          onPlayPause={onPlayPause}
          onNext={onNext}
          onPrevious={onPrevious}
          disabled={disabled}
        />
        <VolumeSlider
          volume={volume}
          maxVolume={maxVolume}
          onChange={onVolumeChange}
          onCommit={onVolumeCommit}
          onGestureChange={onVolumeGestureChange}
          disabled={disabled}
        />
      </div>
    </Card>
  );
}
