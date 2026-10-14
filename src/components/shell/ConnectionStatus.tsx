import { useFocusAfterAction } from "../../hooks/useFocusAfterAction";
import { ActivityPulse } from "./ActivityPulse";
import { ConnectionConnecting } from "./ConnectionConnecting";
import { connectionCopy, type ConnectionView } from "./connectionCopy";
import { ConnectionError } from "./ConnectionError";
import { ConnectionSearching } from "./ConnectionSearching";
import { ConnectionState } from "./ConnectionState";

export interface ConnectionStatusProps {
  view: ConnectionView;
  /** Model name for the product photo (e.g. the remembered device's); defaults to `view.deviceName`. */
  model?: string;
  /** Opens the setup wizard (the "No headphones set up" card's Set up). */
  onSetUp?: () => void;
  /** Opens Windows Bluetooth settings (the failure card's second button). */
  onOpenBluetoothSettings?: () => void;
}

/**
 * The not-connected screen for any state: the matching card. The shell's
 * persistent announcer (`ConnectionAnnouncer` in `AppShell`) speaks the
 * state, so it survives tab switches. After "Try again", focus moves to the
 * new card's heading instead of falling to the page when the button disappears.
 */
export function ConnectionStatus({ view, model, onSetUp, onOpenBluetoothSettings }: ConnectionStatusProps) {
  const { target, markAction } = useFocusAfterAction<HTMLHeadingElement>(view.kind);
  const photoModel = model || view.deviceName;

  let card;
  switch (view.kind) {
    case "searching":
      card = <ConnectionSearching model={photoModel} titleRef={target} onSetUp={onSetUp} />;
      break;
    // The Status page shows a remembered device's own card (`RememberedDeviceCard`);
    // this plain card covers any other place that shows the idle state.
    case "offline":
    case "idle":
    case "disconnected":
    case "takenOver": {
      card = <ConnectionState visual={<ActivityPulse icon="bluetooth" />} title={connectionCopy(view).title} titleRef={target} />;
      break;
    }
    case "connecting":
      card = (
        <ConnectionConnecting
          deviceName={view.deviceName}
          model={photoModel}
          titleRef={target}
          reconnecting={view.reconnecting}
        />
      );
      break;
    case "error":
      card = (
        <ConnectionError
          deviceName={view.deviceName}
          model={photoModel}
          message={view.message}
          titleRef={target}
          onOpenBluetoothSettings={onOpenBluetoothSettings}
          onRetry={() => {
            markAction();
            view.onRetry();
          }}
        />
      );
      break;
  }

  return card;
}
