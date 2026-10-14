import type { ReactNode } from "react";
import "./Card.css";

export interface CardProps {
  /** Adds the standard 16 px inner padding; leave off for edge-to-edge content such as lists. */
  inset?: boolean;
  /** Draws the brand's single gold hairline around the card (`--accent-edge`); for the device header only. */
  accentEdge?: boolean;
  children: ReactNode;
}

/** The rounded surface every grouped block sits on (iOS inset-grouped card). */
export function Card({ inset = false, accentEdge = false, children }: CardProps) {
  const className = ["card", inset && "card--inset", accentEdge && "card--accent-edge"].filter(Boolean).join(" ");
  return <div className={className}>{children}</div>;
}
