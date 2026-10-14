import type { SpeakToChatCardProps } from "../../components/sound/SpeakToChatCard";
import { hasFeature, type SpeakToChatSensitivity, type SpeakToChatTimeout } from "../../lib/engine/types";
import { useSnapshotProps, type SnapshotMapper } from "./useSnapshotProps";

const SENSITIVITIES: readonly SpeakToChatSensitivity[] = ["auto", "low", "high"];
const TIMEOUTS: readonly SpeakToChatTimeout[] = ["short", "medium", "long", "manual"];

/** A value a write accepts: the reported one when it is writable, else the fallback. */
const writable = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

/**
 * Speak-to-Chat (`SPEAK_TO_CHAT`) from `snapshot.speakToChat`
 * (`{enabled, sensitivity, timeout}`, the XM4 reports `false`, `"auto"`,
 * `"short"`). Every change sends the whole `setSpeakToChat {enabled,
 * sensitivity, timeout}` with the other two fields as reported (an
 * `unknown` sensitivity or timeout is written as `auto` / `short`).
 */
export const toSpeakToChatProps: SnapshotMapper<SpeakToChatCardProps> = (snapshot, send) => {
  const stc = snapshot.speakToChat;
  if (!stc || !hasFeature(snapshot, "SPEAK_TO_CHAT")) return null;
  const current = {
    enabled: stc.enabled,
    sensitivity: writable(stc.sensitivity, SENSITIVITIES, "auto"),
    timeout: writable(stc.timeout, TIMEOUTS, "short"),
  };
  return {
    enabled: stc.enabled,
    sensitivity: stc.sensitivity,
    timeout: stc.timeout,
    onEnabledChange: (enabled) => send({ type: "setSpeakToChat", ...current, enabled }),
    onSensitivityChange: (sensitivity) => send({ type: "setSpeakToChat", ...current, sensitivity }),
    onTimeoutChange: (timeout) => send({ type: "setSpeakToChat", ...current, timeout }),
  };
};

/** The Speak-to-Chat card for the connected device, or null. */
export function useSpeakToChatProps(): SpeakToChatCardProps | null {
  return useSnapshotProps(toSpeakToChatProps);
}
