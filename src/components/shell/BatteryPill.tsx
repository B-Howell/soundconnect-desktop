import { Pill } from "../primitives/Pill";
import { batteryTone, clampPercent } from "./BatteryGauge";

export interface BatteryPillProps {
  percent: number;
  charging: boolean;
}

/**
 * The battery as a compact chip ("90%", "90% charging"), for places too small
 * for the `BatteryGauge` capsule (the rail's device block). Warning tone below
 * 20 %, like the gauge; a spoken "Battery" prefix, like `CodecBadge`. Not a
 * meter, so the Status page's gauge stays the one battery meter on screen.
 */
export function BatteryPill({ percent, charging }: BatteryPillProps) {
  const value = clampPercent(percent);
  return (
    <Pill tone={batteryTone(value) === "normal" ? "neutral" : "warning"}>
      <span className="sr-only">Battery </span>
      {value}%{charging ? " charging" : ""}
    </Pill>
  );
}
