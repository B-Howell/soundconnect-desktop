import { describe, expect, it } from "vitest";
import { eqPresetTableFor, parseEqPresetTable, presetCurve } from "../../src/lib/devices/eqPresets";
import fixture from "../fixtures/eq-presets/WH-1000XM4-2.9.0.json";

describe("eqPresets", () => {
  it("bundles the recorded XM4 2.9.0 table and finds it by model", () => {
    const table = eqPresetTableFor("WH-1000XM4", "2.9.0");
    expect(table?.presets.map((preset) => preset.id)).toEqual(fixture.presets.map((preset) => preset.id));
    expect(eqPresetTableFor("WH-1000XM4", "9.9.9")?.firmware).toBe("2.9.0");
    expect(eqPresetTableFor("WH-1000XM5", "1.0.0")).toBeNull();
    expect(eqPresetTableFor(null)).toBeNull();
  });

  it("gives recorded curves, a custom marker for editable presets, and nothing unrecorded", () => {
    const table = eqPresetTableFor("WH-1000XM4", "2.9.0");
    expect(presetCurve(table, "treble", true)).toEqual([0, 0, 0, 2, 6, 10]);
    expect(presetCurve(table, "treble", false)).toEqual([0, 0, 2, 6, 10]);
    expect(presetCurve(table, "user1", true)).toBeNull();
    expect(presetCurve(table, "rock", true)).toBeUndefined();
    expect(presetCurve(null, "bright", true)).toBeUndefined();
  });

  it("rejects a malformed fixture instead of drawing guesses", () => {
    expect(parseEqPresetTable(fixture)).not.toBeNull();
    expect(
      parseEqPresetTable({ ...fixture, presets: [{ id: "x", name: "X", bands: [1, 2], clearBass: 0 }] }),
    ).toBeNull();
    expect(parseEqPresetTable(null)).toBeNull();
  });
});
