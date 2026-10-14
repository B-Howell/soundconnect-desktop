import { isTauri } from "@tauri-apps/api/core";

/**
 * True when the renderer runs inside the Tauri webview, false under
 * `pnpm dev:web` in a plain browser. Constant for the life of the page, so
 * this reads the flag once and never re-renders anything.
 */
const inTauri = isTauri();

export function useIsTauri(): boolean {
  return inTauri;
}
