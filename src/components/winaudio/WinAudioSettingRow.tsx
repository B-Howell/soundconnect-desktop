import { useId } from "react";
import type { SettingRow } from "../../lib/winaudio/rows";
import type { Change, SettingsPage } from "../../lib/winaudio/types";
import { ListRow } from "../primitives/ListRow";
import { TextButton } from "../primitives/TextButton";
import { Toggle } from "../primitives/Toggle";
import { RowSubtitle, RowTitle, RowValue } from "./RowText";
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
 * "Recommended: …" only when the live state differs, then the live state and
 * its control on the right: a switch, a picker, "Open" for a setting only
 * Windows Settings can change, or the value alone for a fact.
 */
export function WinAudioSettingRow({ row, onChange, onOpenSettings, busy = false }: WinAudioSettingRowProps) {
  const titleId = useId();
  const control = row.control;
  if (control.type === "picker") {
    return <WinAudioPickerRow row={row} control={control} onChange={onChange} disabled={busy} />;
  }
  const trailing = (
    <>
      <RowValue value={row.current} />
      {control.type === "toggle" ? (
        <Toggle
          checked={control.checked}
          labelledBy={titleId}
          disabled={busy || control.disabled}
          onChange={(checked) => onChange(control.change(checked))}
        />
      ) : control.type === "openSettings" ? (
        <TextButton onPress={() => onOpenSettings(control.page)}>Open</TextButton>
      ) : null}
    </>
  );
  return (
    <ListRow
      title={<RowTitle row={row} />}
      titleId={titleId}
      subtitle={<RowSubtitle row={row} />}
      trailing={trailing}
    />
  );
}
