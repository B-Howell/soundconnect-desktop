import { useMemo } from "react";
import type { ConnectionAnnouncerProps } from "../../components/shell/ConnectionAnnouncer";
import { connectionAnnouncement } from "../../components/shell/connectionCopy";
import { useEngine } from "../../state/engineContext";
import { useConnectionView, useEngineConnected } from "./useConnectionView";

/**
 * The shell announcer's text for the engine's connection: progress politely,
 * a failure as an alert, and "Connected to {name}" once Ready. It lives in
 * the shell so it stays mounted (and announces) whichever tab is open.
 */
export function useConnectionAnnouncement(): ConnectionAnnouncerProps {
  const view = useConnectionView();
  const connected = useEngineConnected();
  const name = useEngine((state) => state.payload?.snapshot.texts.modelName ?? state.status.deviceName);
  return useMemo(() => connectionAnnouncement(connected ? { kind: "connected", deviceName: name } : view), [
    connected,
    name,
    view,
  ]);
}
