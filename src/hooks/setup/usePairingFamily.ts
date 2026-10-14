import { useState } from "react";
import { familyForModel, type DeviceFamily } from "../../lib/devices/pairingInstructions";
import { useRememberedDevice } from "./useRememberedDevice";

/**
 * Which pairing instructions the setup wizard shows: the remembered
 * headphones' family when known, else over-ear; the user can switch.
 */
export function usePairingFamily(): [DeviceFamily, (family: DeviceFamily) => void] {
  const remembered = useRememberedDevice();
  return useState<DeviceFamily>(() => familyForModel(remembered?.modelName || remembered?.name) ?? "overEar");
}
