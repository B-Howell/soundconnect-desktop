import { useCallback, useLayoutEffect, useRef, useState } from "react";

/** Keys that change a range input's value; their release ends a keyboard adjustment. */
const VALUE_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"]);

type GestureSource = "pointer" | "key";

interface Gesture {
  source: GestureSource;
  /** Controlled value when the gesture began. */
  start: number;
  /** Last value the control reported during the gesture. */
  latest: number;
}

export interface CommitOnReleaseOptions {
  /** Once per gesture, with the value the user ended on. */
  onCommit?: (value: number) => void;
  /** True when a pointer or key gesture starts, false when it ends. */
  onGestureChange?: (active: boolean) => void;
}

export interface CommitOnRelease {
  /** What the control should show: the user's value during a gesture, else the controlled value. */
  displayValue: number;
  /** Call with every value the control reports. */
  track: (value: number) => void;
  onPointerDown: () => void;
  /** Pointer up or cancel: ends a pointer gesture only. */
  onPointerEnd: () => void;
  onKeyDown: (event: { key: string }) => void;
  /** Ends a keyboard gesture only, so a key release cannot end a drag. */
  onKeyUp: (event: { key: string }) => void;
  /** Ends whatever gesture is active (blur). */
  onGestureEnd: () => void;
}

/**
 * Turns a stream of live values into one commit per gesture: a pointer drag
 * commits on release, a keyboard adjustment on key-up (so a held arrow key
 * commits once). A gesture that ends where it started commits nothing. A
 * value reported outside any gesture (assistive technology setting the value
 * directly) commits at once. Meant for device commands that should not be
 * sent on every intermediate value.
 *
 * The gesture's baseline is the controlled `value` when it begins, so
 * updates that arrive while idle (a device notification) are never lost.
 * During a gesture `displayValue` is the user's latest value, so a device
 * echo arriving mid-drag cannot move the thumb under the pointer.
 */
export function useCommitOnRelease(
  value: number,
  { onCommit, onGestureChange }: CommitOnReleaseOptions = {},
): CommitOnRelease {
  const current = useRef(value);
  const callbacks = useRef({ onCommit, onGestureChange });
  useLayoutEffect(() => {
    current.current = value;
    callbacks.current = { onCommit, onGestureChange };
  });

  const gesture = useRef<Gesture | null>(null);
  const [held, setHeld] = useState<number | null>(null);

  const begin = useCallback((source: GestureSource) => {
    if (gesture.current) return;
    gesture.current = { source, start: current.current, latest: current.current };
    setHeld(current.current);
    callbacks.current.onGestureChange?.(true);
  }, []);

  const end = useCallback((source?: GestureSource) => {
    const active = gesture.current;
    if (!active || (source && active.source !== source)) return;
    gesture.current = null;
    setHeld(null);
    callbacks.current.onGestureChange?.(false);
    if (active.latest !== active.start) callbacks.current.onCommit?.(active.latest);
  }, []);

  const track = useCallback((next: number) => {
    const active = gesture.current;
    if (!active) {
      if (next !== current.current) callbacks.current.onCommit?.(next);
      return;
    }
    active.latest = next;
    setHeld(next);
  }, []);

  const onPointerDown = useCallback(() => begin("pointer"), [begin]);
  const onPointerEnd = useCallback(() => end("pointer"), [end]);
  const onGestureEnd = useCallback(() => end(), [end]);
  const onKeyDown = useCallback(
    (event: { key: string }) => {
      if (VALUE_KEYS.has(event.key)) begin("key");
    },
    [begin],
  );
  const onKeyUp = useCallback(
    (event: { key: string }) => {
      if (VALUE_KEYS.has(event.key)) end("key");
    },
    [end],
  );

  return {
    displayValue: held ?? value,
    track,
    onPointerDown,
    onPointerEnd,
    onKeyDown,
    onKeyUp,
    onGestureEnd,
  };
}
