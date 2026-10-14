import { useEffect, useState } from "react";
import { GroupedList } from "../primitives/GroupedList";
import { SectionFooter } from "../primitives/SectionFooter";
import { PairedDeviceRow } from "./PairedDeviceRow";
import { PairedDeviceSheet } from "./PairedDeviceSheet";
import type { PairedDeviceActionName, PairedDeviceView } from "./pairedDevices";

export interface PairedDeviceListProps {
  devices: readonly PairedDeviceView[];
  onAction: (deviceId: string, action: PairedDeviceActionName) => void;
  /**
   * False when the headphones cannot connect, disconnect, switch or forget
   * paired devices from here (protocol V1, the XM3 / XM4: libmdr refuses
   * `setPairedDevice`): the list is read-only, with a footer saying so.
   */
  actionsSupported?: boolean;
  disabled?: boolean;
}

/**
 * The headphones' paired devices, one row each, and (where the headphones
 * allow it) the actions sheet for the row that was pressed. The sheet follows that device's live state (a pending
 * action, a new report) by id, and closes if the device leaves the list.
 */
export function PairedDeviceList({ devices, onAction, actionsSupported = true, disabled }: PairedDeviceListProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = disabled || !actionsSupported ? null : (devices.find((device) => device.id === openId) ?? null);
  // A sheet closed by the device leaving the list, or by a disconnect, stays closed when it comes back.
  useEffect(() => {
    if (openId !== null && open === null) setOpenId(null);
  }, [openId, open]);
  return (
    <>
      <GroupedList aria-label="Paired devices">
        {devices.map((device) => (
          <PairedDeviceRow
            key={device.id}
            device={device}
            onPress={actionsSupported ? () => setOpenId(device.id) : undefined}
            disabled={disabled}
          />
        ))}
      </GroupedList>
      {actionsSupported ? null : (
        <SectionFooter>
          <p>
            These headphones can&apos;t manage paired devices from a PC.
          </p>
        </SectionFooter>
      )}
      <PairedDeviceSheet
        device={open}
        onClose={() => setOpenId(null)}
        onAction={(device, action) => onAction(device.id, action)}
      />
    </>
  );
}
