import { Card } from "../primitives/Card";
import { LabelledSection } from "./LabelledSection";
import { PlaceholderMessage } from "./PlaceholderMessage";

export interface PlaceholderSectionProps {
  /** Section label above the card. */
  title: string;
  /** The quiet line inside the empty card. */
  message?: string;
}

/**
 * A labelled, empty grouped section with one quiet line, for content the
 * headphones do not offer (the default message) or cannot show yet.
 * Composition only (section + card + message), so no CSS of its own.
 */
export function PlaceholderSection({ title, message = "Not available on these headphones." }: PlaceholderSectionProps) {
  return (
    <LabelledSection title={title}>
      <Card>
        <PlaceholderMessage>{message}</PlaceholderMessage>
      </Card>
    </LabelledSection>
  );
}
