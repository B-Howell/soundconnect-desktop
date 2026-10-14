import { useCallback } from "react";
import type { ConnectAttempt } from "../../lib/engine/connectAttempt";
import { useEngine, useEngineStoreApi } from "../../state/engineContext";

export interface ConnectAttemptControls {
  attempt: ConnectAttempt | null;
  /** Sends `connect {address}` and follows it. */
  connect: (address: string) => void;
}

/** The user's current connect attempt (`connectAttempt.ts`) and a stable connect. */
export function useConnectAttempt(): ConnectAttemptControls {
  const store = useEngineStoreApi();
  const attempt = useEngine((state) => state.attempt);
  const connect = useCallback((address: string) => void store.getState().connectTo(address), [store]);
  return { attempt, connect };
}
