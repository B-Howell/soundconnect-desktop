/**
 * The engine store: connection status, the latest snapshot payload, a pending
 * alert, and the optimistic layer between a user's command and the device's
 * confirmation.
 *
 * Optimistic rules (tested in tests/engine/engineStore.test.ts):
 * - `send(command)` records a patch in the command's slot (`commandKey`; a newer
 *   command in the same slot replaces the older one) and `payload` becomes the
 *   confirmed snapshot with every patch applied (`applyCommand`), so the UI
 *   moves at once.
 * - A snapshot that already shows a patch's effect (`reflects`) clears it.
 * - A snapshot that disagrees clears it only once the patch is older than
 *   `settleMs`: a throttled slider's earlier echoes arrive after newer values
 *   were sent, and must not snap the control back. Without any snapshot the
 *   patch stays, which keeps a value the device acknowledges silently (the v1
 *   auto power off) on screen.
 * - While a slider's gesture is active (`holdEcho(key, true)`), its patch is
 *   never cleared: device echoes are held until `holdEcho(key, false)`.
 * - A `send` the engine's queue rejects (`engine_send` returns an error, for
 *   example while not connected) drops its patch and records `error`; a
 *   command the device later refuses is reverted by the settle rule above.
 * - Losing the connection clears the snapshot, the patches, the holds and a
 *   pending alert.
 * - `load()` reads status and snapshot with two awaits; an event that arrives
 *   meanwhile is newer, so the read never overwrites it (event counters).
 *
 * Setup and connection (the setup wizard and the remembered-device card):
 * - `statusLoaded` turns true with the first status (or a failed `load()`),
 *   so the app does not choose between the wizard and the pages before it
 *   knows what the engine remembers; `hasStatus` is true only for a status
 *   the engine actually sent, so a failed read never opens the wizard.
 * - `remembered` is the last profile the engine named. The status's
 *   `remembered` is the profile of the address it names (`remembered_for` in
 *   `engine_service.rs`), so while connecting to, or failing on, a device
 *   that is not remembered yet it is `null` although another pair is
 *   remembered. Only a status naming no device (the engine's latest profile)
 *   or naming the remembered address can clear it (after "Forget").
 * - `startScan()` sends `scan` and waits for `engine:devices`
 *   (`receiveDevices`, ignored unless a scan is running); no answer within
 *   `scanTimeoutMs` ends it as failed.
 * - `connectTo(address)` sends `connect` and follows the result in `attempt`
 *   (`connectAttempt.ts`).
 *
 * `createEngineStore(api)` exists so tests run it against a mock or a spy; the
 * app uses `engineStore`, bound to `getEngineApi()`.
 */
import { createStore, type StoreApi } from "zustand/vanilla";
import type { EngineApi, Unsubscribe } from "../lib/engine/api";
import { applyCommand, commandKey, reflects } from "../lib/engine/applyCommand";
import { advanceAttempt, startAttempt, type ConnectAttempt } from "../lib/engine/connectAttempt";
import { getEngineApi } from "../lib/engine";
import { CONFIRM_CONNECTION_MODE_CHANGE } from "../lib/engine/types";
import type {
  AlertEvent,
  RememberedDevice,
  DevicesEvent,
  EngineCommand,
  EngineStatus,
  ScannedDevice,
  SnapshotPayload,
} from "../lib/engine/types";

export interface OptimisticPatch {
  key: string;
  command: EngineCommand;
  /** `now()` when it was sent. */
  at: number;
}

/** A device scan for the setup wizard: the devices of the last answer stay listed while a new scan runs. */
export type ScanState =
  | { phase: "idle" }
  | { phase: "scanning"; devices: readonly ScannedDevice[] }
  | { phase: "done"; devices: readonly ScannedDevice[] }
  | { phase: "failed"; devices: readonly ScannedDevice[]; message: string };

