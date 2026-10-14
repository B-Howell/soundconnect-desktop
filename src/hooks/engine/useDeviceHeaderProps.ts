import { useMemo } from "react";
import type { DeviceHeaderProps } from "../../components/shell/DeviceHeader";
import { codecLabel } from "../../lib/engine/ids";
import type { Battery, EngineStatus, Snapshot } from "../../lib/engine/types";
import { useEngine } from "../../state/engineContext";

/** The battery the header shows: the main one, else the first present (earbuds report left / right). */
export function headerBattery(batteries: Battery[] | null): Battery | undefined {
  const present = (batteries ?? []).filter((battery) => battery.present);
  return present.find((battery) => battery.part === "main") ?? present[0];
}

/**
 * Header values from the snapshot: `texts.modelName` (else the name the
 * status carried), the battery's `levelPercent` and `charging === "yes"`, and
 * the codec from `model.audioCodec` (left out while unknown), and
 * `texts.firmwareVersion`.
 */
export function toDeviceHeaderProps(snapshot: Snapshot, status: EngineStatus): DeviceHeaderProps {
  const battery = headerBattery(snapshot.batteries);
  return {
    name: snapshot.texts.modelName ?? status.deviceName ?? "Headphones",
    percent: battery?.levelPercent,
    charging: battery?.charging === "yes",
    codec: codecLabel(snapshot.model?.audioCodec),
    firmware: snapshot.texts.firmwareVersion ?? undefined,
  };
}

/** The device header for the connected device, or null without a snapshot. */
export function useDeviceHeaderProps(): DeviceHeaderProps | null {
  const payload = useEngine((state) => state.payload);
  const status = useEngine((state) => state.status);
  return useMemo(() => (payload ? toDeviceHeaderProps(payload.snapshot, status) : null), [payload, status]);
}
