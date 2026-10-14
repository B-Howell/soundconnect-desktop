import { useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotionConfig } from "framer-motion";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useHideOutside } from "../../hooks/useHideOutside";
import { durations, easeOut, spring } from "../../styles/motion";
import "./Sheet.css";

export interface SheetProps {
  open: boolean;
  /** Called on Escape, a backdrop click, or a sheet action that dismisses it. */
  onClose: () => void;
  /** Heading of the sheet; it also names the dialog. */
  title: string;
  /** Optional line under the title (a confirmation's explanation). */
  message?: string;
  /** Element to focus on open; defaults to the chosen option, else the first control. */
  initialFocus?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

const sheetHidden = { y: "100%" };
const sheetShown = { y: 0 };
const fadeHidden = { opacity: 0 };
const fadeShown = { opacity: 1 };

/**
 * iOS bottom sheet: a modal dialog that slides up over a dimmed backdrop,
 * rendered into `document.body` below the title bar (the window stays
 * movable and closable). Escape and a backdrop click close it; Tab stays
 * inside it; focus returns to the opener on close (`useFocusTrap`); the rest
 * of the page is hidden from assistive technology meanwhile (`useHideOutside`). The
 * slide uses the app spring; under reduced motion it appears without travel
 * (`useReducedMotionConfig` reads the app's `MotionConfig`).
 */
export function Sheet({ open, onClose, title, message, initialFocus, children }: SheetProps) {
  const titleId = useId();
  const messageId = useId();
  const layer = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trapKeys = useFocusTrap(panel, open, { initialFocus });
  useHideOutside(layer, open);
  const reduced = useReducedMotionConfig() ?? false;
  const slide = reduced ? { duration: 0 } : spring;
  const fade = { duration: reduced ? 0 : durations.base / 1000, ease: easeOut };

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="sheet-layer" key="sheet" ref={layer}>
          <motion.div
            className="sheet-layer__backdrop"
            data-testid="sheet-backdrop"
            initial={fadeHidden}
            animate={fadeShown}
            exit={fadeHidden}
            transition={fade}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={message ? messageId : undefined}
            tabIndex={-1}
            initial={sheetHidden}
            animate={sheetShown}
            exit={sheetHidden}
            transition={slide}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                onClose();
                return;
              }
              trapKeys(event);
            }}
          >
            <div className="sheet__handle" aria-hidden="true" />
            <div className="sheet__header">
              <h2 className="sheet__title" id={titleId}>
                {title}
              </h2>
              {message ? (
                <p className="sheet__message" id={messageId}>
                  {message}
                </p>
              ) : null}
            </div>
            <div className="sheet__body">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
