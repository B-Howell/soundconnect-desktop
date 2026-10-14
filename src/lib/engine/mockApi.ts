/**
 * An `EngineApi` without Bluetooth, for the browser (`tools/dev-web.ps1`) and
 * tests. It plays the real engine's connection flow
 * (`src-tauri/src/engine_service.rs`): it starts Disconnected, remembering
 * the recorded device unless told otherwise, and connects only when asked
 * (`connect`, `reconnect`, or `setAutoConnect {enabled: true}`), walking
 * Connecting -> Initialising -> Ready on a short timer. It serves a recorded
 * snapshot payload and applies device commands to a local copy with
 * `applyCommand`, echoing the result as an `engine:snapshot` a moment later,
 * as the device would. `scan` answers with an `engine:devices` event.
 *
 * Nothing runs until the first subscription or status request, so a store
 * created in a test that never bootstraps runs no timers.
 */
import type { EngineApi, Unsubscribe } from "./api";
import { applyCommand } from "./applyCommand";
import type {
  AlertEvent,
  ConnectFailureReason,
  ConnectionState,
  DevicesEvent,
  EngineCommand,
  EngineStatus,
  RememberedDevice,
  ScannedDevice,
  SnapshotPayload,
} from "./types";

export interface MockEngineOptions {
  /** Delay between connection states, ms. */
  stepMs?: number;
  /** Delay before a command's snapshot echo, ms. */
  echoMs?: number;
  /** Delay before a scan's `engine:devices` answer, ms. */
  scanMs?: number;
  /** Start with the recorded device remembered (default true); false is a first run. */
  remembered?: boolean;
  /** Connect at start and after a link loss, as the engine does with auto-connect on (default false). */
  autoConnect?: boolean;
  /**
   * Devices a scan finds besides the recorded one. The mock has only one
   * recording, so connecting to one of these fails at once with
   * `notConnectedToWindows`, as the engine does for an address Windows does
   * not list (no socket, no `connecting`).
   */
  otherDevices?: { address: string; name: string }[];
}

export interface MockEngineApi extends EngineApi {
  /** Every command `send` received, oldest first (for tests and the console). */
  readonly sent: readonly EngineCommand[];
  /** Raises an `engine:alert` as the service would. */
  simulateAlert(alert: AlertEvent): void;
  /** Drops the link with an error, as a lost RFCOMM socket does. */
  simulateLinkLoss(lastError: string): void;
  /** Another app takes control: `disconnected` with reason `takenOver`, no reconnect. */
  simulateTakeover(): void;
  /** Makes the next connect attempt fail with `reason`. */
  failNextConnect(reason: ConnectFailureReason): void;
}

const AUTO_SEQUENCE: ConnectionState[] = ["discovering", "connecting", "initialising", "ready"];
const CONNECT_SEQUENCE: ConnectionState[] = ["connecting", "initialising", "ready"];

