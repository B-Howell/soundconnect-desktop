import { Card } from "../primitives/Card";
import "./AlertBanner.css";

export interface AlertBannerProps {
  title: string;
  message: string;
  /**
   * `question`: the headphones wait for an answer (OK and Not now, announced
   * as an alert). `info`: already answered, shown briefly (OK only, polite).
   */
  kind: "question" | "info";
  /** OK. For a question this answers yes. */
  onConfirm: () => void;
  /** Not now (questions only): answers no. */
  onDecline?: () => void;
}

/** A banner at the top of the page for a message from the headphones. Presentational. */
export function AlertBanner({ title, message, kind, onConfirm, onDecline }: AlertBannerProps) {
  return (
    <div className="alert-banner" role={kind === "question" ? "alert" : "status"}>
      <Card inset>
        <div className="alert-banner__body">
          <div className="alert-banner__text">
            <p className="alert-banner__title">{title}</p>
            <p className="alert-banner__message">{message}</p>
          </div>
          <div className="alert-banner__actions">
            {kind === "question" && onDecline ? (
              <button type="button" className="alert-banner__action" onClick={onDecline}>
                Not now
              </button>
            ) : null}
            <button type="button" className="alert-banner__action alert-banner__action--primary" onClick={onConfirm}>
              OK
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
