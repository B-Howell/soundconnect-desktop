/**
 * The Tauri-backed `EngineApi`: one `invoke` per command in
 * `src-tauri/src/commands.rs` (`engine_status`, `engine_snapshot`,
 * `engine_send`, `engine_devices`, `engine_connect`, `engine_disconnect`;
 * Rust's snake_case arguments arrive as camelCase, here `command` and
 * `address`) and one `listen` per window event the `TauriSink` emits
 * (`engine:status`, `engine:snapshot`, `engine:alert`, `engine:devices`).
 */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { EngineApi, Unsubscribe } from "./api";

export const STATUS_EVENT = "engine:status";
export const SNAPSHOT_EVENT = "engine:snapshot";
export const ALERT_EVENT = "engine:alert";
export const DEVICES_EVENT = "engine:devices";

/**
 * Subscribes to a window event and returns a synchronous unsubscribe. `listen`
 * resolves asynchronously, so an unsubscribe that runs first (React StrictMode's
 * mount-unmount-mount) is remembered and applied once the listener attaches.
 */
function subscribe<T>(event: string, handler: (payload: T) => void): Unsubscribe {
  let unlisten: UnlistenFn | undefined;
  let cancelled = false;
  listen<T>(event, (e) => handler(e.payload))
    .then((stop) => {
      if (cancelled) stop();
      else unlisten = stop;
    })
    .catch((error: unknown) => console.error(`listen(${event}) failed`, error));
  return () => {
    cancelled = true;
    unlisten?.();
  };
}

export const tauriEngineApi: EngineApi = {
  status: () => invoke("engine_status"),
  snapshot: () => invoke("engine_snapshot"),
  send: (command) => invoke("engine_send", { command }),
  devices: () => invoke("engine_devices"),
  connect: (address) => invoke("engine_connect", { address }),
  disconnect: () => invoke("engine_disconnect"),
  onStatus: (handler) => subscribe(STATUS_EVENT, handler),
  onSnapshot: (handler) => subscribe(SNAPSHOT_EVENT, handler),
  onAlert: (handler) => subscribe(ALERT_EVENT, handler),
  onDevices: (handler) => subscribe(DEVICES_EVENT, handler),
};
