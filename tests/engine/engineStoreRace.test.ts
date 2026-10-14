/** `load()` against events that arrive while its reads are in flight (review finding, Task 11). */
import { describe, expect, it } from "vitest";
import type { EngineApi } from "../../src/lib/engine/api";
import type { EngineStatus, SnapshotPayload } from "../../src/lib/engine/types";
import { createEngineStore, selectConnected } from "../../src/state/engineStore";
import recorded from "../fixtures/snapshots/xm4-ready.json";

const xm4 = (): SnapshotPayload => structuredClone(recorded) as SnapshotPayload;

/** An api whose `status()` answers with an old state only after an event has been pushed. */
function racingApi() {
  let pushStatus: (s: EngineStatus) => void = () => undefined;
  let pushSnapshot: (p: SnapshotPayload) => void = () => undefined;
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const api: EngineApi = {
    status: async () => {
      await gate;
      return { state: "initialising", deviceName: "WH-1000XM4" };
    },
    snapshot: async () => null,
    send: async () => undefined,
    devices: async () => [],
    connect: async () => undefined,
    disconnect: async () => undefined,
    onStatus: (h) => ((pushStatus = h), () => undefined),
    onSnapshot: (h) => ((pushSnapshot = h), () => undefined),
    onAlert: () => () => undefined,
    onDevices: () => () => undefined,
  };
  return {
    api,
    push: { status: (s: EngineStatus) => pushStatus(s), snapshot: (p: SnapshotPayload) => pushSnapshot(p) },
    release: () => release(),
  };
}

describe("engine store load race", () => {
  it("keeps a newer status event over an older status read", async () => {
    const { api, push, release } = racingApi();
    const store = createEngineStore(api);
    store.getState().connect();
    await Promise.resolve();
    const loading = store.getState().load();
    await Promise.resolve();
    push.status({ state: "ready", deviceName: "WH-1000XM4", protocol: "V1" });
    push.snapshot(xm4());
    release();
    await loading;
    expect(store.getState().status.state).toBe("ready");
    expect(selectConnected(store.getState())).toBe(true);
  });

  it("clears a pending alert when the link drops", () => {
    const store = createEngineStore(racingApi().api);
    store.getState().receiveAlert({ message: "SOMETHING", autoResponse: null });
    store.getState().receiveStatus({ state: "disconnected", lastError: "lost" });
    expect(store.getState().alert).toBeNull();
  });
});
