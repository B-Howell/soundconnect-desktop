import { useId, type Ref } from "react";
import { Card } from "../primitives/Card";
import "./LicenseText.css";

export interface LicenseTextProps {
  /** Whose licence this is, shown as the card's heading and naming the region. */
  heading: string;
  /** The licence's paragraphs (see `licenseParagraphs`). */
  paragraphs: readonly string[];
  /** The focusable region (the licences sheet focuses it first). */
  ref?: Ref<HTMLElement>;
}

/**
 * One licence in a card. The whole card content is a focusable region named
 * by its heading, so a keyboard user can scroll a long licence with the
 * arrow keys, and focusing it scrolls the heading (not the first line of
 * text) to the top.
 */
export function LicenseText({ heading, paragraphs, ref }: LicenseTextProps) {
  const headingId = useId();
  return (
    <Card inset>
      <section className="license-text" ref={ref} tabIndex={0} aria-labelledby={headingId}>
        <h3 className="license-text__heading" id={headingId}>
          {heading}
        </h3>
        {paragraphs.map((paragraph, index) => (
          <p className="license-text__paragraph" key={index}>
            {paragraph}
          </p>
        ))}
      </section>
    </Card>
  );
}
