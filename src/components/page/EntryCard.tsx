import type { ReactNode } from "react";
import { Icon, type IconName } from "../icons/Icon";
import "./EntryCard.css";

export interface EntryCardProps {
  /** The page it opens; first in the accessible name ("Equalizer, Bright, Clear Bass −1"). */
  title: string;
  /** The current state, the card's headline ("Bright", "Noise cancelling"). */
  value: string;
  /** A short summary under it. */
  detail?: string;
  icon: IconName;
  /** A small decorative picture of the state (a curve, a level bar); hidden from assistive tech. */
  visual?: ReactNode;
  onOpen: () => void;
}

/**
 * A card that opens a sub-page, Windows 11 Settings' navigation row grown
 * into a card: a glyph tile, the current state as the headline with a
 * summary under it, an optional miniature of the state, and a chevron. The
 * whole card is one button; hover lifts the surface, focus draws the ring.
 */
export function EntryCard({ title, value, detail, icon, visual, onOpen }: EntryCardProps) {
  const name = [title, value, detail].filter(Boolean).join(", ");
  return (
    <button type="button" className="entry-card" aria-label={name} onClick={onOpen}>
      <span className="entry-card__icon" aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <span className="entry-card__text">
        <span className="entry-card__value">{value}</span>
        {detail ? <span className="entry-card__detail">{detail}</span> : null}
      </span>
      {visual ? (
        <span className="entry-card__visual" aria-hidden="true">
          {visual}
        </span>
      ) : null}
      <Icon name="chevron-right" size={20} className="entry-card__chevron" />
    </button>
  );
}
