import { useMemo } from "react";
import type { EngineCommand, Snapshot } from "../../lib/engine/types";
import { useEngine } from "../../state/engineContext";
import { useEngineSend } from "./useEngineCommand";

/** Maps a snapshot to a card's props; null when the device lacks the feature. Define it at module level so it is stable. */
export type SnapshotMapper<T> = (snapshot: Snapshot, send: (command: EngineCommand) => void) => T | null;

/**
 * A card's props from the shown snapshot (confirmed plus optimistic patches)
 * through a pure mapper, or null without a snapshot. The shared body of the
 * per-card hooks, so each hook is its mapper and nothing else.
 */
export function useSnapshotProps<T>(toProps: SnapshotMapper<T>): T | null {
  const snapshot = useEngine((state) => state.payload?.snapshot ?? null);
  const send = useEngineSend();
  return useMemo(() => (snapshot ? toProps(snapshot, send) : null), [snapshot, send, toProps]);
}
