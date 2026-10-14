import { useId, type ReactNode } from "react";
import { ListRow } from "./ListRow";
import { Toggle } from "./Toggle";

export interface ToggleRowProps {
  title: string;
  subtitle?: ReactNode;
  leading?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/**
 * A `ListRow` whose trailing control is a `Toggle` named by the row title.
 * Owns only the id wiring between the two, which every boolean setting row
 * would otherwise repeat.
 */
export function ToggleRow({ title, subtitle, leading, checked, onChange, disabled }: ToggleRowProps) {
  const titleId = useId();
  return (
    <ListRow
      title={title}
      titleId={titleId}
      subtitle={subtitle}
      leading={leading}
      trailing={<Toggle checked={checked} onChange={onChange} labelledBy={titleId} disabled={disabled} />}
    />
  );
}
