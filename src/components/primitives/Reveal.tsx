import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotionConfig } from "framer-motion";
import { durations, easeOut } from "../../styles/motion";
import "./Reveal.css";

export interface RevealProps {
  /** Mounts the content (growing from zero height) when true; unmounts it (collapsing) when false. */
  show: boolean;
  children: ReactNode;
}

const hidden = { height: 0, opacity: 0 };
const shown = { height: "auto", opacity: 1 };

/**
 * Shows or hides a block by animating its height and opacity, so content
 * below slides rather than jumps. A tween, not the app spring: a bouncing
 * height would overshoot into the next card. `MotionConfig reducedMotion`
 * only removes transform and layout animation, so reduced motion is honoured
 * here explicitly with a zero duration; `useReducedMotionConfig` reads the
 * app's `MotionConfig` setting ("user": the OS preference) and copes with a
 * missing `matchMedia`. Initial mount does not animate.
 * Put padding on the children, not on this box, so it collapses fully.
 */
export function Reveal({ show, children }: RevealProps) {
  const reduced = useReducedMotionConfig() ?? false;
  const transition = { duration: reduced ? 0 : durations.base / 1000, ease: easeOut };
  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div
          key="reveal"
          className="reveal"
          initial={hidden}
          animate={shown}
          exit={hidden}
          transition={transition}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
