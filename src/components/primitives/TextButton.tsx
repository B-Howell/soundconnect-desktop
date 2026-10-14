import type { ReactNode } from "react";
import "./TextButton.css";

export interface TextButtonProps {
  children: ReactNode;
  onPress: () => void;
  /** Semibold, for the preferred of two text actions. */
  emphasized?: boolean;
  disabled?: boolean;
}

/** A borderless accent-coloured text action (Back, Cancel), at least a row tall to hit easily. */
export function TextButton({ children, onPress, emphasized = false, disabled = false }: TextButtonProps) {
  return (
    <button
      type="button"
      className={emphasized ? "text-button text-button--emphasized" : "text-button"}
      disabled={disabled}
      onClick={onPress}
    >
      {children}
    </button>
  );
}