export function createMockEngineApi(
  fixture: SnapshotPayload,
  {
    stepMs = 400,
    echoMs = 120,
    scanMs = 900,
    remembered: startRemembered = true,
    autoConnect: startAutoConnect = false,
    otherDevices = [],
  }: MockEngineOptions = {},
): MockEngineApi {
  const texts = fixture.snapshot.texts;
  const deviceName = texts.modelName ?? "Headphones";
  const address = texts.uniqueId ?? "00:00:00:00:00:00";
  const profile: RememberedDevice = {
    address,
    name: deviceName,
    modelName: texts.modelName ?? "",
    firmware: texts.firmwareVersion ?? "",
    protocol: fixture.snapshot.protocol,
    lastSeen: 0,
  };
  let remembered: RememberedDevice | null = startRemembered ? profile : null;
  let autoConnect = startAutoConnect;
  let status: EngineStatus = { state: "disconnected", remembered, windowsConnected: true, autoConnect };
  let payload: SnapshotPayload | null = null;
  let started = false;
  let walk: ReturnType<typeof setTimeout> | undefined;
  let pendingFailure: ConnectFailureReason | undefined;
  const sent: EngineCommand[] = [];
  const statusHandlers = new Set<(s: EngineStatus) => void>();
  const snapshotHandlers = new Set<(p: SnapshotPayload) => void>();
  const alertHandlers = new Set<(a: AlertEvent) => void>();
  const devicesHandlers = new Set<(d: DevicesEvent) => void>();

  /** As the engine's `remembered_for`: the named address's profile, else (no address) the latest one. */
  const rememberedFor = (target?: string): RememberedDevice | null =>
    target === undefined ? remembered : remembered?.address === target ? remembered : null;

  const statusFor = (state: ConnectionState): EngineStatus =>
    state === "discovering"
      ? { state, remembered: rememberedFor() }
      : { state, deviceName, address, protocol: fixture.snapshot.protocol, remembered: rememberedFor(address) };

  /** The mock's headphones are listed by Windows unless a status says otherwise (as the engine reports it). */
  const publishStatus = (next: EngineStatus) => {
    next = {
      ...next,
      windowsConnected: next.windowsConnected ?? next.reason !== "notConnectedToWindows",
      autoConnect,
    };
    status = next;
    statusHandlers.forEach((h) => h(next));
  };
  const publishSnapshot = () => {
    const current = payload;
    if (current) snapshotHandlers.forEach((h) => h(current));
  };

  const stopWalk = () => {
    if (walk !== undefined) clearTimeout(walk);
    walk = undefined;
  };

  /** Walks `sequence` to Ready, or fails after the first step when a failure is due. */
  const runConnect = (sequence: ConnectionState[], failure?: ConnectFailureReason) => {
    stopWalk();
    payload = null;
    let index = 0;
    const step = () => {
      if (failure && index === 1) {
        walk = undefined;
        publishStatus({ state: "disconnected", deviceName, address, remembered: rememberedFor(address), reason: failure });
        return;
      }
      const state = sequence[index++];
      if (state === "ready") {
        payload = structuredClone(fixture);
        remembered = { ...profile, lastSeen: Date.now() };
      }
      publishStatus(statusFor(state));
      if (state === "ready") publishSnapshot();
      if (index < sequence.length) walk = setTimeout(step, stepMs);
      else walk = undefined;
    };
    walk = setTimeout(step, stepMs);
  };

  const takeFailure = (): ConnectFailureReason | undefined => {
    const failure = pendingFailure;
    pendingFailure = undefined;
    return failure;
  };

  const drop = (lastError?: string) => {
    stopWalk();
    payload = null;
    publishStatus(lastError ? { state: "disconnected", lastError, remembered } : { state: "disconnected", remembered });
  };

  const scan = () => {
    const devices: ScannedDevice[] = [
      { address, name: deviceName, remembered: remembered?.address === address },
      ...otherDevices.map((d) => ({ ...d, remembered: false })),
    ];
    setTimeout(() => devicesHandlers.forEach((h) => h({ devices })), scanMs);
  };

  const start = () => {
    if (started) return;
    started = true;
    if (autoConnect && remembered) runConnect(AUTO_SEQUENCE);
  };

  const subscribe = <T>(set: Set<(v: T) => void>, handler: (v: T) => void): Unsubscribe => {
    set.add(handler);
    start();
    return () => set.delete(handler);
  };

  const send = async (command: EngineCommand): Promise<void> => {
    sent.push(command);
    switch (command.type) {
      case "disconnect":
      case "powerOff":
        drop();
        return;
      case "reconnect":
        runConnect(AUTO_SEQUENCE, takeFailure());
        return;
      case "connect": {
        const other = otherDevices.find((d) => d.address === command.address);
        if (command.address === address) {
          runConnect(CONNECT_SEQUENCE, takeFailure());
          return;
        }
        stopWalk();
        payload = null;
        const failed: EngineStatus = {
          state: "disconnected",
          deviceName: other?.name,
          address: command.address,
          remembered: rememberedFor(command.address),
          reason: "notConnectedToWindows",
        };
        setTimeout(() => publishStatus(failed), 0);
        return;
      }
      case "scan":
        scan();
        return;
      case "forgetDevice":
        if (remembered?.address !== command.address) return;
        remembered = null;
        drop();
        return;
      case "setAutoConnect": {
        // As the engine: switching it on counts as an appearance; an unchanged value does nothing.
        const switchedOn = command.enabled && !autoConnect;
        autoConnect = command.enabled;
        if (switchedOn && remembered && status.state === "disconnected") runConnect(AUTO_SEQUENCE);
        else publishStatus(status);
        return;
      }
      case "openBluetoothSettings":
        console.info("mock engine: openBluetoothSettings (the real engine opens ms-settings:bluetooth)");
        return;
      case "respondToAlert":
        return;
      default:
        if (!payload || status.state !== "ready") return;
        payload = applyCommand(payload, command);
        setTimeout(publishSnapshot, echoMs);
    }
  };

  return {
    sent,
    status: async () => {
      start();
      return status;
    },
    snapshot: async () => payload,
    send,
    devices: async () => [{ address, name: deviceName }],
    connect: (target) => send({ type: "connect", address: target }),
    disconnect: () => send({ type: "disconnect" }),
    onStatus: (handler) => subscribe(statusHandlers, handler),
    onSnapshot: (handler) => subscribe(snapshotHandlers, handler),
    onAlert: (handler) => subscribe(alertHandlers, handler),
    onDevices: (handler) => subscribe(devicesHandlers, handler),
    simulateAlert: (alert) => alertHandlers.forEach((h) => h(alert)),
    simulateLinkLoss: (lastError) => drop(lastError),
    simulateTakeover: () => {
      stopWalk();
      payload = null;
      publishStatus({
        state: "disconnected",
        deviceName,
        address,
        remembered: rememberedFor(address),
        reason: "takenOver",
        lastError: "An existing connection was forcibly closed by the remote host",
      });
    },
    failNextConnect: (reason) => {
      pendingFailure = reason;
    },
  };
}
