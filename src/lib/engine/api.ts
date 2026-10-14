import type { AlertEvent, DeviceInfo, DevicesEvent, EngineCommand, EngineStatus, SnapshotPayload } from "./types";

/** Stops a subscription. Synchronous, so a React effect cleanup can call it. */
export type Unsubscribe = () => void;

/**
 * Everything the renderer can ask of the engine: one method per Tauri command
 * in `src-tauri/src/commands.rs` and one subscription per window event. The
 * Tauri implementation is `tauriEngineApi`; `createMockEngineApi` serves the
 * recorded XM4 snapshot in a plain browser and in tests.
 */
export interface EngineApi {
  /** `engine_status` */
  status(): Promise<EngineStatus>;
  /** `engine_snapshot`: the latest payload, or null when not connected. */
  snapshot(): Promise<SnapshotPayload | null>;
  /** `engine_send(command)`: queues one command. */
  send(command: EngineCommand): Promise<void>;
  /** `engine_devices`: Bluetooth devices Windows has connected. */
  devices(): Promise<DeviceInfo[]>;
  /** `engine_connect(address)` */
  connect(address: string): Promise<void>;
  /** `engine_disconnect`: drops the link and stops auto-connecting until `reconnect`. */
  disconnect(): Promise<void>;
  /** `engine:status` */
  onStatus(handler: (status: EngineStatus) => void): Unsubscribe;
  /** `engine:snapshot` */
  onSnapshot(handler: (payload: SnapshotPayload) => void): Unsubscribe;
  /** `engine:alert` */
  onAlert(handler: (alert: AlertEvent) => void): Unsubscribe;
  /** `engine:devices`: the answer to a `scan` command. */
  onDevices(handler: (event: DevicesEvent) => void): Unsubscribe;
}
