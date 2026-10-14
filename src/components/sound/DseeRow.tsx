import { ToggleRow } from "../primitives/ToggleRow";
import { dseeTypeName } from "./dseeTypes";

export interface DseeRowProps {
  /** The device can use DSEE now (`MDREqualizer.dsee_available`); the row is not rendered otherwise. */
  available: boolean;
  enabled: boolean;
  /** `MDR_DSEE_*` id (`MDREqualizer.dsee_type`), shown by name under the title. */
  type: number;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

/** The DSEE upscaling switch, one list row (render it inside a `<ul>`); nothing when unavailable. */
export function DseeRow({ available, enabled, type, onChange, disabled }: DseeRowProps) {
  if (!available) return null;
  return (
    <ToggleRow
      title="Upscaling"
      subtitle={dseeTypeName(type)}
      checked={enabled}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
