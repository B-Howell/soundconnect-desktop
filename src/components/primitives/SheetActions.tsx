import type { ReactNode } from "react";
import "./SheetActions.css";

export interface SheetActionsProps {
  /** `SheetButton`s, most important first. */
  children: ReactNode;
}

/** A sheet's column of full-width buttons with the iOS 12 px gap (power off, a paired device's actions). */
export function SheetActions({ children }: SheetActionsProps) {
  return <div className="sheet-actions">{children}</div>;
}
