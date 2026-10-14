import "./AmbientLevelMeter.css";

export interface AmbientLevelMeterProps {
  /** The slider stop shown (0 = noise cancelling) and how many stops there are. */
  index: number;
  count: number;
}

/**
 * The Ambient Sound Control slider in miniature, decorative: a track filled
 * up to the current stop, noise cancelling at the left, ambient level 20 at
 * the right. The card's text carries the value.
 */
export function AmbientLevelMeter({ index, count }: AmbientLevelMeterProps) {
  const fraction = count > 1 ? Math.min(Math.max(index / (count - 1), 0), 1) : 0;
  return (
    <span className="ambient-level-meter">
      <span className="ambient-level-meter__fill" style={{ width: `${fraction * 100}%` }} />
      <span className="ambient-level-meter__thumb" style={{ left: `${fraction * 100}%` }} />
    </span>
  );
}
