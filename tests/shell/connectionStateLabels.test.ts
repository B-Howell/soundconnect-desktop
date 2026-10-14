import { describe, expect, it } from "vitest";
import { connectionCopy, connectionStateLabel } from "../../src/components/shell/connectionCopy";
import { toConnectionView } from "../../src/hooks/engine/useConnectionView";
import { toRailDeviceProps } from "../../src/hooks/engine/useRailDeviceProps";
import type { EngineStatus, RememberedDevice } from "../../src/lib/engine/types";

const ADDRESS = "AA:BB:CC:12:34:56";
const xm4: RememberedDevice = {
  address: ADDRESS,
  name: "WH-1000XM4",
  modelName: "WH-1000XM4",
  firmware: "2.9.0",
  protocol: "V1",
  lastSeen: 1,
};
const retry = () => {};
const label = (status: EngineStatus) => connectionStateLabel(toConnectionView(status, retry, xm4));

/** The five states the rail and the Status card show for remembered headphones (0.1.9). */
describe("remembered headphones: the state follows Windows, not the last attempt", () => {
  it("Off or out of range while Windows does not list them", () => {
    expect(label({ state: "disconnected", windowsConnected: false })).toBe("Off or out of range");
    // A link lost because they switched off is not a failed connect.
    expect(label({ state: "disconnected", windowsConnected: false, lastError: "link lost" })).toBe("Off or out of range");
    // A Connect pressed while they are off.
    expect(
      label({ state: "disconnected", address: ADDRESS, reason: "notConnectedToWindows", lastError: "x", windowsConnected: false }),
    ).toBe("Off or out of range");
    // Auto-connect is waiting for them.
    expect(label({ state: "discovering", windowsConnected: false })).toBe("Off or out of range");
    expect(connectionCopy(toConnectionView({ state: "disconnected", windowsConnected: false }, retry, xm4)).title).toBe(
      "WH-1000XM4 is off or out of range",
    );
  });

  it("Connected to Windows while listed but not connected to the app", () => {
    expect(label({ state: "disconnected", windowsConnected: true })).toBe("Connected to Windows");
    expect(label({ state: "disconnected", windowsConnected: true, lastError: "link lost" })).toBe("Connected to Windows");
    expect(connectionCopy(toConnectionView({ state: "disconnected", windowsConnected: true }, retry, xm4)).description).toBe(
      "Select Connect to control them from SoundConnect.",
    );
  });

  it("Connecting… and Reconnecting to … during attempts", () => {
    expect(label({ state: "connecting", deviceName: "WH-1000XM4", windowsConnected: true })).toBe("Connecting…");
    expect(label({ state: "initialising", deviceName: "WH-1000XM4", windowsConnected: true })).toBe("Connecting…");
    expect(
      label({
        state: "connecting",
        deviceName: "WH-1000XM4",
        reason: "reconnectingAfterSettingChange",
        windowsConnected: true,
      }),
    ).toBe("Reconnecting to WH-1000XM4");
  });

  it("Couldn't connect only after an attempt failed while Windows listed them, with the reason", () => {
    for (const reason of ["busy", "timeout", "refused"] as const) {
      const view = toConnectionView(
        { state: "disconnected", address: ADDRESS, reason, lastError: "x", windowsConnected: true },
        retry,
        xm4,
      );
      expect(connectionStateLabel(view)).toBe("Couldn't connect");
      expect(view.kind === "error" && view.reason).toBe(reason);
    }
    // The same failure once Windows no longer lists them is the real state instead.
    expect(label({ state: "disconnected", reason: "timeout", lastError: "x", windowsConnected: false })).toBe(
      "Off or out of range",
    );
  });

  it("Connected when Ready", () => {
    const props = toRailDeviceProps({
      connected: true,
      header: { name: "WH-1000XM4" } as never,
      view: { kind: "idle", deviceName: "WH-1000XM4" },
    });
    expect(props.state).toBe("Connected");
  });
});
