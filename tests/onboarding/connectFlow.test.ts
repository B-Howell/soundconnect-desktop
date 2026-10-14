/** Pure pieces of the setup and connection flows: attempts, the store's scan and connect, pairing families, the mock. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectFailureText, failureText } from "../../src/lib/devices/connectFailureText";
import { familyForModel } from "../../src/lib/devices/pairingInstructions";
import { orderScannedDevices } from "../../src/lib/devices/scannedDevices";
import { advanceAttempt, startAttempt } from "../../src/lib/engine/connectAttempt";
import { createMockEngineApi } from "../../src/lib/engine/mockApi";
import type { DevicesEvent, EngineCommand, EngineStatus, SnapshotPayload } from "../../src/lib/engine/types";
import { createEngineStore, nextRemembered, selectConnected } from "../../src/state/engineStore";
import type { RememberedDevice } from "../../src/lib/engine/types";
import recorded from "../fixtures/snapshots/xm4-ready.json";

const fixture = recorded as SnapshotPayload;
const XM4 = "AA:BB:CC:12:34:56";

/** A spy api whose `engine:devices` handler the test can call. */
function scanApi() {
  let devicesHandler: ((event: DevicesEvent) => void) | undefined;
  const send = vi.fn(async (_command: EngineCommand) => undefined);
  const api = {
    status: async () => ({ state: "disconnected" }) as EngineStatus,
    snapshot: async () => null,
    send,
    devices: async () => [],
    connect: async () => undefined,
    disconnect: async () => undefined,
    onStatus: () => () => undefined,
    onSnapshot: () => () => undefined,
    onAlert: () => () => undefined,
    onDevices: (handler: (event: DevicesEvent) => void) => {
      devicesHandler = handler;
      return () => undefined;
    },
  };
  return { api, send, emitDevices: (event: DevicesEvent) => devicesHandler?.(event) };
}

describe("connect attempt", () => {
  it("fails on a disconnected status with a reason, keeping the reason", () => {
    const next = advanceAttempt(startAttempt(XM4), { state: "disconnected", reason: "busy" }, false);
    expect(next).toEqual({ phase: "failed", address: XM4, reason: "busy", message: undefined });
  });

  it("is not ended by the drop the engine makes before connecting (disconnected without a reason)", () => {
    expect(advanceAttempt(startAttempt(XM4), { state: "disconnected" }, false)).toEqual(startAttempt(XM4));
  });

  it("succeeds only once Ready with a snapshot for its own address", () => {
    expect(advanceAttempt(startAttempt(XM4), { state: "ready", address: XM4 }, false)?.phase).toBe("connecting");
    expect(advanceAttempt(startAttempt(XM4), { state: "ready", address: XM4 }, true)?.phase).toBe("connected");
    // Another pair still connected (its snapshots keep coming) is not the answer.
    expect(advanceAttempt(startAttempt(XM4), { state: "ready", address: "OTHER" }, true)?.phase).toBe("connecting");
    expect(advanceAttempt(startAttempt(XM4), { state: "disconnected", address: "OTHER", lastError: "x" }, false)?.phase).toBe(
      "connecting",
    );
  });
});

describe("remembered profile across statuses", () => {
  const a: RememberedDevice = { address: XM4, name: "WH-1000XM4", modelName: "WH-1000XM4", firmware: "2.9.0", protocol: "V1", lastSeen: 1 };
  it("keeps the profile while the status names another device, clears it when the engine reports none", () => {
    // The engine's status carries the profile of the address it names (remembered_for).
    expect(nextRemembered(a, { state: "connecting", address: "OTHER", remembered: null })).toBe(a);
    expect(nextRemembered(a, { state: "disconnected", address: "OTHER", reason: "busy", remembered: null })).toBe(a);
    expect(nextRemembered(a, { state: "disconnected", remembered: null })).toBeNull();
    expect(nextRemembered(a, { state: "disconnected", address: XM4, remembered: null })).toBeNull();
    expect(nextRemembered(null, { state: "ready", address: XM4, remembered: a })).toBe(a);
  });
});

describe("failure texts", () => {
  it("say what to do for each engine reason", () => {
    expect(failureText("notConnectedToWindows")).toBe(
      "They are off, out of range, or not connected to Windows. Switch them on and connect them in Bluetooth settings, then try again.",
    );
    expect(failureText("busy")).toBe(
      "Another app is controlling the headphones (for example the Sony app on your phone). Close it and try again.",
    );
    expect(Object.keys(connectFailureText).sort()).toEqual(["busy", "notConnectedToWindows", "refused", "timeout"]);
  });
});

describe("pairing families", () => {
  it("maps WH- to over-ear, WF- and LinkBuds to earbuds, anything else to null", () => {
    expect(familyForModel("WH-1000XM4")).toBe("overEar");
    expect(familyForModel("WF-1000XM5")).toBe("earbuds");
    expect(familyForModel("LinkBuds S")).toBe("earbuds");
    expect(familyForModel("Pixel Buds")).toBeNull();
    expect(familyForModel("")).toBeNull();
  });
});

describe("scanned device order", () => {
  it("puts the remembered headphones first, then Sony names, then the rest, keeping Windows' order", () => {
    const listed = [
      { address: "1", name: "MX Master 3", remembered: false },
      { address: "2", name: "WF-1000XM5", remembered: false },
      { address: "3", name: "Keyboard", remembered: false },
      { address: "4", name: "WH-1000XM4", remembered: true },
      { address: "5", name: "LinkBuds S", remembered: false },
    ];
    expect(orderScannedDevices(listed).map((d) => d.address)).toEqual(["4", "2", "5", "1", "3"]);
  });
});

