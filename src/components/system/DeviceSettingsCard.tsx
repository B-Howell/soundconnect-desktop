import { GroupedList } from "../primitives/GroupedList";
import { AutoPauseRow, type AutoPauseRowProps } from "./AutoPauseRow";
import { AutoPowerOffPicker, type AutoPowerOffPickerProps } from "./AutoPowerOffPicker";
import { GeneralSettingRow, type GeneralSettingRowProps } from "./GeneralSettingRow";

export type GeneralSetting = Omit<GeneralSettingRowProps, "onChange" | "disabled">;

export interface DeviceSettingsCardProps {
  /** Boolean general settings the device reported, multipoint excepted (the XM4: the touch panel). */
  generalSettings: readonly GeneralSetting[];
  onGeneralSettingChange: (index: number, value: boolean) => void;
  autoPause?: Omit<AutoPauseRowProps, "disabled">;
  autoPowerOff?: Omit<AutoPowerOffPickerProps, "disabled">;
  disabled?: boolean;
}

/** System's "Device" card: general settings (touch sensor), automatic pause and automatic power off in one grouped list. */
export function DeviceSettingsCard({
  generalSettings,
  onGeneralSettingChange,
  autoPause,
  autoPowerOff,
  disabled,
}: DeviceSettingsCardProps) {
  return (
    <GroupedList aria-label="Device settings">
      {generalSettings.map((setting) => (
        <GeneralSettingRow key={setting.index} {...setting} onChange={onGeneralSettingChange} disabled={disabled} />
      ))}
      {autoPause ? <AutoPauseRow {...autoPause} disabled={disabled} /> : null}
      {autoPowerOff ? <AutoPowerOffPicker {...autoPowerOff} disabled={disabled} /> : null}
    </GroupedList>
  );
}
