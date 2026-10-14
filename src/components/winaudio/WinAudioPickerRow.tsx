import { useSheet } from "../../hooks/useSheet";
import type { RowControl, SettingRow } from "../../lib/winaudio/rows";
import type { Change } from "../../lib/winaudio/types";
import { ListRow } from "../primitives/ListRow";
import { OptionList } from "../primitives/OptionList";
import { Sheet } from "../primitives/Sheet";
import { RowSubtitle, RowTitle } from "./RowText";

export interface WinAudioPickerRowProps {
  row: SettingRow;
  control: Extract<RowControl, { type: "picker" }>;
  onChange: (change: Change) => void;
  disabled?: boolean;
}

/**
 * A Windows audio setting with a choice (calls mic, ducking, format,
 * exclusive mode): the whole row opens a sheet of options; picking a
 * different one applies its change.
 */
export function WinAudioPickerRow({ row, control, onChange, disabled = false }: WinAudioPickerRowProps) {
  const sheet = useSheet(disabled);
  return (
    <>
      <ListRow
        title={<RowTitle row={row} />}
        subtitle={<RowSubtitle row={row} />}
        disclosure
        disabled={disabled}
        onPress={sheet.show}
      />
      <Sheet open={sheet.open} onClose={sheet.hide} title={row.title}>
        <OptionList
          label={row.title}
          options={control.options}
          value={control.value}
          onSelect={(value) => {
            sheet.hide();
            if (value !== control.value) onChange(control.change(value));
          }}
        />
      </Sheet>
    </>
  );
}
