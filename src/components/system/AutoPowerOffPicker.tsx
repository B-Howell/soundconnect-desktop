import { PickerRow } from "../primitives/PickerRow";
import type { Option } from "../primitives/OptionList";
import type { AutoPowerOffMinutes } from "./autoPowerOff";

export interface AutoPowerOffPickerProps {
  /** Only the choices this device accepts (see `V1_AUTO_POWER_OFF_OPTIONS`); `null` is off. */
  options: readonly Option<AutoPowerOffMinutes>[];
  value: AutoPowerOffMinutes;
  onChange: (minutes: AutoPowerOffMinutes) => void;
  disabled?: boolean;
}

/** "Auto power off" row: the current timer, opening a sheet of the device's choices. */
export function AutoPowerOffPicker({ options, value, onChange, disabled }: AutoPowerOffPickerProps) {
  return <PickerRow title="Auto power off" options={options} value={value} onChange={onChange} disabled={disabled} />;
}
