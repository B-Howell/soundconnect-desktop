import { failureText } from "../../lib/devices/connectFailureText";
import type { ConnectFailureReason } from "../../lib/engine/types";

/**
 * What the not-connected part of the UI is showing. A UI state, not engine
 * data: `useConnectionView` maps the engine's connection status onto it.
 * `idle` is a remembered device the engine is not connecting to (auto-connect
 * off): nothing happens until the user selects Connect. `searching` names the
 * device when the engine is waiting for the remembered one.
 */
export type ConnectionView =
  | { kind: "searching"; deviceName?: string }
  | { kind: "idle"; deviceName: string }
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
  title: string;
  description: string;
}

/**
 * The friendly title and sentence for each state, shared by the visible card
 * and the screen-reader announcer so the two can never disagree.
 */
export function connectionCopy(view: ConnectionView): ConnectionCopy {
  switch (view.kind) {
    case "searching":
      return view.deviceName
        ? {
            title: `Looking for ${view.deviceName}`,
            description: "SoundConnect connects as soon as Windows is connected to them.",
          }
        : {
            title: "Looking for your headphones",
            description: "Connect them to Windows Bluetooth first.",
          };
    case "idle":
      return {
        title: `${view.deviceName} isn't connected`,
        description: "Switch them on and connect them in Windows Bluetooth settings, then select Connect.",
      };
    case "connecting":
      return view.reconnecting
        ? {
            title: `Reconnecting to ${view.deviceName}`,
            description: "They restarted their Bluetooth connection to apply your setting. This takes a few seconds.",
          }
        : {
            title: `Connecting to ${view.deviceName}`,
            description: "This usually takes a few seconds.",
          };
    case "error":
      return {
        title: view.deviceName ? `Couldn't connect to ${view.deviceName}` : "Couldn't connect to your headphones",
        description: failureText(view.reason),
      };
  }
}

/** The connection state in a few words, for the rail and the remembered-device card. */
export function connectionStateLabel(view: ConnectionView): string {
  switch (view.kind) {
    case "searching":
    case "idle":
      return "Not connected";
    case "connecting":
      return "Connecting…";
    case "error":
      return "Couldn't connect";
  }
}

/** What the shell announces: the not-connected states, or the connected device. */
export type AnnouncedConnection = ConnectionView | { kind: "connected"; deviceName?: string };

/**
 * Text for the shell's two live regions: "title. description" politely for
 * searching and connecting, the same as an alert for an error (and nothing
 * polite meanwhile, so each error is read once), and "Connected to {name}."
 * once connected.
 */
export function connectionAnnouncement(view: AnnouncedConnection): { status: string; alert: string } {
  if (view.kind === "connected") {
    return { status: `Connected to ${view.deviceName ?? "your headphones"}.`, alert: "" };
  }
  const copy = connectionCopy(view);
  const spoken = `${copy.title}. ${copy.description}`;
  return view.kind === "error" ? { status: "", alert: spoken } : { status: spoken, alert: "" };
}
