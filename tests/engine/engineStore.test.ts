import { describe, expect, it, vi } from "vitest";
import type { EngineApi } from "../../src/lib/engine/api";
import { applyCommand, NOISE_SLOT } from "../../src/lib/engine/applyCommand";
import type { EngineCommand, EngineStatus, SnapshotPayload } from "../../src/lib/engine/types";
import { createEngineStore, selectConnected } from "../../src/state/engineStore";
import { CONFIRM_CONNECTION_MODE_CHANGE } from "../../src/lib/engine/types";
import recorded from "../fixtures/snapshots/xm4-ready.json";

const xm4 = (): SnapshotPayload => structuredClone(recorded) as SnapshotPayload;
const ready: EngineStatus = { state: "ready", deviceName: "WH-1000XM4", protocol: "V1" };

function setup(send: EngineApi["send"] = async () => undefined) {
  let clock = 1000;
  const api: EngineApi = {
    status: async () => ready,
    snapshot: async () => xm4(),
    send: vi.fn(send),
    devices: async () => [],
    connect: async () => undefined,
    disconnect: async () => undefined,
    onStatus: () => () => undefined,
    onSnapshot: () => () => undefined,
    onAlert: () => () => undefined,
    onDevices: () => () => undefined,
  };
  const store = createEngineStore(api, { settleMs: 1500, now: () => clock });
  store.getState().receiveStatus(ready);
  store.getState().receiveSnapshot(xm4());
  return { store, api, advance: (ms: number) => (clock += ms) };
}

const echo = (command: EngineCommand) => applyCommand(xm4(), command);

