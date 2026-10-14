import { useMemo } from "react";
import type { ConnectionView } from "../../components/shell/connectionCopy";
import { failureReasonOf } from "../../lib/devices/connectFailureText";
import { displayableName, rememberedTitle } from "../../lib/devices/deviceTitle";
import type { EngineStatus, RememberedDevice } from "../../lib/engine/types";
import { useEngine, useEngineStoreApi } from "../../state/engineContext";
import { selectConnected } from "../../state/engineStore";

/**
 * The not-connected screen for an engine status (`engine:status`):
 * - `disconnected` with a `reason` or `lastError` (a failed connect, a lost
 *   link): error, whose Try again calls `onRetry`;
 * - `disconnected` otherwise: idle when the engine remembers headphones (it
 *   waits for the user's Connect), else searching;
 * - `discovering`: searching, named after the remembered headphones if any;
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
  switch (status.state) {
    case "disconnected":
      if (status.reason || status.lastError) {
        return {
          kind: "error",
          deviceName: statusName ?? title,
          message: status.lastError ?? status.reason ?? "",
          reason: failureReasonOf(status.reason),
          onRetry,
        };
      }
      return title ? { kind: "idle", deviceName: title } : { kind: "searching" };
    case "discovering":
      return title ? { kind: "searching", deviceName: title } : { kind: "searching" };
    case "connecting":
    case "initialising":
    case "ready":
      return {
        kind: "connecting",
        deviceName: statusName ?? title ?? "your headphones",
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
