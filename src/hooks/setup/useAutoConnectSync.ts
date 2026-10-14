import { useEffect } from "react";
import { useEngineStoreApi } from "../../state/engineContext";
import { useSettingsStore } from "../../state/settingsStore";

/**
 * Tells the engine the stored "Connect automatically" choice
 * (`setAutoConnect {enabled}`) once at start and whenever it changes. The
 * engine also stores the setting and reads it at launch; sending the
 * renderer's value at start makes the renderer's store the one source of
 * truth (the two can differ after cleared WebView storage). Called once, in
 * `AppRoot`.
 */
export function useAutoConnectSync(): void {
  const store = useEngineStoreApi();
  const enabled = useSettingsStore((state) => state.autoConnect);
  useEffect(() => {
    void store.getState().send({ type: "setAutoConnect", enabled });
  }, [store, enabled]);
}
