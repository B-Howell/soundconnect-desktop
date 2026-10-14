import type { ReactNode } from "react";
import "./SectionFooter.css";

export interface SectionFooterProps {
  /** One or more short paragraphs (`<p>`), or plain text. */
  children: ReactNode;
}

/** iOS group footer: quiet 13 px text under a card, aligned with the card's text edge. */
export function SectionFooter({ children }: SectionFooterProps) {
  return <div className="section-footer">{children}</div>;
}
