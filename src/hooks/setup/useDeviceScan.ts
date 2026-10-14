import { useCallback } from "react";
import { useEngine, useEngineStoreApi } from "../../state/engineContext";
import type { ScanState } from "../../state/engineStore";

export interface DeviceScan {
  scan: ScanState;
  /** Sends `scan`; the list fills from `engine:devices`. */
  start: () => void;
}

/** The setup wizard's device scan: its state and a stable start. */
export function useDeviceScan(): DeviceScan {
  const store = useEngineStoreApi();
  const scan = useEngine((state) => state.scan);
  const start = useCallback(() => void store.getState().startScan(), [store]);
  return { scan, start };
}
