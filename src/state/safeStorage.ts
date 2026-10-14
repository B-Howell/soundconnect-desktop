import type { StateStorage } from "zustand/middleware";

/**
 * Wraps a Web Storage so no read or write can throw: the accessor itself
 * (`window.localStorage` throws in some sandboxed or privacy modes), a quota
 * error, or a missing storage all degrade to "nothing stored". Settings then
 * live only in memory for the session instead of breaking rendering.
 */
export function safeStorage(getStorage: () => Storage | undefined): StateStorage {
  return {
    getItem: (name) => {
      try {
        return getStorage()?.getItem(name) ?? null;
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        getStorage()?.setItem(name, value);
      } catch {
        // Not persisted this time; the in-memory state is still correct.
      }
    },
    removeItem: (name) => {
      try {
        getStorage()?.removeItem(name);
      } catch {
        // As above.
      }
    },
  };
}

/** `window.localStorage`, or undefined outside a browser (Node tests). */
export function browserLocalStorage(): Storage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}
