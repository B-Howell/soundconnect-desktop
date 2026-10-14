import { BatteryPill } from "../shell/BatteryPill";
import { CodecBadge } from "../shell/CodecBadge";
import { DeviceImage } from "../device-art/DeviceImage";
import "./RailDevice.css";

export interface RailDeviceProps {
  /** The device's name, or a generic one while nothing is connected. */
  name: string;
  /** One short line ("Connected", "Connecting…", "Ready to connect"); hidden while connected with a battery reading. */
  state: string;
  connected: boolean;
  percent?: number;
  charging?: boolean;
  codec?: string;
  collapsed?: boolean;
}

/**
 * The compact device block at the top of the rail, centred in a column: the
 * model's product photo (thumbnail), the name, the connection state and,
 * while connected, battery and codec chips. An
 * icon-only rail shows the photo alone, with name and state as its tooltip and
 * as hidden text.
 */
export function RailDevice({ name, state, connected, percent, charging = false, codec, collapsed = false }: RailDeviceProps) {
  if (collapsed) {
    return (
      <div className="rail-device rail-device--collapsed" title={`${name}: ${state}`}>
        <DeviceImage model={name} size={40} variant="thumb" />
        <span className="sr-only">{`${name}: ${state}`}</span>
      </div>
    );
  }
  const chips = connected && (percent !== undefined || codec);
  // Connected with a battery reading: the battery chip says it; no "Connected" line.
  const showState = !(connected && percent !== undefined);
  return (
    <div className="rail-device">
      <DeviceImage model={name} size={72} variant="thumb" />
      <div className="rail-device__text">
        <p className="rail-device__name">{name}</p>
        {showState ? (
          <p className="rail-device__state" data-connected={connected}>
            {state}
          </p>
        ) : null}
      </div>
      {chips ? (
        <div className="rail-device__chips">
          {percent !== undefined ? <BatteryPill percent={percent} charging={charging} /> : null}
          {codec ? <CodecBadge codec={codec} /> : null}
        </div>
      ) : null}
    </div>
  );
}
