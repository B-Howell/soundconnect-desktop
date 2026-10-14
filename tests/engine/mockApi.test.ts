import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockEngineApi } from "../../src/lib/engine/mockApi";
import type { EngineStatus, SnapshotPayload } from "../../src/lib/engine/types";
import { createEngineStore, selectConnected } from "../../src/state/engineStore";
import recorded from "../fixtures/snapshots/xm4-ready.json";

const fixture = recorded as SnapshotPayload;

describe("mock engine api", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("walks Disconnected -> Discovering -> Connecting -> Initialising -> Ready and serves the recording", async () => {
    const api = createMockEngineApi(fixture, { stepMs: 100, autoConnect: true });
    const states: EngineStatus["state"][] = [];
    const snapshots: SnapshotPayload[] = [];
    api.onStatus((s) => states.push(s.state));
    api.onSnapshot((p) => snapshots.push(p));
    expect((await api.status()).state).toBe("disconnected");
    await vi.advanceTimersByTimeAsync(400);
    expect(states).toEqual(["discovering", "connecting", "initialising", "ready"]);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].snapshot.texts.modelName).toBe("WH-1000XM4");
    expect((await api.snapshot())?.snapshot.equalizer?.preset).toBe("bright");
  });

  it("drives a store to Ready, echoes commands, powers off and reconnects", async () => {
    const api = createMockEngineApi(fixture, { stepMs: 100, echoMs: 50, autoConnect: true });
    const store = createEngineStore(api);
    const stop = store.getState().connect();
    await store.getState().load();
    await vi.advanceTimersByTimeAsync(400);
    expect(store.getState().status).toMatchObject({ state: "ready", deviceName: "WH-1000XM4", protocol: "V1" });
    expect(selectConnected(store.getState())).toBe(true);

    await store.getState().send({ type: "setDsee", enabled: false });
    await vi.advanceTimersByTimeAsync(50);
    expect(store.getState().confirmed?.snapshot.equalizer?.dseeEnabled).toBe(false);
    expect(store.getState().patches).toHaveLength(0);

    await store.getState().send({ type: "powerOff" });
    expect(store.getState().status.state).toBe("disconnected");
    expect(store.getState().payload).toBeNull();

    await store.getState().send({ type: "reconnect" });
    await vi.advanceTimersByTimeAsync(400);
    expect(selectConnected(store.getState())).toBe(true);
    expect(api.sent.map((c) => c.type)).toEqual(["setDsee", "powerOff", "reconnect"]);
    stop();
  });
});
