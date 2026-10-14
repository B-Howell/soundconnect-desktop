import { GroupedList } from "./GroupedList";
import { ListRow } from "./ListRow";

/** Option values are primitives, so `String(value)` is a unique key and `Object.is` compares them. */
export type OptionValue = string | number | boolean | null;

export interface Option<T extends OptionValue> {
  value: T;
  label: string;
}

export interface OptionListProps<T extends OptionValue> {
  /** Accessible name of the list (usually the sheet's title). */
  label: string;
  options: readonly Option<T>[];
  /** The chosen value; compared with `Object.is`, so `null` can be an option ("Off"). */
  value: T;
  onSelect: (value: T) => void;
}

/**
 * A single-choice list: one pressable row per option, the chosen one marked
 * with a check and `aria-current` (`ListRow.selected`). The body of a picker
 * sheet.
 */
export function OptionList<T extends OptionValue>({ label, options, value, onSelect }: OptionListProps<T>) {
  return (
    <GroupedList aria-label={label}>
      {options.map((option) => (
        <ListRow
          key={String(option.value)}
          title={option.label}
          selected={Object.is(option.value, value)}
          onPress={() => onSelect(option.value)}
        />
      ))}
    </GroupedList>
  );
}
