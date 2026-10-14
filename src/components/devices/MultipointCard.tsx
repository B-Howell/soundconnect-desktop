import { GroupedList } from "../primitives/GroupedList";
import { ToggleRow } from "../primitives/ToggleRow";

export interface MultipointCardProps {
  enabled: boolean;
  /** The device's explanation (its `MULTIPOINT_SETTING_SUMMARY`), if it sent one. */
  summary?: string;
  /** False when the device reports the setting read-only. */
  writable?: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

/** Sony's "Connect to 2 devices simultaneously" switch. */
export function MultipointCard({ enabled, summary, writable = true, onChange, disabled }: MultipointCardProps) {
  return (
    <GroupedList aria-label="Multipoint">
      <ToggleRow
        title="Connect to 2 devices simultaneously"
        subtitle={summary}
        checked={enabled}
        onChange={onChange}
        disabled={disabled || !writable}
      />
    </GroupedList>
  );
}
