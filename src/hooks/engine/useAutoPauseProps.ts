import type { AutoPauseRowProps } from "../../components/system/AutoPauseRow";
import { hasFeature } from "../../lib/engine/types";
import { useSnapshotProps, type SnapshotMapper } from "./useSnapshotProps";

/**
 * Automatic pause when the headphones are removed (`AUTO_PAUSE`, which the
 * XM4 detects with `WEARING_DETECTION`) from `snapshot.power.autoPause` (the
 * XM4 reports `true`); the switch sends `setAutoPause {enabled}`.
 */
export const toAutoPauseProps: SnapshotMapper<AutoPauseRowProps> = (snapshot, send) => {
  const power = snapshot.power;
  if (!power || !hasFeature(snapshot, "AUTO_PAUSE")) return null;
  return {
    enabled: power.autoPause,
    onChange: (enabled) => send({ type: "setAutoPause", enabled }),
  };
};

/** The automatic pause row for the connected device, or null. */
export function useAutoPauseProps(): AutoPauseRowProps | null {
  return useSnapshotProps(toAutoPauseProps);
}
