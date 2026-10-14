import { useId } from "react";
import { DeviceImage } from "../device-art/DeviceImage";
import { Card } from "../primitives/Card";
import { BatteryGauge } from "./BatteryGauge";
import { CodecBadge } from "./CodecBadge";
import "./DeviceHeader.css";

/** Side of the photo's square box in px. */
const DEVICE_HEADER_IMAGE_SIZE = 160;

export interface DeviceHeaderProps {
  /** Device name as shown to the user, for example "WH-1000XM4". */
  name: string;
  /** Battery level, 0-100; the gauge is left out when the device reported none. */
  percent?: number;
  charging: boolean;
  /** Active Bluetooth codec, for example "LDAC"; the badge is left out when unknown. */
  codec?: string;
  /** Firmware version as the device reports it, for example "2.9.0". */
  firmware?: string;
}

/**
 * The device card at the top of Status, desktop-shaped: the model's product
 * photo on the left; the name, then battery and codec on one line, then the firmware
 * on the right (stacked and centred when the card is narrow). Plain props
 * only; mapping engine data to them belongs to the page that owns the device
 * state.
 */
export function DeviceHeader({ name, percent, charging, codec, firmware }: DeviceHeaderProps) {
  const nameId = useId();
  return (
    <Card inset accentEdge>
      <section className="device-header" aria-labelledby={nameId}>
        <DeviceImage model={name} size={DEVICE_HEADER_IMAGE_SIZE} />
        <div className="device-header__details">
          <h2 className="device-header__name" id={nameId}>
            {name}
          </h2>
          <div className="device-header__status">
            {percent !== undefined ? <BatteryGauge percent={percent} charging={charging} /> : null}
            {codec ? <CodecBadge codec={codec} /> : null}
          </div>
          {firmware ? <p className="device-header__firmware">Firmware {firmware}</p> : null}
        </div>
      </section>
    </Card>
  );
}
