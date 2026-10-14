import { Icon, type IconName } from "../icons/Icon";
import "./ChoiceTile.css";

export interface ChoiceTileProps {
  title: string;
  /** One or two short sentences under the title. */
  description: string;
  icon: IconName;
  /** The current choice: gold edge, check mark, `aria-pressed`. */
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

/**
 * One large selectable card of a "choose a mode" pair (Windows 11 Settings'
 * mode tiles): a glyph tile, the title and a description, and a check in the
 * corner when it is the current choice. A button with `aria-pressed`, since
 * pressing it may ask first (a preview) instead of switching at once.
 */
export function ChoiceTile({ title, description, icon, selected, onSelect, disabled = false }: ChoiceTileProps) {
  return (
    <button
      type="button"
      className={selected ? "choice-tile choice-tile--selected" : "choice-tile"}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
    >
      <span className="choice-tile__head">
        <span className="choice-tile__icon" aria-hidden="true">
          <Icon name={icon} size={22} />
        </span>
        <span className="choice-tile__mark" aria-hidden="true">
          {selected ? <Icon name="check" size={14} strokeWidth={3} /> : null}
        </span>
      </span>
      <span className="choice-tile__title">{title}</span>
      <span className="choice-tile__description">{description}</span>
    </button>
  );
}
