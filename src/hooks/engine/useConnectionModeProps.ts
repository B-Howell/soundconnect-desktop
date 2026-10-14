import type { ConnectionQualityCardProps } from "../../components/sound/ConnectionQualityCard";
import { hasFeature } from "../../lib/engine/types";
import { useSnapshotProps, type SnapshotMapper } from "./useSnapshotProps";

/**
 * Bluetooth connection quality (`CONNECTION_MODE`) from
 * `snapshot.connectionMode.audioPriority` (the XM4 reports `"stability"`);
 * a pick sends `setConnectionMode {audioPriority}`.
 */
export const toConnectionModeProps: SnapshotMapper<ConnectionQualityCardProps> = (snapshot, send) => {
  const mode = snapshot.connectionMode;
  if (!mode || !hasFeature(snapshot, "CONNECTION_MODE")) return null;
  return {
    value: mode.audioPriority,
    onChange: (audioPriority) => send({ type: "setConnectionMode", audioPriority }),
  };
};

/** The connection quality card for the connected device, or null. */
export function useConnectionModeProps(): ConnectionQualityCardProps | null {
  return useSnapshotProps(toConnectionModeProps);
}
