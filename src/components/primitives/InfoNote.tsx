import type { ReactNode } from "react";
import { Icon, type IconName } from "../icons/Icon";
import "./InfoNote.css";

export interface InfoNoteProps {
  children: ReactNode;
  /** Leading glyph, `info` by default. */
  icon?: IconName;
}

/**
 * A quiet explanatory line inside a card: a small secondary glyph and 13 px
 * secondary text (what the ambient slider's two lowest stops are, what
 * pairing mode does). Not a live region; the text is read in order.
 */
export function InfoNote({ children, icon = "info" }: InfoNoteProps) {
  return (
    <div className="info-note">
      <Icon name={icon} className="info-note__icon" />
      <p className="info-note__text">{children}</p>
    </div>
  );
}
