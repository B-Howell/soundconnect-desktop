import { useCallback, useEffect, type KeyboardEvent, type RefObject } from "react";

/** Elements a keyboard user can Tab to (disabled and negative tabindex excluded). */
const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector));
}

export interface FocusTrapOptions {
  /** Element to focus on activation; otherwise the chosen option (`aria-current`), else the first focusable. */
  initialFocus?: RefObject<HTMLElement | null>;
}

/**
 * Modal focus handling for a dialog while `active`: moves focus inside on
 * activation, keeps Tab and Shift+Tab cycling within `container`, and gives
 * focus back to whatever had it before (the opener) on deactivation or unmount.
 * Returns the keydown handler to put on the container.
 */
export function useFocusTrap(
  container: RefObject<HTMLElement | null>,
  active: boolean,
  { initialFocus }: FocusTrapOptions = {},
): (event: KeyboardEvent) => void {
  useEffect(() => {
    if (!active) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = container.current;
    if (root) {
      // A picker opens on its current choice, as iOS does.
      const chosen = root.querySelector<HTMLElement>("button[aria-current='true']");
      const target = initialFocus?.current ?? chosen ?? focusableIn(root)[0] ?? root;
      target.focus();
    }
    return () => {
      if (opener?.isConnected) opener.focus();
    };
    // `initialFocus` is a ref, read once at activation, so it is not a dependency.
  }, [active, container]);

  return useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !container.current) return;
      const items = focusableIn(container.current);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      const outside = !container.current.contains(current);
      if (event.shiftKey && (current === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    },
    [container],
  );
}
