import type { ScannedDevice } from "../engine/types";
import { familyForModel } from "./pairingInstructions";

/** True for a name Sony headphones use (`WH-`, `WF-`, `LinkBuds`). */
export const looksLikeSonyHeadphones = (device: ScannedDevice): boolean => familyForModel(device.name) !== null;

/**
 * `engine:devices` lists every Bluetooth device Windows has connected (mice
 * and keyboards too), in Windows' order. The setup list shows the
 * remembered headphones first, then other Sony-named headphones, then the
 * rest, keeping Windows' order within each group. Nothing is hidden: a pair
 * renamed in Windows must still be choosable.
 */
export function orderScannedDevices(devices: readonly ScannedDevice[]): ScannedDevice[] {
  const rank = (device: ScannedDevice) => (device.remembered ? 0 : looksLikeSonyHeadphones(device) ? 1 : 2);
  return devices
    .map((device, index) => ({ device, index }))
    .sort((a, b) => rank(a.device) - rank(b.device) || a.index - b.index)
    .map(({ device }) => device);
}
