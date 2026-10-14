import type { ReactNode } from "react";
import { useSheet } from "../../hooks/useSheet";
import { ListRow } from "./ListRow";
import { OptionList, type Option, type OptionValue } from "./OptionList";
import { Sheet } from "./Sheet";

export interface PickerRowProps<T extends OptionValue> {
  /** Row title, for example "Auto power off". */
  title: string;
  /** Sheet heading; defaults to `title`. */
  sheetTitle?: string;
  options: readonly Option<T>[];
  value: T;
  /** Called with the picked value; the sheet then closes. Picking the current value only closes it. */
  onChange: (value: T) => void;
  /**
   * Where the current choice shows: `trailing` (iOS value text, for short
   * labels) or `subtitle` (under the title, for long ones such as button
   * functions, so nothing truncates at 380 px).
   */
  valuePlacement?: "trailing" | "subtitle";
  /** Shown when `value` is not among the options. */
  unknownLabel?: string;
  leading?: ReactNode;
  /** Disables the row and closes an open sheet (for example on disconnect). */
  disabled?: boolean;
}

/**
 * A disclosure row showing the current choice that opens a `Sheet` with an
 * `OptionList`. One component for every "pick one of these" setting
 * (equalizer preset, auto power off, a button's function).
 */
export function PickerRow<T extends OptionValue>({
  title,
  sheetTitle = title,
  options,
  value,
  onChange,
  valuePlacement = "trailing",
  unknownLabel = "Unknown",
  leading,
  disabled = false,
}: PickerRowProps<T>) {
  const empty = options.length === 0;
  const sheet = useSheet(disabled || empty);
  const current = options.find((option) => Object.is(option.value, value))?.label ?? unknownLabel;

  return (
    <>
      <ListRow
        title={title}
        leading={leading}
        subtitle={valuePlacement === "subtitle" ? current : undefined}
        trailing={valuePlacement === "trailing" ? current : undefined}
        disclosure
        disabled={disabled || empty}
        onPress={sheet.show}
      />
      <Sheet open={sheet.open} onClose={sheet.hide} title={sheetTitle}>
        <OptionList
          label={sheetTitle}
          options={options}
          value={value}
          onSelect={(next) => {
            if (!Object.is(next, value)) onChange(next);
            sheet.hide();
          }}
        />
      </Sheet>
    </>
  );
}
