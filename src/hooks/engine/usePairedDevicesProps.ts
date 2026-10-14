import { useCallback, useEffect, useMemo, useState } from "react";
import type { PairedDeviceListProps } from "../../components/devices/PairedDeviceList";
import type { PairedDeviceActionName, PairedDeviceView } from "../../components/devices/pairedDevices";
import { hasFeature, type PairedDevice, type Snapshot } from "../../lib/engine/types";
import { useEngine } from "../../state/engineContext";
import { useEngineSend } from "./useEngineCommand";

/** How long a sent action shows as pending without the device reporting it done, ms. */
export const PAIRED_DEVICE_PENDING_MS = 10_000;

/**
 * This PC among the paired devices. The renderer cannot read the PC's own
 * Bluetooth address, but the headphones are connected to this PC (the app
 * talks to them), so when exactly one device is connected it is this PC.
 * With two connected (multipoint) it cannot tell, and marks neither.
 */
export function thisPcAddress(devices: readonly PairedDevice[]): string | null {
  const connected = devices.filter((device) => device.connected);
  return connected.length === 1 ? connected[0].macAddress : null;
}

/** True once the device list shows `action` done for `id`. */
export function actionDone(devices: readonly PairedDevice[], id: string, action: PairedDeviceActionName): boolean {
  const device = devices.find((d) => d.macAddress === id);
  switch (action) {
    case "connect":
      return device?.connected === true;
    case "disconnect":
      return device !== undefined && !device.connected;
    case "selectPlayback":
      return device?.playbackDevice === true;
    case "unpair":
      return device === undefined;
  }
}

/** The rows from `snapshot.pairedDevices` (`{connected, playbackDevice, macAddress, name}`). */
export function toPairedDeviceViews(
  devices: readonly PairedDevice[],
  pending: Readonly<Record<string, PairedDeviceActionName>> = {},
): PairedDeviceView[] {
  const pc = thisPcAddress(devices);
  const ambiguous = pc === null && devices.filter((device) => device.connected).length > 1;
  return devices.map((device) => ({
    id: device.macAddress,
    name: device.name,
    connected: device.connected,
    playback: device.playbackDevice,
    thisPc: device.macAddress === pc,
    maybeThisPc: ambiguous && device.connected,
    pending: pending[device.macAddress],
  }));
}

interface Pending {
  action: PairedDeviceActionName;
  at: number;
}

const devicesOf = (snapshot: Snapshot | null): PairedDevice[] | null =>
  snapshot && hasFeature(snapshot, "PAIRED_DEVICE_MANAGEMENT") ? snapshot.pairedDevices : null;

/**
 * The paired device list (`PAIRED_DEVICE_MANAGEMENT`), read-only on protocol
 * V1 (the XM4), where the engine drops `setPairedDevice`. An action sends
 * `setPairedDevice {command, deviceId}` with the device's MAC address. These
 * commands are not predicted (they take seconds and may fail), so the row
 * shows the action as pending ("Connecting…") until the headphones report
 * it done, or for at most `PAIRED_DEVICE_PENDING_MS`.
 */
export function usePairedDevicesProps(): PairedDeviceListProps | null {
  const devices = useEngine((state) => devicesOf(state.payload?.snapshot ?? null));
  // Core Services, "Commands added 2026-10-12": libmdr 4c91fe6 rejects
  // setPairedDevice on V1 ("The renderer should not offer these actions when
  // status.protocol == "V1""); the snapshot carries the same protocol.
  const actionsSupported = useEngine((state) => state.payload?.snapshot.protocol !== "V1");
  const send = useEngineSend();
  const [pending, setPending] = useState<Record<string, Pending>>({});

  // Drop what the device now reports done.
  useEffect(() => {
    if (!devices) return;
    setPending((current) => {
      const kept = Object.entries(current).filter(([id, p]) => !actionDone(devices, id, p.action));
      return kept.length === Object.keys(current).length ? current : Object.fromEntries(kept);
    });
  }, [devices]);

  // Expire the oldest pending action.
  useEffect(() => {
    const times = Object.values(pending).map((p) => p.at);
    if (times.length === 0) return;
    // One millisecond past the deadline, so the oldest has expired when the timer fires.
    const wait = Math.max(Math.min(...times) + PAIRED_DEVICE_PENDING_MS - Date.now() + 1, 0);
    const timer = setTimeout(() => {
      const now = Date.now();
      setPending((current) => {
        const kept = Object.entries(current).filter(([, p]) => now - p.at < PAIRED_DEVICE_PENDING_MS);
        return kept.length === Object.keys(current).length ? current : Object.fromEntries(kept);
      });
    }, wait);
    return () => clearTimeout(timer);
  }, [pending]);

  const onAction = useCallback(
    (deviceId: string, action: PairedDeviceActionName) => {
      setPending((current) => ({ ...current, [deviceId]: { action, at: Date.now() } }));
      send({ type: "setPairedDevice", command: action, deviceId });
    },
    [send],
  );

  return useMemo(() => {
    if (!devices) return null;
    const actions = Object.fromEntries(Object.entries(pending).map(([id, p]) => [id, p.action]));
    return { devices: toPairedDeviceViews(devices, actions), onAction, actionsSupported };
  }, [devices, pending, onAction, actionsSupported]);
}
