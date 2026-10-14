import { useCallback, useEffect, useRef, type KeyboardEvent } from "react";
import { nextRovingIndex } from "./useRovingTabIndex";

export interface SegmentedSelection {
  /** Attach to each item so the hook can move focus to the new selection. */
  refFor: (index: number) => (element: HTMLElement | null) => void;
  /** Spread on the group (keydown bubbles from the items). */
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  /** Call from an item's click. */
  select: (index: number) => void;
}

/**
 * Selection for any single-select roving group (radio groups such as the
 * segmented control, and tab lists with automatic activation such as the tab
 * bar) whose value may be confirmed asynchronously (a device echo).
 * Left / Right and Up / Down step, Home / End jump: each selects the
 * neighbour of the focused item and moves focus to it (selection follows
 * focus, as the WAI-ARIA radio-group and automatic-activation tabs patterns
 * specify); clicks select directly.
 *
 * While a request is pending, every choice is sent, even one equal to
 * `selectedIndex` (which may still show the previous value): clicking B then
 * A before the echo for B arrives sends both, and clicking B again after a
 * lost echo retries it. With nothing pending, choosing the confirmed value
 * sends nothing. The request is forgotten whenever `selectedIndex` changes. Index maths is the shared
 * `nextRovingIndex`; unlike `useRovingTabIndex` there is no separate focus
 * state, because the tab stop is always the selected item.
 */
export function useSegmentedSelection(
  count: number,
  selectedIndex: number,
  onSelect: (index: number) => void,
): SegmentedSelection {
  const items = useRef<(HTMLElement | null)[]>([]);
  const requested = useRef<number | null>(null);

  useEffect(() => {
    requested.current = null;
  }, [selectedIndex]);

  const refFor = useCallback(
    (index: number) => (element: HTMLElement | null) => {
      items.current[index] = element;
    },
    [],
  );

  const select = useCallback(
    (index: number) => {
      // Dedupe only against the confirmed value with nothing pending; a
      // repeated choice of a pending segment resends, so a lost or rejected
      // request can be retried (the command is idempotent).
      if (requested.current === null && index === selectedIndex) return;
      requested.current = index;
      onSelect(index);
    },
    [onSelect, selectedIndex],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      // Step from the focused item: while a request is unconfirmed, focus is
      // on the requested item, not on `selectedIndex`.
      const focusedIndex = items.current.indexOf(event.target as HTMLElement);
      const from = focusedIndex >= 0 ? focusedIndex : selectedIndex;
      const next = nextRovingIndex(from, event.key, count);
      if (next === null) return;
      event.preventDefault();
      items.current[next]?.focus();
      select(next);
    },
    [count, select, selectedIndex],
  );

  return { refFor, onKeyDown, select };
}
