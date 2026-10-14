import { Icon, type IconName } from "../icons/Icon";
import "./TransportButton.css";

export interface TransportButtonProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  /** The larger play / pause disc. */
  primary?: boolean;
  disabled?: boolean;
}

/** A round glyph button of the transport row: a 44 px target, or a 56 px disc when primary. */
export function TransportButton({ icon, label, onPress, primary = false, disabled }: TransportButtonProps) {
  return (
    <button
      type="button"
      className={primary ? "transport-button transport-button--primary" : "transport-button"}
      aria-label={label}
      disabled={disabled}
      onClick={onPress}
    >
      <Icon name={icon} fill="currentColor" data-icon={icon} />
    </button>
  );
}
