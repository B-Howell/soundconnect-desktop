import type { ReactNode } from "react";
import "./Pill.css";

export type PillTone = "neutral" | "accent" | "success" | "warning";

export interface PillProps {
  children: ReactNode;
  tone?: PillTone;
}

/** Small read-only status chip (codec, connection state, battery warning). */
export function Pill({ children, tone = "neutral" }: PillProps) {
  return <span className={`pill pill--${tone}`}>{children}</span>;
}
