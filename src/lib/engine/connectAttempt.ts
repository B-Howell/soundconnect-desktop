/**
 * One connect attempt the user started (`connect {address}` from the setup
 * wizard or the remembered-device card), followed through the engine's
 * status until it lands:
 * - `ready` with a snapshot -> connected;
 * - `disconnected` with a `reason` (or a `lastError`) -> failed.
 *
 * A `disconnected` without either does not end the attempt: the engine drops
 * any current link before it connects (`Connect{address}` "drops any link"),
 * and that drop is not the answer. A status that names another address is
 * not the answer either: with headphones A connected, A's statuses and
 * snapshots keep arriving until the engine drops A for B.
 */
import { failureReasonOf } from "../devices/connectFailureText";
import type { ConnectFailureReason, EngineStatus } from "./types";

export type ConnectAttempt =
  | { phase: "connecting"; address: string }
  | { phase: "connected"; address: string }
  | { phase: "failed"; address: string; reason?: ConnectFailureReason; message?: string };

export const startAttempt = (address: string): ConnectAttempt => ({ phase: "connecting", address });

/** The attempt after a new status (and whether a snapshot is held); settled attempts never change. */
export function advanceAttempt(
  attempt: ConnectAttempt | null,
  status: EngineStatus,
  hasSnapshot: boolean,
): ConnectAttempt | null {
  if (!attempt || attempt.phase !== "connecting") return attempt;
  if (status.address !== undefined && status.address !== attempt.address) return attempt;
  if (status.state === "disconnected" && (status.reason || status.lastError)) {
    return { phase: "failed", address: attempt.address, reason: failureReasonOf(status.reason), message: status.lastError };
  }
  if (status.state === "ready" && hasSnapshot && status.address === attempt.address) {
    return { phase: "connected", address: attempt.address };
  }
  return attempt;
}
