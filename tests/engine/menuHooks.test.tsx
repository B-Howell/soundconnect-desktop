/** The Task 23 menus' snapshot -> props hooks against the recorded WH-1000XM4 payload. */
import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAutoPauseProps } from "../../src/hooks/engine/useAutoPauseProps";
import { useConnectionModeProps } from "../../src/hooks/engine/useConnectionModeProps";
import { useMultipointProps } from "../../src/hooks/engine/useMultipointProps";
import { pairedDeviceActions } from "../../src/components/devices/pairedDevices";
import { thisPcAddress, toPairedDeviceViews, usePairedDevicesProps } from "../../src/hooks/engine/usePairedDevicesProps";
import { usePairingProps } from "../../src/hooks/engine/usePairingProps";
import { useRailDeviceProps } from "../../src/hooks/engine/useRailDeviceProps";
import { useSpeakToChatProps } from "../../src/hooks/engine/useSpeakToChatProps";
import type { SnapshotPayload } from "../../src/lib/engine/types";
import { createEngineStore } from "../../src/state/engineStore";
import { connectedStore, renderHookWithStore, spyApi, xm4 } from "./engineTestKit";

const sentBy = (api: ReturnType<typeof spyApi>) => () => api.send.mock.calls.map((c) => c[0]);

/** The recording with one feature reported unavailable. */
function without(feature: string): SnapshotPayload {
  const payload = xm4();
  payload.snapshot.features = { ...payload.snapshot.features, [feature]: "unavailable" };
  return payload;
}

describe("useSpeakToChatProps", () => {
  it("reads speakToChat {enabled: false, sensitivity: auto, timeout: short} and writes all three fields", async () => {
    const api = spyApi();
    const { result } = renderHookWithStore(useSpeakToChatProps, connectedStore(api));
    expect(result.current).toMatchObject({ enabled: false, sensitivity: "auto", timeout: "short" });
    act(() => result.current?.onSensitivityChange("high"));
    expect(result.current?.sensitivity).toBe("high");
    await expect.poll(sentBy(api)).toEqual([
      { type: "setSpeakToChat", enabled: false, sensitivity: "high", timeout: "short" },
    ]);
  });

  it("is null without SPEAK_TO_CHAT", () => {
    const { result } = renderHookWithStore(useSpeakToChatProps, connectedStore(spyApi(), without("SPEAK_TO_CHAT")));
    expect(result.current).toBeNull();
  });
});

describe("useConnectionModeProps", () => {
  it("reads audioPriority stability and sends setConnectionMode", async () => {
    const api = spyApi();
    const { result } = renderHookWithStore(useConnectionModeProps, connectedStore(api));
    expect(result.current?.value).toBe("stability");
    act(() => result.current?.onChange("quality"));
    await expect.poll(sentBy(api)).toEqual([{ type: "setConnectionMode", audioPriority: "quality" }]);
  });
});

describe("usePairedDevicesProps", () => {
  it("maps the three paired devices, marks the one connected device as this PC, no actions on V1", () => {
    const { result } = renderHookWithStore(usePairedDevicesProps, connectedStore());
    expect(result.current?.actionsSupported).toBe(false);
    expect(result.current?.devices).toEqual([
      { id: "00:11:22:33:44:51", name: "Desktop-1", connected: true, playback: true, thisPc: true, maybeThisPc: false, pending: undefined },
      { id: "00:11:22:33:44:52", name: "Laptop-1", connected: false, playback: false, thisPc: false, maybeThisPc: false, pending: undefined },
      { id: "00:11:22:33:44:53", name: "Phone-1", connected: false, playback: false, thisPc: false, maybeThisPc: false, pending: undefined },
    ]);
  });

  it("cannot tell this PC when two devices are connected", () => {
    const devices = xm4().snapshot.pairedDevices ?? [];
    expect(thisPcAddress(devices)).toBe("00:11:22:33:44:51");
    expect(thisPcAddress(devices.map((d) => ({ ...d, connected: true })))).toBeNull();
    // Either connected device may be this PC, so neither offers disconnect or forget.
    const both = toPairedDeviceViews(devices.map((d, i) => ({ ...d, connected: i < 2 })));
    expect(both.map((d) => [d.thisPc, d.maybeThisPc])).toEqual([
      [false, true],
      [false, true],
      [false, false],
    ]);
    expect(pairedDeviceActions(both[1])).toEqual(["selectPlayback"]);
    expect(pairedDeviceActions(both[2])).toEqual(["connect", "unpair"]);
  });

  it("sends setPairedDevice with the MAC address and shows it pending", async () => {
    const api = spyApi();
    const { result } = renderHookWithStore(usePairedDevicesProps, connectedStore(api));
    act(() => result.current?.onAction("00:11:22:33:44:53", "connect"));
    expect(result.current?.devices[2].pending).toBe("connect");
    // Not predicted: the row still reports the device as not connected.
    expect(result.current?.devices[2].connected).toBe(false);
    await expect.poll(sentBy(api)).toEqual([
      { type: "setPairedDevice", command: "connect", deviceId: "00:11:22:33:44:53" },
    ]);
  });
});

describe("usePairingProps, useAutoPauseProps, useMultipointProps", () => {
  it("read pairing off, auto pause on and multipoint on from the recording and send their commands", async () => {
    const api = spyApi();
    const store = connectedStore(api);
    const pairing = renderHookWithStore(usePairingProps, store).result;
    const autoPause = renderHookWithStore(useAutoPauseProps, store).result;
    const multipoint = renderHookWithStore(useMultipointProps, store).result;
    expect(pairing.current).toMatchObject({ pairing: false, deviceName: "WH-1000XM4" });
    expect(autoPause.current?.enabled).toBe(true);
    expect(multipoint.current).toMatchObject({
      enabled: true,
      writable: true,
      summary: "Use a PC and a phone without switching. LDAC is unavailable while both are connected.",
    });
    act(() => pairing.current?.onPairingChange(true));
    act(() => autoPause.current?.onChange(false));
    act(() => multipoint.current?.onChange(false));
    expect(pairing.current?.pairing).toBe(true);
    expect(multipoint.current?.enabled).toBe(false);
    await expect.poll(sentBy(api)).toEqual([
      { type: "setPairing", enabled: true },
      { type: "setAutoPause", enabled: false },
      { type: "setMultipoint", enabled: false },
    ]);
  });
});

describe("useRailDeviceProps", () => {
  it("shows the connected device with its battery and codec, and the state while not connected", () => {
    expect(renderHookWithStore(useRailDeviceProps, connectedStore()).result.current).toEqual({
      name: "WH-1000XM4",
      state: "Connected",
      connected: true,
      percent: 90,
      charging: false,
      codec: "AAC",
    });
    const store = createEngineStore(spyApi());
    const { result } = renderHookWithStore(useRailDeviceProps, store);
    expect(result.current).toEqual({ name: "Headphones", state: "Not connected", connected: false });
    act(() => store.getState().receiveStatus({ state: "connecting", deviceName: "WH-1000XM4" }));
    expect(result.current).toEqual({ name: "WH-1000XM4", state: "Connecting…", connected: false });
  });
});