describe("engine store: scan and connect", () => {
  afterEach(() => vi.useRealTimers());

  it("sends scan, lists the engine:devices answer, and keeps the list during a rescan", async () => {
    const { api, send, emitDevices } = scanApi();
    const store = createEngineStore(api);
    const stop = store.getState().connect();
    await store.getState().startScan();
    expect(send).toHaveBeenCalledWith({ type: "scan" });
    expect(store.getState().scan).toEqual({ phase: "scanning", devices: [] });
    await vi.waitFor(() => {
      emitDevices({ devices: [{ address: XM4, name: "WH-1000XM4", remembered: false }] });
      expect(store.getState().scan.phase).toBe("done");
    });
    await store.getState().startScan();
    expect(store.getState().scan).toEqual({
      phase: "scanning",
      devices: [{ address: XM4, name: "WH-1000XM4", remembered: false }],
    });
    stop();
  });

  it("ends a scan that gets no answer as failed", async () => {
    vi.useFakeTimers();
    const { api } = scanApi();
    const store = createEngineStore(api, { scanTimeoutMs: 1000 });
    await store.getState().startScan();
    await vi.advanceTimersByTimeAsync(1000);
    expect(store.getState().scan).toMatchObject({ phase: "failed", message: "The scan got no answer." });
  });

  it("follows connectTo through to connected, or to the engine's failure reason", async () => {
    const { api, send } = scanApi();
    const store = createEngineStore(api);
    await store.getState().connectTo(XM4);
    expect(send).toHaveBeenCalledWith({ type: "connect", address: XM4 });
    store.getState().receiveStatus({ state: "disconnected" });
    store.getState().receiveStatus({ state: "connecting", address: XM4 });
    expect(store.getState().attempt).toEqual({ phase: "connecting", address: XM4 });
    store.getState().receiveStatus({ state: "disconnected", address: XM4, reason: "timeout" });
    expect(store.getState().attempt).toMatchObject({ phase: "failed", reason: "timeout" });

    await store.getState().connectTo(XM4);
    store.getState().receiveStatus({ state: "ready", address: XM4 });
    store.getState().receiveSnapshot(structuredClone(fixture));
    expect(store.getState().attempt).toEqual({ phase: "connected", address: XM4 });
  });

  it("marks the status loaded with the first status", () => {
    const store = createEngineStore(scanApi().api);
    expect(store.getState().statusLoaded).toBe(false);
    store.getState().receiveStatus({ state: "disconnected", remembered: null });
    expect(store.getState().statusLoaded).toBe(true);
  });
});

describe("mock engine: setup flow", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("starts idle with nothing remembered and does not connect by itself", async () => {
    const api = createMockEngineApi(fixture, { stepMs: 100, remembered: false });
    const states: string[] = [];
    api.onStatus((s) => states.push(s.state));
    expect(await api.status()).toEqual({ state: "disconnected", remembered: null, windowsConnected: true });
    await vi.advanceTimersByTimeAsync(2000);
    expect(states).toEqual([]);
  });

  it("answers a scan, connects to the recorded device and remembers it", async () => {
    const api = createMockEngineApi(fixture, { stepMs: 100, scanMs: 50, remembered: false });
    const store = createEngineStore(api);
    const stop = store.getState().connect();
    await store.getState().load();
    await store.getState().startScan();
    await vi.advanceTimersByTimeAsync(50);
    expect(store.getState().scan).toEqual({
      phase: "done",
      devices: [{ address: XM4, name: "WH-1000XM4", remembered: false }],
    });
    await store.getState().connectTo(XM4);
    await vi.advanceTimersByTimeAsync(300);
    expect(selectConnected(store.getState())).toBe(true);
    expect(store.getState().attempt?.phase).toBe("connected");
    expect(store.getState().status.remembered).toMatchObject({ address: XM4, name: "WH-1000XM4", firmware: "2.9.0" });
    stop();
  });

  it("fails a device it has no recording for, and a forced failure, with their reasons", async () => {
    const other = { address: "F8:4E:17:00:00:01", name: "WF-1000XM5" };
    const api = createMockEngineApi(fixture, { stepMs: 100, otherDevices: [other] });
    const store = createEngineStore(api);
    const stop = store.getState().connect();
    await store.getState().connectTo(other.address);
    await vi.advanceTimersByTimeAsync(200);
    expect(store.getState().attempt).toMatchObject({ phase: "failed", reason: "notConnectedToWindows" });
    api.failNextConnect("busy");
    await store.getState().connectTo(XM4);
    await vi.advanceTimersByTimeAsync(200);
    expect(store.getState().attempt).toMatchObject({ phase: "failed", reason: "busy" });
    stop();
  });

  it("forgets the remembered device and connects by itself once auto-connect is on", async () => {
    const api = createMockEngineApi(fixture, { stepMs: 100 });
    const store = createEngineStore(api);
    const stop = store.getState().connect();
    await store.getState().load();
    expect(store.getState().status.remembered?.address).toBe(XM4);
    await store.getState().send({ type: "setAutoConnect", enabled: true });
    await vi.advanceTimersByTimeAsync(400);
    expect(selectConnected(store.getState())).toBe(true);
    await store.getState().send({ type: "forgetDevice", address: XM4 });
    expect(store.getState().status).toEqual({ state: "disconnected", remembered: null, windowsConnected: true });
    stop();
  });
});
