import { useMemo } from "react";
import type { RailDeviceProps } from "../../components/frame/RailDevice";
import { connectionStateLabel, type ConnectionView } from "../../components/shell/connectionCopy";
import type { DeviceHeaderProps } from "../../components/shell/DeviceHeader";
import { displayableName, rememberedTitle } from "../../lib/devices/deviceTitle";
import { useEngine } from "../../state/engineContext";
import { useConnectionView, useEngineConnected } from "./useConnectionView";
import { useDeviceHeaderProps } from "./useDeviceHeaderProps";

export interface RailDeviceSource {
  /** Ready with a snapshot (`useEngineConnected`). */
  connected: boolean;
  header: DeviceHeaderProps | null;
  view: ConnectionView;
  /** The device the engine names in its status, if any (ignored when it is an address). */
  statusName?: string;
  /** The remembered headphones' title (`rememberedTitle`), shown while nothing is connected. */
  rememberedName?: string;
}

/**
 * The rail's device block: once connected, the header's name, battery and
 * codec with the state "Connected"; otherwise the name the engine's status
 * carries, else the remembered headphones' name (else "Headphones"), and the
 * connection screen's state in a few words ("Not connected", "Connecting…").
 */
export function toRailDeviceProps({ connected, header, view, statusName, rememberedName }: RailDeviceSource): Omit<RailDeviceProps, "collapsed"> {
  if (connected && header) {
    return {
      name: header.name,
      state: "Connected",
      connected: true,
      percent: header.percent,
      charging: header.charging,
      codec: header.codec,
    };
  }
  return { name: displayableName(statusName) ?? rememberedName ?? "Headphones", state: connectionStateLabel(view), connected: false };
}

/** The rail's device block for the current engine state. */
export function useRailDeviceProps(): Omit<RailDeviceProps, "collapsed"> {
  const connected = useEngineConnected();
  const header = useDeviceHeaderProps();
  const view = useConnectionView();
  const statusName = useEngine((state) => state.status.deviceName);
  const rememberedName = useEngine((state) => rememberedTitle(state.remembered));
  return useMemo(
    () => toRailDeviceProps({ connected, header, view, statusName, rememberedName }),
    [connected, header, view, statusName, rememberedName],
  );
}
