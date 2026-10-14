import { useEffect, useId, useRef, type ReactNode } from "react";
import { Card } from "../primitives/Card";
import { ProgressDots } from "./ProgressDots";
import "./SetupCard.css";

export interface SetupCardProps {
  /** Zero-based step, for the progress dots. */
  index: number;
  count: number;
  /** Picture above the title (app icon, product image). */
  visual?: ReactNode;
  title: string;
  /** One or two sentences under the title. */
  lead?: ReactNode;
  /** The step's own content (instructions, the device list). */
  children?: ReactNode;
  /** The large primary button (a `SheetButton`). */
  primary: ReactNode;
  /** Quiet text actions under it (Back, Cancel). */
  secondary?: ReactNode;
}

/**
 * One setup step: a centred card at most `--setup-card-width` wide with the
 * progress dots, an optional picture, the step's heading and lead, its
 * content, then a full-width primary button and text actions. Each step
 * mounts its own card, and its heading takes focus on mount, so a screen
 * reader hears the new step and keyboard focus is not left on a removed
 * button.
 */
export function SetupCard({ index, count, visual, title, lead, children, primary, secondary }: SetupCardProps) {
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section className="setup-card" aria-labelledby={titleId}>
      <Card>
        <div className="setup-card__body">
          <ProgressDots index={index} count={count} />
          {visual ? <div className="setup-card__visual">{visual}</div> : null}
          <div className="setup-card__heading">
            <h1 className="setup-card__title" id={titleId} ref={titleRef} tabIndex={-1}>
              {title}
            </h1>
            {lead ? <p className="setup-card__lead">{lead}</p> : null}
          </div>
          {children ? <div className="setup-card__content">{children}</div> : null}
          <div className="setup-card__actions">
            {primary}
            {secondary ? <div className="setup-card__secondary">{secondary}</div> : null}
          </div>
        </div>
      </Card>
    </section>
  );
}
