import type { Ref } from "react";
import { SheetButton } from "../primitives/SheetButton";
import { ConnectionDeviceImage } from "../device-art/ConnectionDeviceImage";
import { ActivityPulse } from "./ActivityPulse";
import { connectionCopy } from "./connectionCopy";
import { ConnectionState } from "./ConnectionState";

export interface ConnectionSearchingProps {
  /** The awaited device's model or Bluetooth name, for its photo; a neutral picture without one. */
  model?: string;
  titleRef?: Ref<HTMLHeadingElement>;
  /** Opens the setup wizard; the "Set up" button is left out without it. */
  onSetUp?: () => void;
}

/** Nothing remembered: "No headphones set up" and Set up. */
export function ConnectionSearching({ model, titleRef, onSetUp }: ConnectionSearchingProps) {
  const { title } = connectionCopy({ kind: "searching" });
  return (
    <ConnectionState
      visual={<ActivityPulse image={<ConnectionDeviceImage model={model} />} />}
      title={title}
      titleRef={titleRef}
    >
      {onSetUp ? <SheetButton onPress={onSetUp}>Set up</SheetButton> : null}
    </ConnectionState>
  );
}
