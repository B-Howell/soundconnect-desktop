import type { CSSProperties } from "react";
import { Icon } from "../icons/Icon";
import "./BatteryGauge.css";

export type BatteryTone = "normal" | "low" | "critical";

/** Orange below 20 %, red below 10 %, as iOS warns. Takes the displayed (rounded) percent. */
export function batteryTone(percent: number): BatteryTone {
  if (percent < 10) return "critical";
  if (percent < 20) return "low";
  return "normal";
}

/** Whole percent within 0..100; anything non-finite reads as 0. */
export function clampPercent(percent: number): number {
  return Number.isFinite(percent) ? Math.round(Math.min(Math.max(percent, 0), 100)) : 0;
}

export interface BatteryGaugeProps {
  percent: number;
  charging: boolean;
  /** Accessible name; "Battery" unless several gauges share a view (left / right / case). */
  label?: string;
}

/**
 * A battery capsule filled to `percent`, the percentage, and a bolt while
 * charging. Exposed as a meter whose value text says "83%, charging" so the
 * glyph's meaning is not only visual; the tone is mirrored in `data-tone`.
 */
export function BatteryGauge({ percent, charging, label = "Battery" }: BatteryGaugeProps) {
  const value = clampPercent(percent);
  const tone = batteryTone(value);
  const level = { "--battery-level": `${value}%` } as CSSProperties;
  return (
    <div
      className="battery-gauge"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-valuetext={charging ? `${value}%, charging` : `${value}%`}
      data-tone={tone}
    >
      <span className="battery-gauge__track" aria-hidden="true">
        <span className="battery-gauge__fill" style={level} />
      </span>
      <span className="battery-gauge__percent" aria-hidden="true">
        {value}%
      </span>
      {charging ? <Icon name="bolt" className="battery-gauge__bolt" fill="currentColor" strokeWidth={0} /> : null}
    </div>
  );
}
