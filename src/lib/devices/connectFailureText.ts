import type { ConnectFailureReason, StatusReason } from "../engine/types";

/**
 * The reason line under "Connection failed", by the engine's `reason`: one
 * short sentence that says what happened, no advice (the buttons are the
 * advice). Shared by the setup wizard and the remembered-device card.
 */
export const connectFailureText: Readonly<Record<ConnectFailureReason, string>> = {
  notConnectedToWindows: "Headphones off or disconnected.",
  busy: "Another app is using the headphones.",
  timeout: "Connection timed out.",
  refused: "Connection refused.",
  takenOver: "Another app has control.",
};

/** The failure part of a status reason (`reconnectingAfterSettingChange` is not a failure). */
export function failureReasonOf(reason: StatusReason | undefined): ConnectFailureReason | undefined {
  return reason === "reconnectingAfterSettingChange" ? undefined : reason;
}

/** The reason line for a failure, or "" when the engine gave no reason (the title says it all). */
export function failureText(reason: ConnectFailureReason | undefined): string {
  return reason ? connectFailureText[reason] : "";
}
