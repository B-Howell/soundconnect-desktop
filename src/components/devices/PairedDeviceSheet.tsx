import { useEffect, useRef, useState } from "react";
import { Sheet } from "../primitives/Sheet";
import { SheetActions } from "../primitives/SheetActions";
import { SheetButton } from "../primitives/SheetButton";
import { actionLabels, pairedDeviceActions, type PairedDeviceActionName, type PairedDeviceView } from "./pairedDevices";

export interface PairedDeviceSheetProps {
  /** The device whose actions are open, or null when closed. */
  device: PairedDeviceView | null;
  onClose: () => void;
  onAction: (device: PairedDeviceView, action: PairedDeviceActionName) => void;
}

function statusLine(device: PairedDeviceView): string {
  if (device.maybeThisPc) {
    return "Connected. Disconnect on that device or in Bluetooth settings.";
  }
  if (device.thisPc) {
    return "This PC. Disconnect in Bluetooth settings.";
  }
  if (!device.connected) return "Not connected.";
  return device.playback ? "Connected, playing." : "Connected.";
}

/**
 * A paired device's actions, Sony's "Manage connected devices": Connect or
 * Disconnect, Set as playback device, and Forget, which asks once more
 * ("Forget {name}?", focus on Cancel) because the device must be paired
 * again afterwards. Each action closes the sheet.
 */
export function PairedDeviceSheet({ device, onClose, onAction }: PairedDeviceSheetProps) {
  const [confirmForget, setConfirmForget] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);
  const forget = useRef<HTMLButtonElement>(null);
  const toggled = useRef(false);
  // Keep the last device while the sheet animates out.
  const [shown, setShown] = useState<PairedDeviceView | null>(device);
  useEffect(() => {
    if (device) setShown(device);
  }, [device]);
  // A new device (or closing) starts without the confirmation; a fresh report
  // for the same device does not cancel it.
  const openId = device?.id ?? null;
  useEffect(() => {
    if (openId !== null) setConfirmForget(false);
  }, [openId]);

  // Swapping the buttons unmounts the focused one: move focus to Cancel when
  // the confirmation appears and back to Forget when it is cancelled.
  useEffect(() => {
    if (!toggled.current) return;
    toggled.current = false;
    (confirmForget ? cancel : forget).current?.focus();
  }, [confirmForget]);

  const askForget = (ask: boolean) => {
    toggled.current = true;
    setConfirmForget(ask);
  };

  const act = (action: PairedDeviceActionName) => {
    if (!shown) return;
    if (action === "unpair" && !confirmForget) {
      askForget(true);
      return;
    }
    onClose();
    onAction(shown, action);
  };

  const name = shown ? shown.name || shown.id : "";
  const actions = shown ? pairedDeviceActions(shown) : [];
  return (
    <Sheet
      open={device !== null}
      onClose={onClose}
      title={confirmForget ? `Forget ${name}?` : name}
      message={
        shown
          ? confirmForget
            ? "Pair it again to use it."
            : statusLine(shown)
          : undefined
      }
      initialFocus={confirmForget ? cancel : undefined}
    >
      {shown ? (
        <SheetActions>
          {confirmForget ? (
            <>
              <SheetButton variant="destructive" onPress={() => act("unpair")}>
                Forget
              </SheetButton>
              <SheetButton variant="secondary" onPress={() => askForget(false)} ref={cancel}>
                Cancel
              </SheetButton>
            </>
          ) : actions.length === 0 ? (
            <SheetButton variant="secondary" onPress={onClose}>
              Close
            </SheetButton>
          ) : (
            actions.map((action) => (
              <SheetButton
                key={action}
                ref={action === "unpair" ? forget : undefined}
                variant={action === "unpair" ? "destructive" : action === "connect" ? "primary" : "secondary"}
                onPress={() => act(action)}
                disabled={shown.pending !== undefined}
              >
                {actionLabels[action]}
              </SheetButton>
            ))
          )}
        </SheetActions>
      ) : null}
    </Sheet>
  );
}
