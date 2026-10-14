import { failureText } from "../../lib/devices/connectFailureText";
import type { ConnectFailureReason } from "../../lib/engine/types";

/**
 * What the not-connected part of the UI is showing. A UI state, not engine
 * data: `useConnectionView` maps the engine's connection status onto it.
 * `offline` is a remembered device Windows does not list as connected (off or
 * out of range). `idle` is one Windows lists but the engine is not connecting
 * to (auto-connect off): nothing happens until the user selects Connect.
 * `disconnected` is the same with auto-connect on (the user disconnected; the
 * engine waits until they leave and re-enter Windows' list). `takenOver` is
 * one another app (the Sony phone app) took control of; Connect takes it back.
 * `searching` is nothing remembered ("No headphones set up"). `error` is only
 * a connect attempt that failed while Windows listed the device.
 */
export type ConnectionView =
  | { kind: "searching"; deviceName?: string }
  | { kind: "offline"; deviceName: string }
  | { kind: "idle"; deviceName: string }
  | { kind: "disconnected"; deviceName: string }
  | { kind: "takenOver"; deviceName: string }
  | {
      kind: "connecting";
      deviceName: string;
      /** The headphones dropped the link to apply a setting; the engine is reconnecting. */
      reconnecting?: boolean;
    }
  | {
      kind: "error";
      deviceName?: string;
      message: string;
      /** The engine's failure reason, which picks the advice. */
      reason?: ConnectFailureReason;
      onRetry: () => void;
    };

export interface ConnectionCopy {
  /** The state in a few words; the only line for every state but a failure. */
  title: string;
  /** The failure's reason, one short sentence. Errors only (and only when the reason is known). */
  description?: string;
}

/**
 * The words for each state, shared by the cards, the rail and the
 * screen-reader announcer so they never disagree. One line per state (see
 * Renderer, Copy register): no advice and no reassurance; only a failed
 * attempt adds its reason.
 */
export function connectionCopy(view: ConnectionView): ConnectionCopy {
  switch (view.kind) {
    case "searching":
      return { title: "No headphones set up" };
    case "offline":
      return { title: "Headphones off or disconnected" };
    case "idle":
      return { title: "Ready to connect" };
    case "disconnected":
      return { title: "Disconnected" };
    case "takenOver":
      return { title: "Another app has control" };
    case "connecting":
      return { title: view.reconnecting ? "Reconnecting…" : "Connecting…" };
    case "error": {
      const reason = failureText(view.reason);
      return reason ? { title: "Connection failed", description: reason } : { title: "Connection failed" };
    }
  }
}

/** The connection state in a few words, for the rail and the remembered-device card. */
export function connectionStateLabel(view: ConnectionView): string {
  return connectionCopy(view).title;
}

/** What the shell announces: the not-connected states, or the connected device. */
export type AnnouncedConnection = ConnectionView | { kind: "connected"; deviceName?: string };

/**
 * Text for the shell's two live regions: the state politely, an error as an
 * alert ("Connection failed. {reason}", and nothing polite meanwhile, so each
 * error is read once), and "Connected." once connected.
 */
export function connectionAnnouncement(view: AnnouncedConnection): { status: string; alert: string } {
  if (view.kind === "connected") {
    return { status: "Connected.", alert: "" };
  }
  const copy = connectionCopy(view);
  const spoken = copy.description ? `${copy.title}. ${copy.description}` : `${copy.title}.`;
  return view.kind === "error" ? { status: "", alert: spoken } : { status: spoken, alert: "" };
}
