import type { ReactNode } from "react";
import { Icon, type IconName } from "../icons/Icon";
import "./ActivityPulse.css";

interface ActivityPulseBase {
  /** Accent while working, warning for a problem. */
  tone?: "accent" | "warning";
  /** Breathing rings around the visual; hidden under reduced motion. */
  animated?: boolean;
}

export type ActivityPulseProps = ActivityPulseBase &
  (
    | { /** A glyph on a tinted disc. */ icon: IconName; image?: never }
    | { /** A picture (a `DeviceImage`) shown as is, without the disc. */ image: ReactNode; icon?: never }
  );

/**
 * A state visual: a tinted disc holding a glyph, or a product picture, with
 * optionally two soft rings breathing out from behind it.
 */
export function ActivityPulse({ icon, image, tone = "accent", animated = false }: ActivityPulseProps) {
  return (
    <div className="activity-pulse" data-tone={tone} data-kind={icon ? "icon" : "image"} aria-hidden={icon ? true : undefined}>
      {animated ? (
        <>
          <span className="activity-pulse__ring" />
          <span className="activity-pulse__ring activity-pulse__ring--late" />
        </>
      ) : null}
      {icon ? (
        <span className="activity-pulse__disc">
          <Icon name={icon} className="activity-pulse__glyph" />
        </span>
      ) : (
        <span className="activity-pulse__image">{image}</span>
      )}
    </div>
  );
}
