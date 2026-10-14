import { useState } from "react";
import { areaPath, bandPoints, describeCurve, monotonePath, valueToY, type PlotBox } from "./eqCurve";
import { formatSignedStep, type ValueRange } from "./equalizerBands";
import "./EqCurveChart.css";

export interface EqCurveChartProps {
  bands: readonly number[];
  /** One label per band, shown under the plot ("400 Hz" ...). */
  labels: readonly string[];
  range: ValueRange;
}

/**
 * The plot is a 100 x 100 SVG stretched to its box (`preserveAspectRatio="none"`)
 * with non-scaling strokes, so the line stays 2 px at any width; the dots, tick
 * labels and tooltip are HTML placed by percentage, so they never distort.
 */
const BOX: PlotBox = { left: 0, top: 0, width: 100, height: 100 };

function ticks(range: ValueRange): number[] {
  const mid = (range.min + range.max) / 2;
  return [range.max, (range.max + mid) / 2, mid, (range.min + mid) / 2, range.min];
}

/**
 * The equalizer curve: the current bands as a smooth monotone line with a
 * light area wash down to the 0 line, over the labelled band frequencies and
 * a fixed -10..+10 axis. Hover shows a band's value. The chart is a picture
 * (`role="img"` with the curve spelled out in its name); the sliders remain
 * the control.
 */
export function EqCurveChart({ bands, labels, range }: EqCurveChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const points = bandPoints(bands, range, BOX);
  const zeroY = valueToY(0, range, BOX);
  const summary = `Equalizer curve: ${describeCurve(bands, labels)}`;
  return (
    <div className="eq-chart" role="img" aria-label={summary} onPointerLeave={() => setActive(null)}>
      <div className="eq-chart__y" aria-hidden="true">
        {ticks(range).map((tick) => (
          <span key={tick} className="eq-chart__tick" style={{ top: `${valueToY(tick, range, BOX)}%` }}>
            {formatSignedStep(tick)}
          </span>
        ))}
      </div>
      <div className="eq-chart__plot" aria-hidden="true">
        <svg className="eq-chart__svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          {ticks(range).map((tick) => {
            const y = valueToY(tick, range, BOX);
            return (
              <line
                key={tick}
                className={tick === 0 ? "eq-chart__zero" : "eq-chart__grid"}
                x1={-6}
                x2={106}
                y1={y}
                y2={y}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
          <path className="eq-chart__area" d={areaPath(points, zeroY)} />
          <path className="eq-chart__line" d={monotonePath(points)} vectorEffect="non-scaling-stroke" />
        </svg>
        {points.map((point, index) => (
          <span
            key={index}
            className={index === active ? "eq-chart__dot eq-chart__dot--active" : "eq-chart__dot"}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          />
        ))}
        {points.map((point, index) => (
          <span
            key={`hit-${index}`}
            className="eq-chart__hit"
            style={{ left: `${point.x}%`, width: `${100 / Math.max(1, points.length - 1)}%` }}
            onPointerEnter={() => setActive(index)}
          />
        ))}
        {active !== null && points[active] ? (
          <span
            className="eq-chart__tooltip"
            style={{ left: `${points[active].x}%`, top: `${points[active].y}%` }}
          >
            <span className="eq-chart__tooltip-label">{labels[active]}</span>
            <span className="eq-chart__tooltip-value">{formatSignedStep(bands[active])}</span>
          </span>
        ) : null}
      </div>
      <div className="eq-chart__x" aria-hidden="true">
        {points.map((point, index) => (
          <span key={index} className="eq-chart__band" style={{ left: `${point.x}%` }}>
            {labels[index]}
          </span>
        ))}
      </div>
    </div>
  );
}
