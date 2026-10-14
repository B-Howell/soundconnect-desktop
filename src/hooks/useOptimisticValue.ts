import { useCallback, useEffect, useRef, useState } from "react";
import { idleOptimistic, optimisticReducer, resolveOptimistic, type OptimisticOptions } from "../lib/optimistic";

export interface UseOptimisticValueOptions<T> extends Partial<OptimisticOptions<T>> {}

/**
 * `[value, setLocal]`: `value` is the locally set value until `confirmed`
 * matches it (per `equals`) or `timeoutMs` (default 2 s) passes, then
 * `confirmed`. The reducer in `src/lib/optimistic.ts` holds the rules.
 * Options are read through a ref, so a caller may pass a fresh `equals`
 * each render without re-subscribing the effects.
 */
export function useOptimisticValue<T>(
  confirmed: T,
  { equals = Object.is, timeoutMs = 2000 }: UseOptimisticValueOptions<T> = {},
): [T, (value: T) => void] {
  const [state, setState] = useState(() => idleOptimistic(confirmed));
  const options = useRef<OptimisticOptions<T>>({ equals, timeoutMs });
  options.current = { equals, timeoutMs };

  useEffect(() => {
    setState((current) =>
      optimisticReducer(current, { type: "confirm", value: confirmed, at: Date.now() }, options.current),
    );
  }, [confirmed]);

  useEffect(() => {
    if (!state.held) return;
    const remaining = Math.max(0, state.setAt + timeoutMs - Date.now());
    const timer = setTimeout(
      () => setState((current) => optimisticReducer(current, { type: "expire", at: Date.now() }, options.current)),
      remaining,
    );
    return () => clearTimeout(timer);
  }, [state.held, state.setAt, timeoutMs]);

  const setLocal = useCallback(
    (value: T) =>
      setState((current) => optimisticReducer(current, { type: "set", value, at: Date.now() }, options.current)),
    [],
  );

  // Resolve against the live `confirmed` too, so a confirmation shows in the
  // same render it arrives rather than one effect later.
  const value = state.held && equals(state.value, confirmed) ? confirmed : resolveOptimistic(state, confirmed);
  return [value, setLocal];
}
