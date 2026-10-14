import { looksLikeSonyHeadphones, orderScannedDevices } from "../../lib/devices/scannedDevices";
import type { ScannedDevice } from "../../lib/engine/types";
import { Icon } from "../icons/Icon";
import { GroupedList } from "../primitives/GroupedList";
import { ListRow } from "../primitives/ListRow";
import "./DeviceChoiceList.css";

export interface DeviceChoiceListProps {
  devices: readonly ScannedDevice[];
  /** The address being connected to, if any: its row says "Connecting…"; the store ignores picks meanwhile. */
  connectingAddress?: string;
  onSelect: (address: string) => void;
}

/** The row's second line: why this device is (or may not be) the one. */
function subtitle(device: ScannedDevice): string {
  if (device.remembered) return "Used before";
  return looksLikeSonyHeadphones(device) ? device.address : "Other Bluetooth device";
}

/**
 * The devices a scan found, one pressable row each, remembered and
 * Sony-named headphones first (`orderScannedDevices`): name, then "Used
 * before", the Bluetooth address, or "Other Bluetooth device". Rows stay
 * enabled while a connect runs (disabling the pressed row would drop focus
 * to the page); `connectTo` ignores a second pick until the first settles.
 */
export function DeviceChoiceList({ devices, connectingAddress, onSelect }: DeviceChoiceListProps) {
  return (
    <GroupedList aria-label="Bluetooth devices">
      {orderScannedDevices(devices).map((device) => (
        <ListRow
          key={device.address}
          leading={<Icon name="bluetooth" />}
          title={device.name}
          subtitle={subtitle(device)}
          trailing={
            device.address === connectingAddress ? <span className="device-choice__state">Connecting…</span> : null
          }
          disclosure={device.address !== connectingAddress}
          onPress={() => onSelect(device.address)}
        />
      ))}
    </GroupedList>
  );
}
