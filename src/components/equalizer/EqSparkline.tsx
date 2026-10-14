import { bandPoints, monotonePath, valueToY, type PlotBox } from "./eqCurve";
import type { ValueRange } from "./equalizerBands";
import "./EqSparkline.css";

export interface EqSparklineProps {
  /** The plotted values (Clear Bass first when present, then the bands). */
  values: readonly number[];
  range: ValueRange;
}

const BOX: PlotBox = { left: 0, top: 0, width: 100, height: 100 };

/**
 * A preset's curve in miniature: the 0 line and the monotone curve, no axes
 * or labels (the large chart carries those). Decorative: the preset card's
 * name is the accessible content.
 */
export function EqSparkline({ values, range }: EqSparklineProps) {
  const zeroY = valueToY(0, range, BOX);
  return (
    <svg className="eq-sparkline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <line className="eq-sparkline__zero" x1={0} x2={100} y1={zeroY} y2={zeroY} vectorEffect="non-scaling-stroke" />
      <path
        className="eq-sparkline__line"
        d={monotonePath(bandPoints(values, range, BOX))}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
