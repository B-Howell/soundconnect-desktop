import type { Ref } from "react";
import { ConnectionDeviceImage } from "../device-art/ConnectionDeviceImage";
import { ActivityPulse } from "./ActivityPulse";
import { connectionCopy } from "./connectionCopy";
import { ConnectionState } from "./ConnectionState";

export interface ConnectionSearchingProps {
  /** The awaited device's model or Bluetooth name, for its photo; a neutral picture without one. */
  model?: string;
  titleRef?: Ref<HTMLHeadingElement>;
}

/** No device yet: a product photo with breathing rings, and the one thing to check. */
export function ConnectionSearching({ model, titleRef }: ConnectionSearchingProps) {
  const { title, description } = connectionCopy({ kind: "searching" });
  return (
    <ConnectionState
      visual={<ActivityPulse image={<ConnectionDeviceImage model={model} />} animated />}
      title={title}
      description={description}
      titleRef={titleRef}
    />
  );
}
