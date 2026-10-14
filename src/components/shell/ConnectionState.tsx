import type { ReactNode, Ref } from "react";
import { Card } from "../primitives/Card";
import "./ConnectionState.css";

export interface ConnectionStateProps {
  /** Usually an `ActivityPulse`. */
  visual: ReactNode;
  title: string;
  description?: ReactNode;
  /**
   * The title heading, which is programmatically focusable (`tabIndex={-1}`)
   * so focus can land on it after an action removes the focused control.
   */
  titleRef?: Ref<HTMLHeadingElement>;
  /** Actions and details under the text. */
  children?: ReactNode;
}

/**
 * The shared layout of every not-connected screen: one card, centred in the
 * page's visible height (the page keeps the tab bar's height clear), holding a
 * visual, a title, a sentence and optional actions. It has no live region of
 * its own: `ConnectionStatus` announces through a persistent
 * `ConnectionAnnouncer`, because a card swapped in already filled is often not
 * announced.
 */
export function ConnectionState({ visual, title, description, titleRef, children }: ConnectionStateProps) {
  return (
    <div className="connection-state">
      <Card inset>
        <div className="connection-state__body">
          {visual}
          <div className="connection-state__message">
            <h2 className="connection-state__title" ref={titleRef} tabIndex={-1}>
              {title}
            </h2>
            {description ? <p className="connection-state__description">{description}</p> : null}
          </div>
          {children ? <div className="connection-state__actions">{children}</div> : null}
        </div>
      </Card>
    </div>
  );
}
