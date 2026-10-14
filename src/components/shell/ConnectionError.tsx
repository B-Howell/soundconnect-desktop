import type { Ref } from "react";
import { Disclosure } from "../primitives/Disclosure";
import { SheetButton } from "../primitives/SheetButton";
import { ConnectionDeviceImage } from "../device-art/ConnectionDeviceImage";
import { ActivityPulse } from "./ActivityPulse";
import { connectionCopy } from "./connectionCopy";
import { ConnectionState } from "./ConnectionState";
import "./ConnectionError.css";

export interface ConnectionErrorProps {
  /** Name of the device that failed, when one was found. */
  deviceName?: string;
  /** Model name for the photo when it differs from the Bluetooth name; defaults to `deviceName`. */
  model?: string;
  /** The raw technical message; shown only under "Details". */
  message: string;
  onRetry: () => void;
  /** Opens Windows Bluetooth settings; the button is left out without it. */
  onOpenBluetoothSettings?: () => void;
  titleRef?: Ref<HTMLHeadingElement>;
}

/**
 * Connecting failed: "Connection failed", the reason in one line, Try again
 * and Bluetooth settings, with the raw error kept out of the way under a
 * collapsed "Details" disclosure.
 */
export function ConnectionError({ deviceName, model, message, onRetry, onOpenBluetoothSettings, titleRef }: ConnectionErrorProps) {
  const { title, description } = connectionCopy({ kind: "error", deviceName, message, onRetry });
  return (
    <ConnectionState
      visual={<ActivityPulse image={<ConnectionDeviceImage model={model ?? deviceName} />} tone="warning" />}
      title={title}
      description={description}
      titleRef={titleRef}
    >
      <SheetButton onPress={onRetry}>Try again</SheetButton>
      {onOpenBluetoothSettings ? (
        <SheetButton variant="secondary" onPress={onOpenBluetoothSettings}>
          Bluetooth settings
        </SheetButton>
      ) : null}
      {message ? (
        <Disclosure summary="Details">
          <p className="connection-error__message">{message}</p>
        </Disclosure>
      ) : null}
    </ConnectionState>
  );
}
