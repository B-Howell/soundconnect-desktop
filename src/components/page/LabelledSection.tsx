import { useId, type ReactNode } from "react";
import { SectionHeader } from "../primitives/SectionHeader";

export interface LabelledSectionProps {
  /** Section label above the content (rendered as the uppercase section header). */
  title: string;
  children: ReactNode;
}

/**
 * A `<section>` named by its visible SectionHeader, so the header is both the
 * label above the card and the section's accessible name. Composition only.
 */
export function LabelledSection({ title, children }: LabelledSectionProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <SectionHeader id={headingId}>{title}</SectionHeader>
      {children}
    </section>
  );
}
