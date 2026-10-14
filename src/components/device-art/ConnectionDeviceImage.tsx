import { DeviceImage } from "./DeviceImage";

/** Side of the product photo's box on the connection screens, in px. */
export const CONNECTION_IMAGE_SIZE = 128;

export interface ConnectionDeviceImageProps {
  /** The device's model or Bluetooth name, when one is known. */
  model?: string;
}

/**
 * The medium product photo the connection screens show: the named device's
 * own model, else the neutral WH-1000XM5 picture (see `DeviceImage`).
 */
export function ConnectionDeviceImage({ model }: ConnectionDeviceImageProps) {
  return <DeviceImage model={model} size={CONNECTION_IMAGE_SIZE} />;
}
