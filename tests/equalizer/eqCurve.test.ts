import { describe, expect, it } from "vitest";
import {
  areaPath,
  bandPoints,
  curveSeries,
  describeCurve,
  monotonePath,
  valueToY,
  type PlotBox,
} from "../../src/components/equalizer/eqCurve";
import fixture from "../fixtures/eq-presets/WH-1000XM4-2.9.0.json";

const box: PlotBox = { left: 0, top: 0, width: 100, height: 100 };
const range = { min: -10, max: 10 };
const recorded = (id: string) => fixture.presets.find((preset) => preset.id === id)!;

/** The y of every cubic segment, sampled at t = 0, 0.05, ... 1. */
function sampleYs(d: string): number[] {
  const nums = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
  const ys: number[] = [];
  let y0 = nums[1];
  for (let i = 2; i + 6 <= nums.length; i += 6) {
    const [, c1y, , c2y, , y3] = nums.slice(i, i + 6);
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const u = 1 - t;
      ys.push(u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y3);
    }
    y0 = y3;
  }
  return ys;
}

describe("eqCurve", () => {
  it("maps a level to y: +10 at the top, 0 in the middle, -10 at the bottom, clamped", () => {
    expect(valueToY(10, range, box)).toBe(0);
    expect(valueToY(0, range, box)).toBe(50);
    expect(valueToY(-10, range, box)).toBe(100);
    expect(valueToY(14, range, box)).toBe(0);
  });

  it("spreads the recorded Bright bands evenly across the plot", () => {
    expect(bandPoints(recorded("bright").bands, range, box)).toEqual([
      { x: 0, y: 50 },
      { x: 25, y: 25 },
      { x: 50, y: 15 },
      { x: 75, y: 15 },
      { x: 100, y: 5 },
    ]);
  });

  it("draws one cubic per gap through every band and never overshoots (monotone)", () => {
    const d = monotonePath(bandPoints(recorded("bright").bands, range, box));
    expect(d.startsWith("M0,50C")).toBe(true);
    expect(d.match(/C/g)).toHaveLength(4);
    expect(d.endsWith("100,5")).toBe(true);
    const ys = sampleYs(d);
    // Bright spans 0..+9 (y 50..5); a non-monotone spline would bulge past +9 or below 0.
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(5 - 1e-6);
    expect(Math.max(...ys)).toBeLessThanOrEqual(50 + 1e-6);
  });

  it("keeps a flat preset on the 0 line", () => {
    const ys = sampleYs(monotonePath(bandPoints(recorded("off").bands, range, box)));
    expect(new Set(ys.map((y) => Math.round(y * 1000) / 1000))).toEqual(new Set([50]));
  });

  it("closes the area down to the 0 line", () => {
    const points = bandPoints(recorded("bright").bands, range, box);
    expect(areaPath(points, 50)).toMatch(/L100,50L0,50Z$/);
    expect(areaPath([], 50)).toBe("");
  });

  it("puts Clear Bass first, as Sony's app does, so the Bass preset is not drawn flat", () => {
    const bass = recorded("bass");
    const series = curveSeries(bass.bands, fixture.bandLabels, bass.clearBass);
    expect(series.values).toEqual([7, 0, 0, 0, 0, 0]);
    expect(series.labels).toEqual(["Clear Bass", "400", "1k", "2.5k", "6.3k", "16k"]);
    expect(curveSeries([1, 2], ["a", "b"]).labels).toEqual(["a", "b"]);
  });

  it("summarises the curve for the accessible name", () => {
    expect(describeCurve(recorded("bright").bands, ["400 Hz", "1 kHz", "2.5 kHz", "6.3 kHz", "16 kHz"])).toBe(
      "400 Hz 0, 1 kHz +5, 2.5 kHz +7, 6.3 kHz +7, 16 kHz +9",
    );
    expect(describeCurve([0, 0, 0], ["a", "b", "c"])).toBe("Flat: every band at 0");
  });
});
