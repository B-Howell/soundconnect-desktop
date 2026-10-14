import { useMemo } from "react";
import type { NowPlayingCardProps } from "../../components/playback/NowPlayingCard";
import type { PlaybackStatus } from "../../components/playback/playbackStatus";
import type { PlaybackStatusName, Snapshot } from "../../lib/engine/types";
import { hasFeature } from "../../lib/engine/types";
import { useEngine } from "../../state/engineContext";
import { useEngineSend, useSliderCommand } from "./useEngineCommand";

/** Volume range of Sony headphones, as upstream's `ImGui::SliderInt("##Volume", &volume, 0, 30)`. */
export const MAX_VOLUME = 30;

const toStatus = (status: PlaybackStatusName): PlaybackStatus => (typeof status === "number" ? "unknown" : status);

/** A blank text reads as absent (the XM4 sends `trackAlbum: ""`). */
const text = (value: string | null): string | undefined => (value ? value : undefined);

/** The card values from `playback` and the track texts, or null without playback data. */
export function toNowPlayingValues(snapshot: Snapshot) {
  const playback = snapshot.playback;
  if (!playback) return null;
  return {
    title: text(snapshot.texts.trackTitle),
    artist: text(snapshot.texts.trackArtist),
    album: text(snapshot.texts.trackAlbum),
    status: toStatus(playback.status),
    volume: playback.volume,
    maxVolume: MAX_VOLUME,
    disabled: !hasFeature(snapshot, "PLAYBACK_CONTROL") && !hasFeature(snapshot, "PLAYBACK_VOLUME"),
  };
}

/**
 * The Now playing card from `playback` (`status`, `volume` 0..30) and the
 * track texts. Play / pause sends `playback {action: "pause"}` while playing,
 * else `"play"`; next and previous their actions; the volume slider sends
 * `setVolume` live (throttled) and on commit. The codec is left out (the
 * device header shows it). Null without playback data.
 */
export function useNowPlayingProps(): NowPlayingCardProps | null {
  const snapshot = useEngine((state) => state.payload?.snapshot ?? null);
  const send = useEngineSend();
  const volume = useSliderCommand("setVolume", (value: number) => ({ type: "setVolume", volume: value }));

  return useMemo(() => {
    const values = snapshot ? toNowPlayingValues(snapshot) : null;
    if (!values) return null;
    return {
      ...values,
      onPlayPause: () => send({ type: "playback", action: values.status === "playing" ? "pause" : "play" }),
      onNext: () => send({ type: "playback", action: "next" }),
      onPrevious: () => send({ type: "playback", action: "previous" }),
      onVolumeChange: volume.onChange,
      onVolumeCommit: volume.onCommit,
      onVolumeGestureChange: volume.onGestureChange,
    };
  }, [snapshot, send, volume]);
}
