import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";

export interface ThrottledCallback<A extends unknown[]> {
  (...args: A): void;
  /** Drops a pending trailing call (for example when a commit sends the final value itself). */
  cancel: () => void;
}

/**
 * Rate-limits `fn` to at most one call per `intervalMs`. The first call runs
 * at once; calls inside the interval are coalesced and the last arguments are
 * delivered when the interval ends (trailing), so the final value of a burst
 * is never lost. Meant to sit between a slider's live `onChange` and a
 * Bluetooth command. The returned function is stable across renders, always
 * calls the latest `fn`, and a pending call is dropped on unmount.
 */
export function useThrottledCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  intervalMs: number,
): ThrottledCallback<A> {
  const latestFn = useRef(fn);
  const interval = useRef(intervalMs);
  useLayoutEffect(() => {
    latestFn.current = fn;
    interval.current = intervalMs;
  });

  const lastRun = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<A | null>(null);

  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
  }, []);

  const run = useCallback((args: A) => {
    lastRun.current = Date.now();
    latestFn.current(...args);
  }, []);

  const call = useCallback(
    (...args: A) => {
      const elapsed = lastRun.current === null ? Infinity : Date.now() - lastRun.current;
      const remaining = interval.current - elapsed;
      if (remaining <= 0 && timer.current === null) {
        run(args);
        return;
      }
      pending.current = args;
      if (timer.current !== null) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        const next = pending.current;
        pending.current = null;
        if (next) run(next);
      }, Math.max(0, remaining));
    },
    [run],
  );

  useEffect(() => cancel, [cancel]);

  return useMemo(() => Object.assign(call, { cancel }), [call, cancel]);
}
