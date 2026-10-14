import { MODE_LABELS } from "../../lib/winaudio/rows";
import type { FixKind } from "../../lib/winaudio/types";
import type { IconName } from "../icons/Icon";
import { ChoiceTile } from "../primitives/ChoiceTile";
import { Pill } from "../primitives/Pill";
import { TextButton } from "../primitives/TextButton";
import "./AudioModeSwitch.css";

export interface AudioModeSwitchProps {
  /** The mode Windows is in now. */
  mode: FixKind;
  /** Drifted mode items plus rows that differ from the recommendation. */
  attention: number;
  /** Opens the preview of what switching to (or setting up) `kind` changes. */
  onChoose: (kind: FixKind) => void;
  busy?: boolean;
}

const MODES: { kind: FixKind; icon: IconName; description: string }[] = [
  { kind: "stereo", icon: "headphones", description: "Games, music, video. Mic off." },
  { kind: "monoMic", icon: "chat", description: "Voice chat and calls. Mono quality." },
];

/**
 * The Windows audio page's hero: two mode tiles side by side, the current
 * one marked, and a summary line ("Currently: Stereo audio", "Needs
 * attention (n)" with Review). Choosing the other tile, or Review, opens the
 * preview; nothing changes until it is confirmed.
 */
export function AudioModeSwitch({ mode, attention, onChoose, busy = false }: AudioModeSwitchProps) {
  return (
    <div className="audio-mode">
      <div className="audio-mode__tiles" role="group" aria-label="Audio mode">
        {MODES.map((m) => (
          <ChoiceTile
            key={m.kind}
            title={MODE_LABELS[m.kind]}
            description={m.description}
            icon={m.icon}
            selected={m.kind === mode}
            disabled={busy}
            onSelect={() => {
              if (m.kind !== mode) onChoose(m.kind);
            }}
          />
        ))}
      </div>
      <div className="audio-mode__summary" role="status">
        <span className="audio-mode__current">
          Currently: <strong>{MODE_LABELS[mode]}</strong>
          {busy ? " · Applying…" : ""}
        </span>
        {attention > 0 ? (
          <>
            <Pill tone="warning">Needs attention ({attention})</Pill>
            <TextButton onPress={() => onChoose(mode)} disabled={busy}>
              Review
            </TextButton>
          </>
        ) : null}
      </div>
    </div>
  );
}
