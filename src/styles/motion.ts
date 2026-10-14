import type { Transition } from "framer-motion";

/**
 * The one spring the renderer uses for layout and sheet motion. Tuned to feel
 * like iOS: quick to arrive, a hint of overshoot, settled well under 400 ms.
 */
export const spring: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 38,
  mass: 0.9,
};

/** Durations in ms, mirrored from tokens.css for JavaScript-driven motion. */
export const durations = {
  fast: 160,
  base: 240,
  slow: 400,
} as const;

/** The CSS `--ease-out` curve, for JavaScript-driven tweens. */
export const easeOut = [0.2, 0.8, 0.2, 1] as const;

/** Vertical travel of a page cross-fade, in px. */
export const pageSlide = 8;
