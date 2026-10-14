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

/** The states the rail and the Status card show for remembered headphones: one line each (0.1.10 copy register). */
describe("remembered headphones: the state follows Windows, not the last attempt", () => {
  it("Headphones off or disconnected while Windows does not list them", () => {
    expect(label({ state: "disconnected", windowsConnected: false })).toBe("Headphones off or disconnected");
    // A link lost because they switched off is not a failed connect.
    expect(label({ state: "disconnected", windowsConnected: false, lastError: "link lost" })).toBe("Headphones off or disconnected");
    // A Connect pressed while they are off.
    expect(
      label({ state: "disconnected", address: ADDRESS, reason: "notConnectedToWindows", lastError: "x", windowsConnected: false }),
    ).toBe("Headphones off or disconnected");
    // Auto-connect is waiting for them.
    expect(label({ state: "discovering", windowsConnected: false })).toBe("Headphones off or disconnected");
    // One line: no helper sentence under it.
    expect(connectionCopy(toConnectionView({ state: "disconnected", windowsConnected: false }, retry, xm4))).toEqual({
      title: "Headphones off or disconnected",
    });
  });

  it("Ready to connect while listed but not connected to the app", () => {
    expect(label({ state: "disconnected", windowsConnected: true })).toBe("Ready to connect");
    expect(label({ state: "disconnected", windowsConnected: true, lastError: "link lost" })).toBe("Ready to connect");
    expect(connectionCopy(toConnectionView({ state: "disconnected", windowsConnected: true }, retry, xm4)).description).toBeUndefined();
  });

  it("Connecting… and Reconnecting… during attempts", () => {
    expect(label({ state: "connecting", deviceName: "WH-1000XM4", windowsConnected: true })).toBe("Connecting…");
    expect(label({ state: "initialising", deviceName: "WH-1000XM4", windowsConnected: true })).toBe("Connecting…");
    expect(
      label({
        state: "connecting",
        deviceName: "WH-1000XM4",
        reason: "reconnectingAfterSettingChange",
        windowsConnected: true,
      }),
    ).toBe("Reconnecting…");
  });

  it("Connection failed only after an attempt failed while Windows listed them, with the reason", () => {
    for (const reason of ["busy", "timeout", "refused"] as const) {
      const view = toConnectionView(
        { state: "disconnected", address: ADDRESS, reason, lastError: "x", windowsConnected: true },
        retry,
        xm4,
      );
      expect(connectionStateLabel(view)).toBe("Connection failed");
      expect(view.kind === "error" && view.reason).toBe(reason);
    }
    const busy = toConnectionView(
      { state: "disconnected", address: ADDRESS, reason: "busy", lastError: "x", windowsConnected: true },
      retry,
      xm4,
    );
    expect(connectionCopy(busy)).toEqual({ title: "Connection failed", description: "Another app is using the headphones." });
    // The same failure once Windows no longer lists them is the real state instead.
    expect(label({ state: "disconnected", reason: "timeout", lastError: "x", windowsConnected: false })).toBe(
      "Headphones off or disconnected",
    );
  });

  it("No headphones set up with nothing remembered", () => {
    expect(connectionCopy(toConnectionView({ state: "disconnected" }, retry, null))).toEqual({ title: "No headphones set up" });
    // Only an error message, nothing remembered: a failure (the tray's state_label agrees).
    expect(connectionCopy(toConnectionView({ state: "disconnected", lastError: "x" }, retry, null))).toEqual({
      title: "Connection failed",
    });
    expect(connectionCopy(toConnectionView({ state: "discovering" }, retry, null))).toEqual({ title: "No headphones set up" });
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
