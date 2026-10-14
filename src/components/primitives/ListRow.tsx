import type { ReactNode } from "react";
import { Icon } from "../icons/Icon";
import "./ListRow.css";

export interface ListRowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Id on the title, so a trailing control can use it as its label. */
  titleId?: string;
  /** Leading glyph, usually an `<Icon>`; sized and tinted by the row. */
  leading?: ReactNode;
  /**
   * Trailing value, chip or control. When `onPress` is set the row is a
   * button, so trailing content must not be interactive.
   */
  trailing?: ReactNode;
  /** Shows a chevron after the trailing content (row leads somewhere). */
  disclosure?: boolean;
  /**
   * Marks the row as the chosen option of a single-choice list (a picker):
   * shows a check mark and sets `aria-current` so the choice is announced,
   * not only drawn.
   */
  selected?: boolean;
  /** Makes the whole row a button with hover and pressed states. */
  onPress?: () => void;
  /** Dims a pressable row and disables its button (for example while disconnected). */
  disabled?: boolean;
}

/**
 * One row of a `GroupedList`: leading glyph, title over optional subtitle,
 * trailing slot. The separator above every row but the first starts at the
 * text edge and runs to the card's right edge, as on iOS.
 */
export function ListRow({
  title,
  subtitle,
  titleId,
  leading,
  trailing,
  disclosure = false,
  selected = false,
  onPress,
  disabled = false,
}: ListRowProps) {
  const content = (
    <>
      {leading ? <span className="list-row__leading">{leading}</span> : null}
      <span className="list-row__main">
        <span className="list-row__text">
          <span className="list-row__title" id={titleId}>
            {title}
          </span>
          {subtitle ? <span className="list-row__subtitle">{subtitle}</span> : null}
        </span>
        {trailing ? <span className="list-row__trailing">{trailing}</span> : null}
        {selected ? <Icon className="list-row__check" name="check" strokeWidth={2.25} /> : null}
        {disclosure ? <Icon className="list-row__chevron" name="chevron-right" strokeWidth={2.25} /> : null}
      </span>
    </>
  );

  const current = selected ? true : undefined;
  return (
    <li className="list-row">
      {onPress ? (
        <button
          type="button"
          className="list-row__content list-row__content--pressable"
          aria-current={current}
          disabled={disabled}
          onClick={onPress}
        >
          {content}
        </button>
      ) : (
        <div className="list-row__content" aria-current={current}>
          {content}
        </div>
      )}
    </li>
  );
}
