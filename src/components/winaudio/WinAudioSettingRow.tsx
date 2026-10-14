import { useId } from "react";
import type { SettingRow } from "../../lib/winaudio/rows";
import type { Change, SettingsPage } from "../../lib/winaudio/types";
import { ListRow } from "../primitives/ListRow";
import { TextButton } from "../primitives/TextButton";
import { Toggle } from "../primitives/Toggle";
import { RowSubtitle, RowTitle } from "./RowText";
import { WinAudioPickerRow } from "./WinAudioPickerRow";

export interface WinAudioSettingRowProps {
  row: SettingRow;
  /** Applies one change (admin ones raise the Windows prompt). */
  onChange: (change: Change) => void;
  onOpenSettings: (page: SettingsPage) => void;
  /** True while a batch is being applied. */
  busy?: boolean;
}

/**
 * One Windows audio setting: title (shield when admin), plain sentence,
 * live and recommended state, and its control: a switch, a picker, a one-tap
 * action ("Use headphones"), "Open in Windows" for read-only settings, or none.
 */
export function WinAudioSettingRow({ row, onChange, onOpenSettings, busy = false }: WinAudioSettingRowProps) {
  const titleId = useId();
  const control = row.control;
  if (control.type === "picker") {
    return <WinAudioPickerRow row={row} control={control} onChange={onChange} disabled={busy} />;
  }
  const trailing =
    control.type === "toggle" ? (
      <Toggle
        checked={control.checked}
        labelledBy={titleId}
        disabled={busy || control.disabled}
        onChange={(checked) => onChange(control.change(checked))}
      />
    ) : control.type === "action" ? (
      <TextButton emphasized disabled={busy} onPress={() => onChange(control.change)}>
        {control.label}
      </TextButton>
    ) : control.type === "openSettings" ? (
      <TextButton onPress={() => onOpenSettings(control.page)}>Open in Windows</TextButton>
    ) : undefined;
  return (
    <ListRow
      title={<RowTitle row={row} />}
      titleId={titleId}
      subtitle={<RowSubtitle row={row} />}
      trailing={trailing}
    />
  );
}
