import { useEffect } from "react";
import { pickSettings } from "../lib/settingsBridge";
import { useSettingsBridge } from "./settingsBridgeContext";
import { useSettingsStore } from "./settingsStore";

/**
 * Keeps the Rust-side copy of the settings (`settings.json`, read at launch
 * for start-minimized and on close for keep-running-in-tray) equal to the
 * store: writes once on mount, then whenever one of the four values changes.
 * Called once in `App`. A failed write is logged; the store stays the source
 * of truth and the next change writes again.
 *
 * Also reconciles "Start with Windows" once with the real autostart entry
 * (`isAutostartEnabled`): the entry can be removed outside the app (Task
 * Manager) or the store lost, and the switch must show what Windows will do.
 */
export function useSettingsSync(): void {
  const bridge = useSettingsBridge();
  useEffect(() => {
    let last = "";
    const push = (state: Parameters<typeof pickSettings>[0]) => {
      const values = pickSettings(state);
      const key = JSON.stringify(values);
      if (key === last) return;
      last = key;
      bridge.write(values).catch((error: unknown) => {
        console.error("settings_write failed", error);
        // Let the next store change retry even if it lands on the same values.
        if (last === key) last = "";
      });
    };
    let cancelled = false;
    bridge
      .isAutostartEnabled()
      .then((enabled) => {
        if (!cancelled && enabled !== null && enabled !== useSettingsStore.getState().startWithWindows) {
          useSettingsStore.getState().setStartWithWindows(enabled);
        }
      })
      .catch((error: unknown) => console.error("autostart isEnabled failed", error));
    push(useSettingsStore.getState());
    const unsubscribe = useSettingsStore.subscribe(push);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [bridge]);
}
