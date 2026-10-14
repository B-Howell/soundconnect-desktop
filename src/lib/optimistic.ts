/**
 * A locally set value that stands in for the store's value until the store
 * confirms it or a timeout passes. Pure so it can be unit-tested; the hook
 * `useOptimisticValue` drives it with React state and one timer.
 *
 * The hold matters most for a slider: between throttled commands the store
 * carries the last value sent while the thumb is further along, and after the
 * device's own echo (possibly a step off) the slider should settle on the
 * confirmed value rather than snap back and forth.
 */

export interface OptimisticState<T> {
  /** True while a local value is held. */
  held: boolean;
  value: T;
  /** `now()` when the value was set; meaningful only while `held`. */
  setAt: number;
}

export type OptimisticAction<T> =
  | { type: "set"; value: T; at: number }
  | { type: "confirm"; value: T; at: number }
  | { type: "expire"; at: number };

export interface OptimisticOptions<T> {
  equals: (a: T, b: T) => boolean;
  /** How long a local value is held without confirmation. */
  timeoutMs: number;
}

export const idleOptimistic = <T>(value: T): OptimisticState<T> => ({ held: false, value, setAt: 0 });

const expired = <T>(state: OptimisticState<T>, at: number, timeoutMs: number): boolean => at - state.setAt >= timeoutMs;

export function optimisticReducer<T>(
  state: OptimisticState<T>,
  action: OptimisticAction<T>,
  { equals, timeoutMs }: OptimisticOptions<T>,
): OptimisticState<T> {
  switch (action.type) {
    case "set":
      return { held: true, value: action.value, setAt: action.at };
    case "confirm":
      if (!state.held) return state;
      if (equals(state.value, action.value) || expired(state, action.at, timeoutMs)) return idleOptimistic(action.value);
      return state;
    case "expire":
      if (!state.held || !expired(state, action.at, timeoutMs)) return state;
      return idleOptimistic(state.value);
  }
}

/** The value to show: the held local value, else the confirmed one. */
export function resolveOptimistic<T>(state: OptimisticState<T>, confirmed: T): T {
  return state.held ? state.value : confirmed;
}
