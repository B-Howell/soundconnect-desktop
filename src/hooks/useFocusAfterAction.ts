import { useCallback, useEffect, useRef, type RefObject } from "react";

export interface FocusAfterAction<T extends HTMLElement> {
  /** Attach to the element that should receive focus (give it `tabIndex={-1}` if it is not focusable). */
  target: RefObject<T | null>;
  /** Call from the user action (for example a button's click) whose result may remove the focused control. */
  markAction: () => void;
}

/**
 * Moves focus to `target` when `key` changes after a user action, so focus is
 * not dropped on `<body>` when the action's result unmounts the control that
 * had it ("Try again" disappears once connecting starts). Changes that no
 * user action asked for leave focus alone.
 */
export function useFocusAfterAction<T extends HTMLElement>(key: unknown): FocusAfterAction<T> {
  const target = useRef<T>(null);
  const pending = useRef(false);

  useEffect(() => {
    if (!pending.current) return;
    pending.current = false;
    target.current?.focus();
  }, [key]);

  const markAction = useCallback(() => {
    pending.current = true;
  }, []);

  return { target, markAction };
}
