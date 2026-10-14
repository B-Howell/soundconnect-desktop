import { useEffect } from "react";
import { useEngineStoreApi } from "./engineContext";

/**
 * Starts the engine store once for the life of the app (called in `App`):
 * subscribes to `engine:status` / `engine:snapshot` / `engine:alert`, then
 * reads the current status and snapshot. Subscribing first means an event
 * that arrives during the read is not lost. The cleanup unsubscribes, so
 * StrictMode's mount-unmount-mount leaves one subscription.
 */
export function useEngineBootstrap(): void {
  const store = useEngineStoreApi();
  useEffect(() => {
    const { connect, load } = store.getState();
    const disconnect = connect();
    void load();
    return disconnect;
  }, [store]);
}
