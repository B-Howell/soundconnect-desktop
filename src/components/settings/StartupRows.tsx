import { ToggleRow } from "../primitives/ToggleRow";
import { useStartWithWindowsToggle } from "../../hooks/useStartWithWindowsToggle";
import { useSettingsStore } from "../../state/settingsStore";

/**
 * The three startup switches as list rows (place inside a `GroupedList`).
 * "Start minimized" only applies to an automatic start, so it is disabled
 * while "Start with Windows" is off; its stored value is kept for when the
 * user turns autostart back on. "Start with Windows" also registers or
 * removes the autostart entry (`useStartWithWindowsToggle`).
 */
export function StartupRows() {
  const startWithWindows = useSettingsStore((state) => state.startWithWindows);
  const startMinimized = useSettingsStore((state) => state.startMinimized);
  const keepRunningInTray = useSettingsStore((state) => state.keepRunningInTray);
  const setStartWithWindows = useStartWithWindowsToggle();
  const setStartMinimized = useSettingsStore((state) => state.setStartMinimized);
  const setKeepRunningInTray = useSettingsStore((state) => state.setKeepRunningInTray);

  return (
    <>
      <ToggleRow
        title="Start with Windows"
        subtitle="Open SoundConnect when you sign in."
        checked={startWithWindows}
        onChange={setStartWithWindows}
      />
      <ToggleRow
        title="Start minimized"
        subtitle="Start in the tray without opening the window."
        checked={startMinimized}
        onChange={setStartMinimized}
        disabled={!startWithWindows}
      />
      <ToggleRow
        title="Keep running in the tray"
        subtitle="Closing the window keeps your headphones connected."
        checked={keepRunningInTray}
        onChange={setKeepRunningInTray}
      />
    </>
  );
}
