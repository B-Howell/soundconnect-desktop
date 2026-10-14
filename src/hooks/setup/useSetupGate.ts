import { useLayoutEffect } from "react";
import { useEngine, useEngineStoreApi } from "../../state/engineContext";
import { selectConnected } from "../../state/engineStore";
import { useSettingsStore } from "../../state/settingsStore";
import { useSetupStore } from "../../state/setupStore";

/**
 * Opens the setup wizard when the engine remembers no headphones (a first run,
 * or after "Forget these headphones") and nothing is connected. It waits for
 * a status from the engine (not a failed read), so the app never flashes the
 * wizard before it knows. A first run starts at the welcome; once setup has
 * been finished before, it starts at "Pair with Windows". A settled connect
 * attempt is cleared first, so an old "connected" cannot skip to "All set".
 * Called once, in `AppRoot`.
 */
export function useSetupGate(): void {
  const store = useEngineStoreApi();
  const loaded = useEngine((state) => state.hasStatus);
  const hasRemembered = useEngine((state) => state.remembered !== null);
  const connected = useEngine(selectConnected);
  const open = useSetupStore((state) => state.open);
  const openSetup = useSetupStore((state) => state.openSetup);
  const onboardingDone = useSettingsStore((state) => state.onboardingDone);

  // A layout effect, so the wizard replaces the app before the first paint, not one frame later.
  useLayoutEffect(() => {
    if (loaded && !hasRemembered && !connected && !open) {
      store.getState().clearAttempt();
      openSetup(onboardingDone ? "pair" : "welcome");
    }
  }, [loaded, hasRemembered, connected, open, openSetup, onboardingDone, store]);
}
