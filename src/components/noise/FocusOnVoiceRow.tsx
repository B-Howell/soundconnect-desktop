import { ToggleRow } from "../primitives/ToggleRow";

export interface FocusOnVoiceRowProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** The Ambient-mode "Focus on voice" switch, as one list row (render it inside a `<ul>`). */
export function FocusOnVoiceRow({ checked, onChange, disabled }: FocusOnVoiceRowProps) {
  return (
    <ToggleRow
      title="Focus on voice"
      subtitle="Lets voices through, keeps other sound down"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
