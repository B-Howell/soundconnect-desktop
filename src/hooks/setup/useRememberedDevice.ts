import type { RememberedDevice } from "../../lib/engine/types";
import { useEngine } from "../../state/engineContext";

/**
 * The headphones the engine remembers, or null (none yet, or forgotten). Read
 * from the store's `remembered`, not the status's: the status carries the
 * profile of the address it names, which is null while another device is tried.
 */
export function useRememberedDevice(): RememberedDevice | null {
  return useEngine((state) => state.remembered);
}
