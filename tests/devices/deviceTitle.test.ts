import { describe, expect, it } from "vitest";
import { toConnectionView } from "../../src/hooks/engine/useConnectionView";
import { toRailDeviceProps } from "../../src/hooks/engine/useRailDeviceProps";
import { displayableName, isBluetoothAddress, rememberedTitle, UNNAMED_HEADPHONES } from "../../src/lib/devices/deviceTitle";
import type { RememberedDevice } from "../../src/lib/engine/types";

const ADDRESS = "AA:BB:CC:12:34:56";

/** The maintainer's devices.json from 0.1.3: Windows' name was never stored, the address was. */
const stored013: RememberedDevice = {
  address: ADDRESS,
  name: ADDRESS,
  modelName: "WH-1000XM4",
  firmware: "2.9.0",
  protocol: "V1",
  lastSeen: 1791837004150,
};

describe("rememberedTitle", () => {
  it("prefers the model name over the Bluetooth name", () => {
    expect(rememberedTitle({ modelName: "WH-1000XM4", name: "My XM4" })).toBe("WH-1000XM4");
  });

  it("falls back to Windows' name when the model is unknown", () => {
    expect(rememberedTitle({ modelName: "", name: "WH-1000XM4" })).toBe("WH-1000XM4");
  });

  it("never uses the address, falling back to Sony headphones", () => {
    expect(rememberedTitle(stored013)).toBe("WH-1000XM4");
    expect(rememberedTitle({ modelName: "", name: ADDRESS })).toBe(UNNAMED_HEADPHONES);
    expect(rememberedTitle({ modelName: " ", name: "" })).toBe("Sony headphones");
  });

  it("is undefined when nothing is remembered", () => {
    expect(rememberedTitle(null)).toBeUndefined();
  });

  it("recognises colon and dash addresses only", () => {
    expect(isBluetoothAddress(ADDRESS)).toBe(true);
    expect(isBluetoothAddress("aa-bb-cc-12-34-56")).toBe(true);
    expect(isBluetoothAddress("WH-1000XM4")).toBe(false);
    expect(displayableName(` ${ADDRESS} `)).toBeUndefined();
  });
});

describe("remembered device titles on the connection screens and rail", () => {
  const retry = () => {};

  it("names the idle, searching and error states by model, not address", () => {
    expect(toConnectionView({ state: "disconnected" }, retry, stored013)).toEqual({ kind: "idle", deviceName: "WH-1000XM4" });
    expect(toConnectionView({ state: "discovering" }, retry, stored013)).toEqual({ kind: "searching", deviceName: "WH-1000XM4" });
    const failed = toConnectionView(
      { state: "disconnected", deviceName: ADDRESS, address: ADDRESS, lastError: "x", reason: "busy" },
      retry,
      stored013,
    );
    expect(failed.kind === "error" && failed.deviceName).toBe("WH-1000XM4");
    expect(toConnectionView({ state: "connecting", deviceName: ADDRESS }, retry, stored013)).toEqual({
      kind: "connecting",
      deviceName: "WH-1000XM4",
    });
  });

  it("the rail skips an address in the status for the remembered title", () => {
    const view = { kind: "idle", deviceName: "WH-1000XM4" } as const;
    expect(
      toRailDeviceProps({ connected: false, header: null, view, statusName: ADDRESS, rememberedName: rememberedTitle(stored013) }).name,
    ).toBe("WH-1000XM4");
  });
});
