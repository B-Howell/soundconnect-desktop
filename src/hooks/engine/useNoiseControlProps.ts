import { useMemo } from "react";
import type { AmbientPosition } from "../../components/noise/ambientPositions";
import type { AmbientSoundControlCardProps } from "../../components/noise/AmbientSoundControlCard";
import type { NoiseModeSegmentProps } from "../../components/noise/NoiseModeSegment";
import { NOISE_SLOT } from "../../lib/engine/applyCommand";
import type { EngineCommand } from "../../lib/engine/types";
import { useEngine } from "../../state/engineContext";
import { useEngineSend, useSliderCommand } from "./useEngineCommand";

/**
 * The command for one stop of the Ambient Sound Control slider: noise
 * cancelling and wind noise reduction are modes (`setNoise {mode}`), every
 * other stop an ambient level (`setAmbientLevel {level}`, which also selects
 * ambient). On the XM4's 22 stops: index 0 sends `setNoise cancelling`,
 * index 1 `setNoise wind`, index n `setAmbientLevel n - 1`.
 */
export function ambientPositionCommand(position: AmbientPosition): EngineCommand {
  switch (position.kind) {
    case "cancelling":
      return { type: "setNoise", mode: "cancelling" };
    case "wind":
      return { type: "setNoise", mode: "wind" };
    case "ambient":
      return { type: "setAmbientLevel", level: position.level };
  }
}

/**
 * The Ambient Sound Control card from `noiseView` (never the raw V1 byte).
 * The switch sends `setNoise {mode}` (the engine keeps the level); the
 * slider sends its stop's command (`ambientPositionCommand`) live, throttled,
 * and on commit, holding echoes in `NOISE_SLOT`, the patch slot both
 * commands share; the Focus on voice switch sends `setFocusOnVoice
 * {enabled}`. Null when the device reports no noise control, or neither
 * cancelling nor ambient.
 */
export function useNoiseControlProps(): AmbientSoundControlCardProps | null {
  const view = useEngine((state) => state.payload?.noiseView ?? null);
  const send = useEngineSend();
  const slider = useSliderCommand(NOISE_SLOT, ambientPositionCommand);

  return useMemo(() => {
    if (!view || (!view.canCancel && !view.canAmbient)) return null;
    return {
      mode: view.mode,
      ambientLevel: view.ambientLevel,
      focusOnVoice: view.focusOnVoice,
      canCancel: view.canCancel,
      canAmbient: view.canAmbient,
      canWind: view.canWind,
      canFocusOnVoice: view.canFocusOnVoice,
      onModeChange: (mode) => send({ type: "setNoise", mode }),
      onPositionChange: slider.onChange,
      onPositionCommit: slider.onCommit,
      onPositionGestureChange: slider.onGestureChange,
      onFocusOnVoiceChange: (enabled) => send({ type: "setFocusOnVoice", enabled }),
    };
  }, [view, send, slider]);
}

/** The Status page's quick switch: the same mode and command as the card's switch. */
export function quickNoiseProps(card: AmbientSoundControlCardProps): NoiseModeSegmentProps {
  return { mode: card.mode, canCancel: card.canCancel, canAmbient: card.canAmbient, onChange: card.onModeChange };
}
