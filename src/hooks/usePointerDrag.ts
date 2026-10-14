import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export interface PointerDragCallbacks {
  /** First position, on pointer down. */
  onStart?: (position: number) => void;
  /** Every move while captured. */
  onMove?: (position: number) => void;
  /** Last position, on release or cancel. */
  onEnd?: (position: number) => void;
}

export interface PointerDragHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Horizontal drag on one element with pointer capture. Positions are 0..1
 * across the element's own width, measured from the pointer-down target so a
 * drag that leaves the element keeps reporting. Spread `handlers` on the
 * element; `dragging` is true between down and up.
 */
export function usePointerDrag({ onStart, onMove, onEnd }: PointerDragCallbacks): {
  handlers: PointerDragHandlers;
  dragging: boolean;
} {
  const [dragging, setDragging] = useState(false);
  const pointerId = useRef<number | null>(null);
  const callbacks = useRef({ onStart, onMove, onEnd });
  callbacks.current = { onStart, onMove, onEnd };

  const positionOf = (event: ReactPointerEvent<HTMLElement>): number => {
    const rect = event.currentTarget.getBoundingClientRect();
    return rect.width > 0 ? clamp01((event.clientX - rect.left) / rect.width) : 0;
  };

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || pointerId.current !== null) return;
    pointerId.current = event.pointerId;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // NotFoundError when the pointer is already gone; the drag still works
      // while the pointer stays over the element.
    }
    setDragging(true);
    callbacks.current.onStart?.(positionOf(event));
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerId !== pointerId.current) return;
    callbacks.current.onMove?.(positionOf(event));
  }, []);

  const finish = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerId !== pointerId.current) return;
    pointerId.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
    callbacks.current.onEnd?.(positionOf(event));
  }, []);

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish },
    dragging,
  };
}
