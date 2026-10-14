import type { PairingCardProps } from "../../components/devices/PairingCard";
import { hasFeature } from "../../lib/engine/types";
import { useSnapshotProps, type SnapshotMapper } from "./useSnapshotProps";

/**
 * Pair a new device (`PAIRING_MODE`) from `snapshot.pairing.enabled` (the
 * XM4 reports `false`); the row sends `setPairing {enabled: true}`, and
 * `false` while pairing mode is on.
 */
export const toPairingProps: SnapshotMapper<PairingCardProps> = (snapshot, send) => {
  const pairing = snapshot.pairing;
  if (!pairing || !hasFeature(snapshot, "PAIRING_MODE")) return null;
  return {
    pairing: pairing.enabled,
    deviceName: snapshot.texts.modelName ?? "the headphones",
    onPairingChange: (enabled) => send({ type: "setPairing", enabled }),
  };
};

/** The pairing card for the connected device, or null. */
export function usePairingProps(): PairingCardProps | null {
  return useSnapshotProps(toPairingProps);
}
