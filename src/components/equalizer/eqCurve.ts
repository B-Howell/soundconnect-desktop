/**
 * Pure geometry for the equalizer curve chart and the preset sparklines:
 * band values to plot points, a monotone cubic path through them (it never
 * overshoots between two bands, so the drawn curve never claims a boost the
 * device does not apply), the area under it down to the 0 dB line, and a
 * spoken summary for the chart's `aria-label`.
 */
import { formatSignedStep, type ValueRange } from "./equalizerBands";

export interface Point {
  x: number;
  y: number;
}

/** The plot rectangle inside the SVG viewBox. */
export interface PlotBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The y of a dB value: `range.max` at the top edge, `range.min` at the bottom, clamped. */
export function valueToY(value: number, range: ValueRange, box: PlotBox): number {
  const span = range.max - range.min || 1;
  const clamped = Math.min(range.max, Math.max(range.min, value));
  return box.top + ((range.max - clamped) / span) * box.height;
}

/** Bands spread evenly from the left to the right edge (one band sits in the middle). */
export function bandPoints(bands: readonly number[], range: ValueRange, box: PlotBox): Point[] {
  const step = bands.length > 1 ? box.width / (bands.length - 1) : 0;
  return bands.map((value, index) => ({
    x: bands.length > 1 ? box.left + index * step : box.left + box.width / 2,
    y: valueToY(value, range, box),
  }));
}

const r = (n: number) => Math.round(n * 100) / 100;

/**
 * Fritsch-Carlson monotone cubic tangents (the same curve as d3's
 * `curveMonotoneX`): flat at local extrema, never overshooting a band.
 */
function tangents(points: readonly Point[]): number[] {
  const n = points.length;
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    slopes.push(dx === 0 ? 0 : (points[i + 1].y - points[i].y) / dx);
  }
  const m: number[] = new Array(n).fill(0);
  m[0] = slopes[0] ?? 0;
  m[n - 1] = slopes[n - 2] ?? 0;
  for (let i = 1; i < n - 1; i++) {
    const a = slopes[i - 1];
    const b = slopes[i];
    m[i] = a * b <= 0 ? 0 : (a + b) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    const s = slopes[i];
    if (s === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const alpha = m[i] / s;
    const beta = m[i + 1] / s;
    const h = alpha * alpha + beta * beta;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * alpha * s;
      m[i + 1] = t * beta * s;
    }
  }
  return m;
}

/** The SVG `d` of a smooth monotone curve through the points ("" for none). */
export function monotonePath(points: readonly Point[]): string {
  if (points.length === 0) return "";
  const [first] = points;
  if (points.length === 1) return `M${r(first.x)},${r(first.y)}`;
  const m = tangents(points);
  let d = `M${r(first.x)},${r(first.y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i];
    const q = points[i + 1];
    const third = (q.x - p.x) / 3;
    d += `C${r(p.x + third)},${r(p.y + m[i] * third)},${r(q.x - third)},${r(q.y - m[i + 1] * third)},${r(q.x)},${r(q.y)}`;
  }
  return d;
}

/** The curve closed down to `baselineY` (the 0 dB line), for the area wash. */
export function areaPath(points: readonly Point[], baselineY: number): string {
  if (points.length < 2) return "";
  const last = points[points.length - 1];
  return `${monotonePath(points)}L${r(last.x)},${r(baselineY)}L${r(points[0].x)},${r(baselineY)}Z`;
}

/** "400 Hz 0, 1 kHz +5, ..." in signed steps, for the chart's accessible name. */
export function describeCurve(bands: readonly number[], labels: readonly string[]): string {
  if (bands.length === 0) return "No equalizer bands";
  if (bands.every((value) => value === 0)) return "Flat: every band at 0";
  return bands.map((value, index) => `${labels[index] ?? `Band ${index + 1}`} ${formatSignedStep(value)}`).join(", ");
}

/** What a curve plots: values with one label each. */
export interface CurveSeries {
  values: number[];
  labels: string[];
}

export const CLEAR_BASS_LABEL = "Clear Bass";

/**
 * The plotted series: Clear Bass (when the device has it) as the leftmost,
 * lowest point, then the bands, as Sony's app draws its equalizer. Without
 * it the XM4's Bass preset (flat bands, Clear Bass +7) would draw flat.
 */
export function curveSeries(bands: readonly number[], labels: readonly string[], clearBass?: number): CurveSeries {
  const bandLabels = bands.map((_, index) => labels[index] ?? `Band ${index + 1}`);
  return clearBass === undefined
    ? { values: [...bands], labels: bandLabels }
    : { values: [clearBass, ...bands], labels: [CLEAR_BASS_LABEL, ...bandLabels] };
}
