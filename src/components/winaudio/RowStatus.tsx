import { Icon } from "../icons/Icon";
import "./RowStatus.css";

export interface RowStatusProps {
  current: string;
  /** Omitted for rows that only report a fact. */
  recommended: string | null;
  /** Matches the recommendation (check), does not (warning dot), or no single answer (null). */
  ok: boolean | null;
}

/** "Now: Off · Recommended: Off" with a check or a warning dot, under a row's description. */
export function RowStatus({ current, recommended, ok }: RowStatusProps) {
  const tone = ok === true ? "ok" : ok === false ? "warn" : "neutral";
  return (
    <span className={`row-status row-status--${tone}`}>
      {ok === true ? <Icon name="check" size={14} strokeWidth={2.5} className="row-status__mark" /> : null}
      {ok === false ? <span className="row-status__dot" aria-hidden="true" /> : null}
      <span className="row-status__now">
        <span className="row-status__label">Now</span> {current}
      </span>
      {recommended ? (
        <span className="row-status__recommended">
          <span className="row-status__label">Recommended</span> {recommended}
        </span>
      ) : null}
      {ok === false ? <span className="sr-only">(differs from the recommendation)</span> : null}
    </span>
  );
}
