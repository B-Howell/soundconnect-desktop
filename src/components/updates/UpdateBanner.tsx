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
 * alert banner: "Version X is available" with Install now / Later / Release
 * notes, a progress bar while downloading, "Installing…" while the installer
 * runs, or the error in plain words with Try again. Non-blocking and
 * presentational; `UpdateBannerHost` feeds it from the updater store.
 */
export function UpdateBanner(props: UpdateBannerProps) {
  const title =
    props.state === "available"
      ? `Version ${props.version} is available`
      : props.state === "downloading"
        ? `Downloading version ${props.version}…`
        : props.state === "installing"
          ? `Installing version ${props.version}…`
          : "Update failed";
  const message =
    props.state === "available"
      ? "Install it now; SoundConnect restarts by itself when it is done."
      : props.state === "downloading"
        ? props.progress === null
          ? "Starting the download."
          : `${Math.round(props.progress * 100)}% downloaded.`
        : props.state === "installing"
          ? "SoundConnect closes and reopens in a moment."
          : props.message;
  return (
    <div className="alert-banner update-banner" role={props.state === "error" ? "alert" : "status"}>
      <Card inset>
        <div className="alert-banner__body">
          <div className="alert-banner__text">
            <p className="alert-banner__title">{title}</p>
            <p className="alert-banner__message">{message}</p>
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
                Release notes
              </button>
              <button type="button" className="alert-banner__action" onClick={props.onLater}>
                Later
              </button>
              <button type="button" className="alert-banner__action alert-banner__action--primary" onClick={props.onInstall}>
                Install now
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
