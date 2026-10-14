import { useCallback, useSyncExternalStore } from "react";

/** `window.matchMedia`, or undefined where it does not exist (jsdom). */
const matcher = (query: string): MediaQueryList | undefined =>
  typeof window.matchMedia === "function" ? window.matchMedia(query) : undefined;

/** Live boolean for a CSS media query, kept in step with the window; false where media queries cannot be read. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = matcher(query);
      list?.addEventListener("change", onChange);
      return () => list?.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => matcher(query)?.matches ?? false,
    () => false,
  );
}
