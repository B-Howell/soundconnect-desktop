import { useSettingsStore } from "../../state/settingsStore";
import { ToggleRow } from "../primitives/ToggleRow";

/**
 * "Connect automatically": stored in the settings store and pushed to the
 * engine as `setAutoConnect` by `useAutoConnectSync`. On by default (and
 * turned on by finishing setup): the remembered headphones connect when they
 * appear in Windows' list, never as a retry after another app took control.
 * Off, the app waits for the user's Connect.
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
