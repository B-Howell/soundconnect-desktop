import { Card } from "../primitives/Card";
import "../shell/AlertBanner.css";
import "./UpdateBanner.css";

export type UpdateBannerProps =
  | { state: "available"; version: string; onInstall: () => void; onLater: () => void; onNotes: () => void }
  | { state: "downloading"; version: string; /** 0..1, or null while the size is unknown. */ progress: number | null }
  | { state: "installing"; version: string }
  | { state: "error"; message: string; onRetry: () => void; onDismiss: () => void };

/**
 * The update banner at the top of the content, styled like the headphones'
 * alert banner: one line each ("Version X is available." with What's new /
 * Later / Install, "Downloading update… 40%" over a progress bar,
 * "Installing update…"), and only a failure adds its reason, with Try again.
 * Non-blocking and presentational; `UpdateBannerHost` feeds it from the
 * updater store.
 */
export function UpdateBanner(props: UpdateBannerProps) {
  const title =
    props.state === "available"
      ? `Version ${props.version} is available.`
      : props.state === "downloading"
        ? props.progress === null
          ? "Downloading update…"
          : `Downloading update… ${Math.round(props.progress * 100)}%`
        : props.state === "installing"
          ? "Installing update…"
          : "Update failed";
  const message = props.state === "error" ? props.message : "";
  return (
    <div className="alert-banner update-banner" role={props.state === "error" ? "alert" : "status"}>
      <Card inset>
        <div className="alert-banner__body">
          <div className="alert-banner__text">
            <p className="alert-banner__title">{title}</p>
            {message ? <p className="alert-banner__message">{message}</p> : null}
          </div>
          {props.state === "downloading" ? (
            <progress
              className="update-banner__progress"
              aria-label="Download progress"
              max={1}
              value={props.progress ?? undefined}
            />
          ) : null}
          {props.state === "available" ? (
            <div className="alert-banner__actions">
              <button type="button" className="alert-banner__action" onClick={props.onNotes}>
                What&apos;s new
              </button>
              <button type="button" className="alert-banner__action" onClick={props.onLater}>
                Later
              </button>
              <button type="button" className="alert-banner__action alert-banner__action--primary" onClick={props.onInstall}>
                Install
              </button>
            </div>
          ) : null}
          {props.state === "error" ? (
            <div className="alert-banner__actions">
              <button type="button" className="alert-banner__action" onClick={props.onDismiss}>
                Dismiss
              </button>
              <button type="button" className="alert-banner__action alert-banner__action--primary" onClick={props.onRetry}>
                Try again
              </button>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
