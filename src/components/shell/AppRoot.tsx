import { useAutoConnectSync } from "../../hooks/setup/useAutoConnectSync";
import { useSetupGate } from "../../hooks/setup/useSetupGate";
import { useEngine } from "../../state/engineContext";
import { useSetupStore } from "../../state/setupStore";
import { AppFrame } from "../frame/AppFrame";
import { SetupScreen } from "../setup/SetupScreen";
import { AppShell } from "./AppShell";

/**
 * Chooses what the window shows: the setup wizard (no remembered headphones,
 * or "Set up new headphones"), else the app. Until the engine's first status
 * arrives it shows the empty frame, so a first run does not flash the app
 * before the wizard. Also keeps the engine's auto-connect in step with the
 * stored setting.
 */
export function AppRoot() {
  useSetupGate();
  useAutoConnectSync();
  const loaded = useEngine((state) => state.statusLoaded);
  const setupOpen = useSetupStore((state) => state.open);

  if (setupOpen) return <SetupScreen />;
  if (!loaded) {
    return (
      <AppFrame wordmark="SoundConnect" pageKey="loading">
        {null}
      </AppFrame>
    );
  }
  return <AppShell />;
}
