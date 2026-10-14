import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

/**
 * Pure index math for a roving tabindex over a horizontal set: arrows step,
 * Home / End jump, anything else is `null` (not handled). Steps clamp at the
 * ends rather than wrapping, matching a carousel that has a visible start
 * and end. An empty set handles nothing.
 */
export function nextRovingIndex(current: number, key: string, count: number): number | null {
  if (count <= 0) return null;
  const last = count - 1;
  const from = Math.min(Math.max(current, 0), last);
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return Math.min(from + 1, last);
    case "ArrowLeft":
    case "ArrowUp":
      return Math.max(from - 1, 0);
    case "Home":
      return 0;
    case "End":
      return last;
    default:
      return null;
  }
}

/** Keeps a remembered index valid when the set shrinks or is empty. */
export const clampRovingIndex = (index: number, count: number): number =>
  Math.min(Math.max(index, 0), Math.max(count - 1, 0));

export interface RovingTabIndex {
  /** `0` for the one item in the tab order, `-1` for the rest. */
  tabIndexFor: (index: number) => 0 | -1;
  /** Attach to each item so the hook can move focus. */
  refFor: (index: number) => (element: HTMLElement | null) => void;
  /** Spread on the container (keydown bubbles from the items). */
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  /** Call when an item is focused by a click so the tab stop follows the pointer. */
  onItemFocus: (index: number) => void;
}

/**
 * One tab stop for a set of `count` items; arrows move focus between them.
 * `initialIndex` (the selected item) is where Tab lands first; it is applied
 * once, so a later change of the active item does not steal the roving
 * position from the keyboard user.
 */
export function useRovingTabIndex(count: number, initialIndex = 0): RovingTabIndex {
  const [focused, setFocused] = useState(() => clampRovingIndex(initialIndex, count));
  const items = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    setFocused((current) => clampRovingIndex(current, count));
  }, [count]);

  const refFor = useCallback(
    (index: number) => (element: HTMLElement | null) => {
      items.current[index] = element;
    },
    [],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const next = nextRovingIndex(focused, event.key, count);
      if (next === null) return;
      event.preventDefault();
      setFocused(next);
      const element = items.current[next];
      element?.focus({ preventScroll: true });
      element?.scrollIntoView?.({ inline: "nearest", block: "nearest", behavior: "smooth" });
    },
    [count, focused],
  );

  const onItemFocus = useCallback((index: number) => setFocused(index), []);
  const tabIndexFor = useCallback((index: number): 0 | -1 => (index === focused ? 0 : -1), [focused]);

  return { tabIndexFor, refFor, onKeyDown, onItemFocus };
}
