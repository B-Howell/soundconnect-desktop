import type { Option } from "../primitives/OptionList";

/** Minutes until the headphones switch off without a connection; `null` means never. */
export type AutoPowerOffMinutes = number | null;

/**
 * The choices the v1 family (WH-1000XM3 / XM4) accepts. Upstream's
 * docs/device-support/WH-1000XM3.md: "V1 has no 15-minute element
 * (`AutoPowerOffElementId` knows 5/30/60/180 minutes and off)". Labels
 * shorten upstream's "5 minutes of no Bluetooth connection" and "Do not
 * turn off" to fit the row's trailing value.
 */
export const V1_AUTO_POWER_OFF_OPTIONS: readonly Option<AutoPowerOffMinutes>[] = [
  { value: 5, label: "5 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 180, label: "3 hours" },
  { value: null, label: "Never" },
];

/**
 * Every choice upstream's client offers (`kSelections[] = {0, 5, 15, 30, 60, 180}`),
 * for protocol V2 devices, which accept the 15-minute element.
 */
export const ALL_AUTO_POWER_OFF_OPTIONS: readonly Option<AutoPowerOffMinutes>[] = [
  { value: 5, label: "5 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 180, label: "3 hours" },
  { value: null, label: "Never" },
];