export interface EngineState {
  status: EngineStatus;
  /** True once a status has arrived (from `load()` or an event), or `load()` failed. */
  statusLoaded: boolean;
  /** True once the engine has sent a status. */
  hasStatus: boolean;
  /** The remembered headphones, kept across statuses that name another device (see the header). */
  remembered: RememberedDevice | null;
  scan: ScanState;
  /** The connect the user started, until the next one. */
  attempt: ConnectAttempt | null;
  /** The device's latest snapshot, as the engine published it. */
  confirmed: SnapshotPayload | null;
  /** `confirmed` with the pending optimistic patches applied: what the UI shows. */
  payload: SnapshotPayload | null;
  patches: readonly OptimisticPatch[];
  /** Patch keys whose slider gesture is active. */
  held: readonly string[];
  /** The alert waiting for the user, or an auto-answered one to show briefly. */
  alert: AlertEvent | null;
  /** Message of the last failed call. */
  error?: string;
  /** Reads status and snapshot. The newest call wins. */
  load(): Promise<void>;
  /** Subscribes to the three engine events; returns the unsubscribe. */
  connect(): Unsubscribe;
  receiveStatus(status: EngineStatus): void;
  receiveSnapshot(payload: SnapshotPayload): void;
  receiveAlert(alert: AlertEvent): void;
  /** Answers the pending alert and clears it. */
  respondToAlert(positive: boolean): void;
  dismissAlert(): void;
  send(command: EngineCommand): Promise<void>;
  holdEcho(key: string, active: boolean): void;
  receiveDevices(event: DevicesEvent): void;
  /** Sends `scan`; the answer arrives as `engine:devices`. */
  startScan(): Promise<void>;
  /** Sends `connect {address}` and follows the attempt. */
  connectTo(address: string): Promise<void>;
  /** Forgets a settled attempt (for example when the wizard goes back a step). */
  clearAttempt(): void;
  /** Sends `forgetDevice` and drops the attempt, so a past "connected" cannot skip the next setup. */
  forgetDevice(address: string): void;
}

export interface EngineStoreOptions {
  /** How long a disagreeing snapshot is ignored after a send, ms. */
  settleMs?: number;
  now?: () => number;
  /** How long a scan waits for `engine:devices`, ms. */
  scanTimeoutMs?: number;
}

export type EngineStore = StoreApi<EngineState>;

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** The remembered profile after a status (see the header): kept while the status names another, unremembered device. */
export function nextRemembered(current: RememberedDevice | null, status: EngineStatus): RememberedDevice | null {
  if (status.remembered) return status.remembered;
  if (status.remembered === undefined) return current;
  if (!status.address || status.address === current?.address) return null;
  return current;
}

const applyPatches = (confirmed: SnapshotPayload | null, patches: readonly OptimisticPatch[]): SnapshotPayload | null =>
  confirmed ? patches.reduce((payload, patch) => applyCommand(payload, patch.command), confirmed) : null;

/** States in which the engine holds no snapshot (it clears it on link loss). */
const linkless = (status: EngineStatus): boolean =>
  status.state === "disconnected" || status.state === "discovering" || status.state === "connecting";

