import type { Ref } from "react";
import { ConnectionDeviceImage } from "../device-art/ConnectionDeviceImage";
import { ActivityPulse } from "./ActivityPulse";
import { connectionCopy } from "./connectionCopy";
import { ConnectionState } from "./ConnectionState";

export interface ConnectionConnectingProps {
  deviceName: string;
  /** Model name for the photo when it differs from the Bluetooth name; defaults to `deviceName`. */
  model?: string;
  titleRef?: Ref<HTMLHeadingElement>;
  /** Reconnecting after a setting change made the headphones drop the link. */
  reconnecting?: boolean;
}

/** A device was found and the control channel is opening. */
export function ConnectionConnecting({ deviceName, model, titleRef, reconnecting }: ConnectionConnectingProps) {
  const { title } = connectionCopy({ kind: "connecting", deviceName, reconnecting });
  return (
    <ConnectionState
      visual={<ActivityPulse image={<ConnectionDeviceImage model={model ?? deviceName} />} animated />}
      title={title}
      titleRef={titleRef}
    />
  );
}