describe("engine store", () => {
  it("loads status and snapshot and reports connected", async () => {
    const { api } = setup();
    const store = createEngineStore(api);
    expect(selectConnected(store.getState())).toBe(false);
    await store.getState().load();
    expect(store.getState().status.state).toBe("ready");
    expect(selectConnected(store.getState())).toBe(true);
  });

  it("applies an optimistic patch at once and clears it when a snapshot confirms it", async () => {
    const { store, api } = setup();
    await store.getState().send({ type: "setDsee", enabled: false });
    expect(api.send).toHaveBeenCalledWith({ type: "setDsee", enabled: false });
    expect(store.getState().payload?.snapshot.equalizer?.dseeEnabled).toBe(false);
    expect(store.getState().confirmed?.snapshot.equalizer?.dseeEnabled).toBe(true);
    expect(store.getState().patches).toHaveLength(1);

    store.getState().receiveSnapshot(echo({ type: "setDsee", enabled: false }));
    expect(store.getState().patches).toHaveLength(0);
    expect(store.getState().payload?.snapshot.equalizer?.dseeEnabled).toBe(false);
  });

  it("keeps a patch through a disagreeing snapshot inside the settle time, then lets the device win", async () => {
    const { store, advance } = setup();
    await store.getState().send({ type: "setVolume", volume: 20 });
    // An earlier throttled value's echo arrives first.
    store.getState().receiveSnapshot(echo({ type: "setVolume", volume: 15 }));
    expect(store.getState().payload?.snapshot.playback?.volume).toBe(20);

    advance(2000);
    store.getState().receiveSnapshot(echo({ type: "setVolume", volume: 15 }));
    expect(store.getState().patches).toHaveLength(0);
    expect(store.getState().payload?.snapshot.playback?.volume).toBe(15);
  });

  it("holds echoes for a slider while its gesture is active", async () => {
    const { store, advance } = setup();
    store.getState().holdEcho(NOISE_SLOT, true);
    await store.getState().send({ type: "setAmbientLevel", level: 9 });
    advance(5000);
    store.getState().receiveSnapshot(echo({ type: "setAmbientLevel", level: 4 }));
    store.getState().receiveSnapshot(echo({ type: "setAmbientLevel", level: 9 }));
    expect(store.getState().payload?.noiseView?.ambientLevel).toBe(9);
    expect(store.getState().patches).toHaveLength(1);

    store.getState().holdEcho(NOISE_SLOT, false);
    store.getState().receiveSnapshot(echo({ type: "setAmbientLevel", level: 9 }));
    expect(store.getState().patches).toHaveLength(0);
  });

  it("replaces an older patch in the same slot", async () => {
    const { store } = setup();
    await store.getState().send({ type: "setVolume", volume: 3 });
    await store.getState().send({ type: "setVolume", volume: 4 });
    expect(store.getState().patches).toHaveLength(1);
    expect(store.getState().payload?.snapshot.playback?.volume).toBe(4);
  });

  it("drops the patch and records the error when the engine rejects a command", async () => {
    const { store } = setup(async () => {
      throw new Error("not connected");
    });
    await store.getState().send({ type: "setDsee", enabled: false });
    expect(store.getState().patches).toHaveLength(0);
    expect(store.getState().payload?.snapshot.equalizer?.dseeEnabled).toBe(true);
    expect(store.getState().error).toBe("not connected");
  });

  it("clears snapshot, patches and holds when the link drops", async () => {
    const { store } = setup();
    store.getState().holdEcho("setVolume", true);
    await store.getState().send({ type: "setVolume", volume: 3 });
    store.getState().receiveStatus({ state: "disconnected", lastError: "Unable to receive from the device" });
    expect(store.getState().payload).toBeNull();
    expect(store.getState().patches).toHaveLength(0);
    expect(store.getState().held).toHaveLength(0);
    expect(selectConnected(store.getState())).toBe(false);
  });

  it("answers an alert and clears it", async () => {
    const { store, api } = setup();
    store.getState().receiveAlert({ message: "SOMETHING", autoResponse: null });
    store.getState().respondToAlert(true);
    expect(store.getState().alert).toBeNull();
    await vi.waitFor(() => expect(api.send).toHaveBeenCalledWith({ type: "respondToAlert", positive: true }));
  });

  describe("connection-quality confirmation", () => {
    const confirm = { message: CONFIRM_CONNECTION_MODE_CHANGE, autoResponse: null, requiresChoice: true };
    const mode = (store: ReturnType<typeof setup>["store"]) =>
      store.getState().payload?.snapshot.connectionMode?.audioPriority;

    it("Not now inside the settle time reverts the radio when the engine republishes", async () => {
      const { store, api, advance } = setup();
      await store.getState().send({ type: "setConnectionMode", audioPriority: "quality" });
      store.getState().receiveAlert(confirm);
      expect(mode(store)).toBe("quality");
      advance(200);
      store.getState().respondToAlert(false);
      // The engine republishes the device's unchanged state.
      store.getState().receiveSnapshot(xm4());
      expect(mode(store)).toBe("stability");
      expect(store.getState().alert).toBeNull();
      await vi.waitFor(() => expect(api.send).toHaveBeenCalledWith({ type: "respondToAlert", positive: false }));
    });

    it("OK keeps the optimistic choice", async () => {
      const { store } = setup();
      await store.getState().send({ type: "setConnectionMode", audioPriority: "quality" });
      store.getState().receiveAlert(confirm);
      store.getState().respondToAlert(true);
      store.getState().receiveSnapshot(xm4());
      expect(mode(store)).toBe("quality");
    });

    it("a new choice withdraws the unanswered banner", async () => {
      const { store } = setup();
      await store.getState().send({ type: "setConnectionMode", audioPriority: "quality" });
      store.getState().receiveAlert(confirm);
      await store.getState().send({ type: "setConnectionMode", audioPriority: "stability" });
      expect(store.getState().alert).toBeNull();
      expect(mode(store)).toBe("stability");
    });

    it("a device's own question is not cleared by a connection-quality choice", async () => {
      const { store } = setup();
      const device = { message: "SOME_DEVICE_QUESTION", autoResponse: null, requiresChoice: true };
      store.getState().receiveAlert(device);
      await store.getState().send({ type: "setConnectionMode", audioPriority: "quality" });
      expect(store.getState().alert).toEqual(device);
    });
  });
});