export function createEngineStore(
  api: EngineApi | Promise<EngineApi>,
  { settleMs = 1500, now = Date.now, scanTimeoutMs = 20_000 }: EngineStoreOptions = {},
): EngineStore {
  const ready = Promise.resolve(api);

  return createStore<EngineState>()((set, get) => {
    let loadSeq = 0;
    /** Bumped by each `engine:status` / `engine:snapshot` event, so `load()` can tell its reads are stale. */
    let statusEvents = 0;
    let snapshotEvents = 0;
    let scanTimer: ReturnType<typeof setTimeout> | undefined;
    let scanSeq = 0;
    const stopScanTimer = () => {
      if (scanTimer !== undefined) clearTimeout(scanTimer);
      scanTimer = undefined;
    };

    const withPatches = (confirmed: SnapshotPayload | null, patches: readonly OptimisticPatch[]) => ({
      confirmed,
      patches,
      payload: applyPatches(confirmed, patches),
    });

    return {
      status: { state: "disconnected" },
      statusLoaded: false,
      hasStatus: false,
      remembered: null,
      scan: { phase: "idle" },
      attempt: null,
      confirmed: null,
      payload: null,
      patches: [],
      held: [],
      alert: null,

      async load() {
        const generation = ++loadSeq;
        try {
          const engine = await ready;
          const statusMark = statusEvents;
          const snapshotMark = snapshotEvents;
          const status = await engine.status();
          const snapshot = await engine.snapshot();
          if (generation !== loadSeq) return;
          if (statusEvents === statusMark) get().receiveStatus(status);
          if (snapshot && snapshotEvents === snapshotMark && !linkless(get().status)) get().receiveSnapshot(snapshot);
        } catch (error) {
          // Without a status the app still has to show something: the pages, not a blank window.
          if (generation === loadSeq) set({ error: messageOf(error), statusLoaded: true });
        }
      },

      connect() {
        let cancelled = false;
        let stop: Unsubscribe | undefined;
        void ready.then((engine) => {
          if (cancelled) return;
          const offStatus = engine.onStatus((status) => {
            statusEvents++;
            get().receiveStatus(status);
          });
          const offSnapshot = engine.onSnapshot((payload) => {
            snapshotEvents++;
            get().receiveSnapshot(payload);
          });
          const offAlert = engine.onAlert((alert) => get().receiveAlert(alert));
          const offDevices = engine.onDevices((event) => get().receiveDevices(event));
          stop = () => {
            offStatus();
            offSnapshot();
            offAlert();
            offDevices();
          };
        });
        return () => {
          cancelled = true;
          stop?.();
        };
      },

      receiveStatus(status) {
        const lost = linkless(status);
        const hasSnapshot = !lost && get().confirmed !== null;
        const attempt = advanceAttempt(get().attempt, status, hasSnapshot);
        const remembered = nextRemembered(get().remembered, status);
        const seen = { status, statusLoaded: true, hasStatus: true, attempt, remembered };
        if (lost) set({ ...seen, ...withPatches(null, []), held: [], alert: null });
        else set(seen);
      },

      receiveSnapshot(payload) {
        const { patches, held } = get();
        const at = now();
        const kept = patches.filter(
          (patch) => held.includes(patch.key) || (!reflects(payload, patch.command) && at - patch.at < settleMs),
        );
        set({ ...withPatches(payload, kept), attempt: advanceAttempt(get().attempt, get().status, true) });
      },

      receiveAlert(alert) {
        set({ alert });
      },

      respondToAlert(positive) {
        const declinedModeChange = !positive && get().alert?.message === CONFIRM_CONNECTION_MODE_CHANGE;
        set({ alert: null });
        if (declinedModeChange) {
          // "Not now": the engine republishes the unchanged snapshot, which the
          // still-settling optimistic patch would otherwise mask. Drop it now.
          const patches = get().patches.filter((p) => p.command.type !== "setConnectionMode");
          set(withPatches(get().confirmed, patches));
        }
        void get().send({ type: "respondToAlert", positive });
      },

      dismissAlert() {
        set({ alert: null });
      },

      async send(command) {
        // A new connection-quality choice supersedes an unanswered confirmation
        // (the engine withdraws it, or raises a fresh one for the new choice).
        if (command.type === "setConnectionMode" && get().alert?.message === CONFIRM_CONNECTION_MODE_CHANGE) {
          set({ alert: null });
        }
        const key = commandKey(command);
        let patch: OptimisticPatch | undefined;
        if (key && get().confirmed) {
          patch = { key, command, at: now() };
          const patches = [...get().patches.filter((p) => p.key !== key), patch];
          set(withPatches(get().confirmed, patches));
        }
        try {
          await (await ready).send(command);
        } catch (error) {
          const patches = get().patches.filter((p) => p !== patch);
          set({ ...withPatches(get().confirmed, patches), error: messageOf(error) });
        }
      },

      holdEcho(key, active) {
        const held = get().held.filter((k) => k !== key);
        set({ held: active ? [...held, key] : held });
      },

      receiveDevices({ devices }) {
        if (get().scan.phase !== "scanning") return;
        stopScanTimer();
        set({ scan: { phase: "done", devices } });
      },

      async startScan() {
        const previous = get().scan;
        if (previous.phase === "scanning") return;
        const devices = previous.phase === "idle" ? [] : previous.devices;
        const generation = ++scanSeq;
        stopScanTimer();
        set({ scan: { phase: "scanning", devices } });
        scanTimer = setTimeout(() => {
          scanTimer = undefined;
          const current = get().scan;
          if (current.phase === "scanning") {
            set({ scan: { phase: "failed", devices: current.devices, message: "No response." } });
          }
        }, scanTimeoutMs);
        try {
          await (await ready).send({ type: "scan" });
        } catch (error) {
          if (generation !== scanSeq) return;
          stopScanTimer();
          set({ scan: { phase: "failed", devices, message: messageOf(error) } });
        }
      },

      async connectTo(address) {
        if (get().attempt?.phase === "connecting") return;
        set({ attempt: startAttempt(address) });
        try {
          await (await ready).send({ type: "connect", address });
        } catch (error) {
          const attempt = get().attempt;
          if (attempt?.phase === "connecting" && attempt.address === address) {
            set({ attempt: { phase: "failed", address, message: messageOf(error) } });
          }
        }
      },

      clearAttempt() {
        if (get().attempt?.phase !== "connecting") set({ attempt: null });
      },

      forgetDevice(address) {
        set({ attempt: null });
        void get().send({ type: "forgetDevice", address });
      },
    };
  });
}

/** The app's store, bound to the mock or the Tauri engine. */
export const engineStore: EngineStore = createEngineStore(getEngineApi());

/** Ready with a snapshot: the connected UI can render. */
export const selectConnected = (state: EngineState): boolean =>
  state.status.state === "ready" && state.payload !== null;
