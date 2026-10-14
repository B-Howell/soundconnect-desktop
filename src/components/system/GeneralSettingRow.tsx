import { ToggleRow } from "../primitives/ToggleRow";

export interface GeneralSettingRowProps {
  /** The device's setting index (`MDRGeneralSettingInfo.index`), echoed back in `onChange`. */
  index: number;
  /** Display name (from `MDR_TEXT_GENERAL_SETTING_SUBJECT`). */
  subject: string;
  /** Explanation under the name (from `MDR_TEXT_GENERAL_SETTING_SUMMARY`). */
  summary?: string;
  value: boolean;
  /** False for a setting the device reports read-only: the switch shows the value but is disabled. */
  writable: boolean;
  disabled?: boolean;
  onChange: (index: number, value: boolean) => void;
}

/** One boolean general setting (for example the touch panel), as a switch row inside a `<ul>`. */
export function GeneralSettingRow({ index, subject, summary, value, writable, disabled, onChange }: GeneralSettingRowProps) {
  return (
    <ToggleRow
      title={subject}
      subtitle={summary}
      checked={value}
      onChange={(next) => onChange(index, next)}
      disabled={disabled || !writable}
    />
  );
}
