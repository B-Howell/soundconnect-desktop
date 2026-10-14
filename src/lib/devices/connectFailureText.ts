import type { ConnectFailureReason, StatusReason } from "../engine/types";

/**
 * What to tell the user when a connect attempt fails, by the engine's
 * `reason`. Each sentence says what happened and what to do next; shared by
 * the setup wizard and the remembered-device card so they never disagree.
 */
export const connectFailureText: Readonly<Record<ConnectFailureReason, string>> = {
  notConnectedToWindows:
    "They are off, out of range, or not connected to Windows. Switch them on and connect them in Bluetooth settings, then try again.",
  busy: "Another app is controlling the headphones (for example the Sony app on your phone). Close it and try again.",
  timeout: "The headphones did not answer in time. Make sure they are switched on and nearby, then try again.",
  refused: "The headphones refused the connection. Switch them off and on again, then try again.",
};

/** The failure part of a status reason (`reconnectingAfterSettingChange` is not a failure). */
export function failureReasonOf(reason: StatusReason | undefined): ConnectFailureReason | undefined {
  return reason === "reconnectingAfterSettingChange" ? undefined : reason;
}

/** The sentence for a failure: the reason's text, else a general one. */
export function failureText(reason: ConnectFailureReason | undefined): string {
  return reason
    ? connectFailureText[reason]
    : "Make sure they're switched on and connected in Windows Bluetooth settings, then try again.";
}
