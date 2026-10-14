import type { ReactNode } from "react";
import "./SectionHeader.css";

export interface SectionHeaderProps {
  children: string;
  /** Id for the heading, so a section can point `aria-labelledby` at it. */
  id?: string;
  /** Trailing control (for example an "Edit" button); it inherits accent text styling. */
  action?: ReactNode;
}

/** Uppercase 13 px label above a card, aligned with the card's text edge. */
export function SectionHeader({ children, id, action }: SectionHeaderProps) {
  return (
    <div className="section-header">
      <h2 className="section-header__title" id={id}>
        {children}
      </h2>
      {action ? <div className="section-header__action">{action}</div> : null}
    </div>
  );
}
