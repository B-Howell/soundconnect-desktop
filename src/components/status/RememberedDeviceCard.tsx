import { useFocusAfterAction } from "../../hooks/useFocusAfterAction";
import { DeviceImage } from "../device-art/DeviceImage";
import { SheetButton } from "../primitives/SheetButton";
import { connectionCopy, connectionStateLabel, type ConnectionView } from "../shell/connectionCopy";
import { ConnectionState } from "../shell/ConnectionState";
import "./RememberedDeviceCard.css";

/** Side of the product photo on the remembered-device card, px. */
export const REMEMBERED_IMAGE_SIZE = 160;

export interface RememberedDeviceCardProps {
  /** The title: `rememberedTitle` (model name, else Windows' name), never the address. */
  name: string;
  /** Model name for the product image ("" when unknown). */
  modelName: string;
  /** The connection state (`useConnectionView`): offline, idle, searching, connecting or error. */
  view: ConnectionView;
  /** Sends `connect {address}` for the remembered headphones. */
  onConnect: () => void;
  onOpenBluetoothSettings: () => void;
}

/** The primary button's label, and whether it can be pressed, for each state. */
function primaryAction(view: ConnectionView): { label: string; enabled: boolean } {
  switch (view.kind) {
    case "idle":
    case "offline":
      return { label: "Connect", enabled: true };
    case "searching":
      return { label: "Connect now", enabled: true };
    case "connecting":
      return { label: "Connecting…", enabled: false };
    case "error":
      return { label: "Try again", enabled: true };
  }
}

/**
 * The Status page while remembered headphones are not connected: their
 * picture and name, a state line ("Off or out of range", "Connected to
 * Windows", "Connecting…", "Reconnecting to …", "Couldn't connect"), what to do, and Connect beside "Open Bluetooth
 * settings". Nothing connects until the user asks (unless auto-connect is
 * on). After Connect, focus moves to the name, because the pressed button
 * turns disabled while connecting.
 */
export function RememberedDeviceCard({ name, modelName, view, onConnect, onOpenBluetoothSettings }: RememberedDeviceCardProps) {
  const { target, markAction } = useFocusAfterAction<HTMLHeadingElement>(view.kind);
  const { description } = connectionCopy(view);
  const primary = primaryAction(view);
  const failed = view.kind === "error";

  return (
    <ConnectionState
      visual={<DeviceImage model={modelName || name} size={REMEMBERED_IMAGE_SIZE} />}
      title={name}
      titleRef={target}
      description={
        <>
          <span className="remembered-device__state" data-tone={failed ? "warning" : undefined}>
            {connectionStateLabel(view)}
          </span>
          <span className="remembered-device__advice">{description}</span>
        </>
      }
    >
      <SheetButton
        onPress={() => {
          markAction();
          onConnect();
        }}
        disabled={!primary.enabled}
      >
        {primary.label}
      </SheetButton>
      <SheetButton variant="secondary" onPress={onOpenBluetoothSettings}>
        Open Bluetooth settings
      </SheetButton>
    </ConnectionState>
  );
}
