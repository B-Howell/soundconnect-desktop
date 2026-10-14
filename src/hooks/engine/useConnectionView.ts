import { useMemo } from "react";
import type { ConnectionView } from "../../components/shell/connectionCopy";
import { failureReasonOf } from "../../lib/devices/connectFailureText";
import { displayableName, rememberedTitle } from "../../lib/devices/deviceTitle";
import type { EngineStatus, RememberedDevice } from "../../lib/engine/types";
import { useEngine, useEngineStoreApi } from "../../state/engineContext";
import { selectConnected } from "../../state/engineStore";

/** Failures that mean the device was listed by Windows but would not talk (the only "Connection failed"). */
const ATTEMPT_FAILURES = new Set(["busy", "timeout", "refused"]);

/**
 * The not-connected screen for an engine status (`engine:status`):
 * - `disconnected` with a `busy`, `timeout` or `refused` reason while Windows
 *   lists the device: error ("Connection failed"), whose Try again calls
 *   `onRetry`;
 * - otherwise, with remembered headphones: offline ("Headphones off or
 *   disconnected") when `windowsConnected` is false (including a
 *   `notConnectedToWindows` failure and a link lost because they switched
 *   off), else idle ("Ready to connect": Connect is the call to action); with
 *   nothing remembered, searching ("No headphones set up"), or the error for
 *   a failed attempt;
 * - `discovering`: offline when Windows does not list the remembered
 *   headphones, connecting when it does (the engine is reaching for them),
 *   else searching;
 * - `connecting`, `initialising`, and `ready` before the first snapshot:
 *   connecting to the device the engine named; `reconnecting` when the reason
 *   is `reconnectingAfterSettingChange`.
 * Names are the status's device name when it is not an address, else the
 * remembered headphones' title (`rememberedTitle`).
 */
export function toConnectionView(
  status: EngineStatus,
  onRetry: () => void,
  remembered: RememberedDevice | null = status.remembered ?? null,
): ConnectionView {
  const title = rememberedTitle(remembered);
  const statusName = displayableName(status.deviceName);
  const listed = status.windowsConnected !== false && status.reason !== "notConnectedToWindows";
  switch (status.state) {
    case "disconnected": {
      const attemptFailed = status.reason !== undefined && ATTEMPT_FAILURES.has(status.reason);
      if ((attemptFailed && listed) || (!title && (status.reason || status.lastError))) {
        return {
          kind: "error",
          deviceName: statusName ?? title,
          message: status.lastError ?? status.reason ?? "",
          reason: failureReasonOf(status.reason),
          onRetry,
        };
      }
      if (!title) return { kind: "searching" };
      return listed ? { kind: "idle", deviceName: title } : { kind: "offline", deviceName: title };
    }
    case "discovering":
      if (!title) return { kind: "searching" };
      return listed ? { kind: "connecting", deviceName: statusName ?? title } : { kind: "offline", deviceName: title };
    case "connecting":
    case "initialising":
    case "ready":
      return {
        kind: "connecting",
        deviceName: statusName ?? title ?? "Headphones",
        ...(status.reason === "reconnectingAfterSettingChange" ? { reconnecting: true } : {}),
      };
  }
}

/** The address a retry connects to: the one that failed, else the remembered one. */
export const retryAddress = (status: EngineStatus, remembered: RememberedDevice | null): string | undefined =>
  status.address ?? remembered?.address;

/**
 * The connection screen for the current engine status. Try again connects to
 * the failed (or remembered) address; with neither it sends `reconnect`.
 */
export function useConnectionView(): ConnectionView {
  const status = useEngine((state) => state.status);
  const remembered = useEngine((state) => state.remembered);
  const store = useEngineStoreApi();
  return useMemo(
    () =>
      toConnectionView(
        status,
        () => {
          const address = retryAddress(status, remembered);
          if (address) void store.getState().connectTo(address);
          else void store.getState().send({ type: "reconnect" });
        },
        remembered,
      ),
    [status, remembered, store],
  );
}

/** True once the engine is Ready with a snapshot: the connected pages can render. */
export function useEngineConnected(): boolean {
  return useEngine(selectConnected);
}
