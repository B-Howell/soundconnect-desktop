import { Icon } from "../icons/Icon";
import { ListRow } from "../primitives/ListRow";
import { Pill } from "../primitives/Pill";
import { pendingLabels, type PairedDeviceView } from "./pairedDevices";
import "./PairedDeviceRow.css";

export interface PairedDeviceRowProps {
  device: PairedDeviceView;
  /** Opens the device's actions; leave out when the headphones cannot act on paired devices (the row is then read-only). */
  onPress?: () => void;
  disabled?: boolean;
}

/** The second line: an action under way, else "This PC" for this computer. */
function subtitleFor(device: PairedDeviceView): string | undefined {
  if (device.pending) return pendingLabels[device.pending];
  return device.thisPc ? "This PC" : undefined;
}

/**
 * One paired device: a device glyph, its name, "Connected" and "Playback
 * device" chips, and a chevron to its actions. This PC's row carries "This
 * PC" under the name.
 */
export function PairedDeviceRow({ device, onPress, disabled }: PairedDeviceRowProps) {
  const chips =
    device.connected || device.playback ? (
      <span className="paired-device-row__chips">
        {device.connected ? <Pill tone="success">Connected</Pill> : null}
        {device.playback ? <Pill tone="accent">Playback device</Pill> : null}
      </span>
    ) : undefined;
  return (
    <ListRow
      title={device.name || device.id}
      subtitle={subtitleFor(device)}
      leading={<Icon name={device.thisPc ? "devices" : "bluetooth"} />}
      trailing={chips}
      disclosure={onPress !== undefined}
      onPress={onPress}
      disabled={disabled}
    />
  );
}
