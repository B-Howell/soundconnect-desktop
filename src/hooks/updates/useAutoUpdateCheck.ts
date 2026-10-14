import { useEffect } from "react";
import { useSettingsStore } from "../../state/settingsStore";
import { useUpdaterStore, type UpdaterStore } from "../../state/updaterStore";

/** At most one automatic check per this long. */
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Wait after launch before the automatic check, so it never competes with connecting. */
export const UPDATE_CHECK_DELAY_MS = 5_000;

/**
 * Once per launch, a few seconds in: when "Check for updates automatically"
 * is on and the last automatic check was a day or more ago, records the time
 * and checks. The banner shows the result; nothing installs without the user.
 */
export function useAutoUpdateCheck(store: UpdaterStore = useUpdaterStore, delayMs = UPDATE_CHECK_DELAY_MS): void {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const settings = useSettingsStore.getState();
      if (!settings.checkForUpdates) return;
      const now = Date.now();
      if (now - settings.lastUpdateCheck < UPDATE_CHECK_INTERVAL_MS) return;
      settings.setLastUpdateCheck(now);
      void store.getState().check();
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [store, delayMs]);
}
