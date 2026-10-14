import "./Toggle.css";

interface ToggleBaseProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** A switch must be named: by visible text (preferred) or by a string. */
export type ToggleProps = ToggleBaseProps &
  (
    | {
        /** Id of the visible text that names the switch. */
        labelledBy: string;
        label?: never;
      }
    | {
        /** Accessible name when there is no visible label to point at. */
        label: string;
        labelledBy?: never;
      }
  );

/**
 * iOS switch (51 x 31). A native button with `role="switch"`, so Space and
 * Enter toggle it without extra key handling; the knob slides with a CSS
 * transition that the global reduced-motion rule shortens to nothing.
 */
export function Toggle({ checked, onChange, labelledBy, label, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      className="toggle"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle__knob" />
    </button>
  );
}
