import { deviceModelImage, findDeviceModel } from "../../lib/devices/models";
import "./DeviceImage.css";

export interface DeviceImageProps {
  /** Sony model or Bluetooth name ("WH-1000XM4", "LinkBuds S"); empty or absent when unknown. */
  model?: string | null;
  /** Side of the square box in px; the photo fits inside it without stretching. */
  size: number;
  /** "thumb" loads the 256 px file (rail, small sizes); "full" the up-to-1200 px one. */
  variant?: "full" | "thumb";
}

/**
 * Sony's own product photo of a headphone model (see `lib/devices/models`),
 * shown as is: no filters, no recolouring, contained in a `size` square.
 * Unknown Sony models get the family's photo (WH-1000XM5 or WF-1000XM5),
 * and with no model at all the WH-1000XM5 stands in as neutral headphones.
 * The alt text is the device's name.
 */
export function DeviceImage({ model, size, variant = "full" }: DeviceImageProps) {
  const picture = deviceModelImage(model);
  const alt = findDeviceModel(model)?.displayName ?? (model?.trim() || "Headphones");
  return (
    <img
      className="device-image"
      src={variant === "thumb" ? picture.thumb : picture.image}
      alt={alt}
      width={size}
      height={size}
      loading="eager"
      decoding="async"
      draggable={false}
      data-model={picture.model.id}
    />
  );
}
