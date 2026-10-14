import { useSettingsStore } from "../../state/settingsStore";
import { ToggleRow } from "../primitives/ToggleRow";

/**
 * "Connect automatically when the headphones appear": stored in the settings
 * store and pushed to the engine as `setAutoConnect` by `useAutoConnectSync`.
 * Off by default, so the app waits for the user's Connect.
 */
export function AutoConnectRow() {
  const autoConnect = useSettingsStore((state) => state.autoConnect);
  const setAutoConnect = useSettingsStore((state) => state.setAutoConnect);
  return (
    <ToggleRow
      title="Connect automatically"
      checked={autoConnect}
      onChange={setAutoConnect}
    />
  );
}
