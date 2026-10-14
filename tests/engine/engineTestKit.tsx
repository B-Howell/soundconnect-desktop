/**
 * Shared test kit: the recorded XM4 payload (tests/fixtures/snapshots/xm4-ready.json,
 * written by the engine from the maintainer's WH-1000XM4), a spy `EngineApi`, and a
 * renderer that puts a store over that api in context.
 */
import { render, renderHook, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { vi } from "vitest";
import type { EngineApi } from "../../src/lib/engine/api";
import type { EngineCommand, EngineStatus, SnapshotPayload } from "../../src/lib/engine/types";
import { EngineStoreProvider } from "../../src/state/engineContext";
import { createEngineStore, type EngineStore } from "../../src/state/engineStore";
import recorded from "../fixtures/snapshots/xm4-ready.json";

/** A fresh deep copy of the recorded payload. */
export const xm4 = (): SnapshotPayload => structuredClone(recorded) as SnapshotPayload;

export const readyStatus: EngineStatus = {
  state: "ready",
  deviceName: "WH-1000XM4",
  address: "AA:BB:CC:12:34:56",
  protocol: "V1",
};

export interface SpyApi extends EngineApi {
  send: ReturnType<typeof vi.fn<(command: EngineCommand) => Promise<void>>>;
}

/** An api that records sends and never pushes events (tests drive the store directly). */
export function spyApi(): SpyApi {
  return {
    status: vi.fn(async () => ({ state: "disconnected" }) as EngineStatus),
    snapshot: vi.fn(async () => null),
    send: vi.fn(async (_command: EngineCommand) => undefined),
    devices: vi.fn(async () => []),
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    onStatus: () => () => undefined,
    onSnapshot: () => () => undefined,
    onAlert: () => () => undefined,
    onDevices: () => () => undefined,
  };
}

/** A store over a spy api, already Ready with the recorded XM4 snapshot. */
export function connectedStore(api: SpyApi = spyApi(), payload: SnapshotPayload = xm4()): EngineStore {
  const store = createEngineStore(api);
  store.getState().receiveStatus(readyStatus);
  store.getState().receiveSnapshot(payload);
  return store;
}

export function withStore(store: EngineStore) {
  return ({ children }: { children: ReactNode }) => (
    <EngineStoreProvider value={store}>{children}</EngineStoreProvider>
  );
}

export function renderWithStore(ui: ReactElement, store: EngineStore, options?: RenderOptions) {
  return render(ui, { wrapper: withStore(store), ...options });
}

export function renderHookWithStore<T>(hook: () => T, store: EngineStore) {
  return renderHook(hook, { wrapper: withStore(store) });
}
