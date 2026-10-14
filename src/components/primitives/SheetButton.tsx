import type { ReactNode, Ref } from "react";
import "./SheetButton.css";

export type SheetButtonVariant = "primary" | "secondary" | "destructive";

export interface SheetButtonProps {
  children: ReactNode;
  onPress: () => void;
  /** Filled accent (primary), tinted accent (secondary) or tinted red (destructive). */
  variant?: SheetButtonVariant;
  disabled?: boolean;
  /** The native button, for example so a confirmation sheet can focus Cancel first. */
  ref?: Ref<HTMLButtonElement>;
}

/** Full-width 50 px button for the bottom of a card or sheet. */
export function SheetButton({ children, onPress, variant = "primary", disabled = false, ref }: SheetButtonProps) {
  return (
    <button
      ref={ref}
      type="button"
      className={`sheet-button sheet-button--${variant}`}
      disabled={disabled}
      onClick={onPress}
    >
      {children}
    </button>
  );
}
