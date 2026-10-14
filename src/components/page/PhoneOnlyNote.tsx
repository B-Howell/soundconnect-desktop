import { InfoNote } from "../primitives/InfoNote";
import { LabelledSection } from "./LabelledSection";
import "./PhoneOnlyNote.css";

export interface PhoneOnlyNoteProps {
  /** Sony app features this page would hold that a PC cannot offer, in Sony's names. */
  features: readonly string[];
}

/**
 * "Only in the phone app": what Sony's phone app offers here that needs a
 * phone (location, activity, the account, the firmware download), so a
 * missing menu reads as a decision rather than an omission.
 */
export function PhoneOnlyNote({ features }: PhoneOnlyNoteProps) {
  return (
    <LabelledSection title="Only in the phone app">
      <div className="phone-only-note">
        <InfoNote icon="phone">
          {features.join(", ")}.
        </InfoNote>
      </div>
    </LabelledSection>
  );
}
