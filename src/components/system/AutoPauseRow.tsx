import { ToggleRow } from "../primitives/ToggleRow";

export interface AutoPauseRowProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

/** Sony's automatic pause: music pauses when the headphones come off and resumes when they go back on. One list row. */
export function AutoPauseRow({ enabled, onChange, disabled }: AutoPauseRowProps) {
  return (
    <ToggleRow
      title="Automatic pause when headphones are removed"
      checked={enabled}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
