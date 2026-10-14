import type { ReactNode } from "react";
import { AnimatePresence, motion, useIsPresent, type Variants } from "framer-motion";
import { durations, easeOut, pageSlide, spring } from "../../styles/motion";
import "./PageTransition.css";

const variants: Variants = {
  enter: { opacity: 0, y: pageSlide },
  shown: { opacity: 1, y: 0 },
  leave: { opacity: 0, y: -pageSlide },
};

// Position rides the app spring; opacity is a short tween so the cross-fade
// never overshoots. Under reduced motion the MotionConfig in App.tsx
// (`reducedMotion="user"`) drops the slide and keeps only the fade.
const transition = {
  y: spring,
  opacity: { duration: durations.fast / 1000, ease: easeOut },
} as const;

/** The leaving page stays visible while it fades but is inert and hidden from assistive tech. */
function PageLayer({ children }: { children: ReactNode }) {
  const isPresent = useIsPresent();
  return (
    <div className="page-transition__layer" inert={!isPresent} aria-hidden={isPresent ? undefined : true}>
      {children}
    </div>
  );
}

export interface PageTransitionProps {
  /** Identity of the page; a new key cross-fades the old page out and the new one in. */
  pageKey: string;
  children: ReactNode;
}

/**
 * Cross-fade plus an 8 px slide between pages. Both pages are absolutely
 * stacked during the swap, so neither pushes the other's layout.
 */
export function PageTransition({ pageKey, children }: PageTransitionProps) {
  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={pageKey}
        className="page-transition"
        variants={variants}
        initial="enter"
        animate="shown"
        exit="leave"
        transition={transition}
      >
        <PageLayer>{children}</PageLayer>
      </motion.div>
    </AnimatePresence>
  );
}
