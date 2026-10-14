import { useCallback } from "react";
import { useSettingsBridge } from "../state/settingsBridgeContext";
import { useSettingsStore } from "../state/settingsStore";

/**
 * The "Start with Windows" switch's change handler: stores the value at once
 * (the switch moves immediately) and registers or removes the autostart entry;
 * if that fails the stored value is put back so the switch never claims an
 * entry that does not exist.
 */
export function useStartWithWindowsToggle(): (value: boolean) => void {
  const bridge = useSettingsBridge();
  const setStartWithWindows = useSettingsStore((state) => state.setStartWithWindows);
  return useCallback(
    (value: boolean) => {
      setStartWithWindows(value);
      bridge.setAutostart(value).catch((error: unknown) => {
        console.error(`autostart ${value ? "enable" : "disable"} failed`, error);
        setStartWithWindows(!value);
      });
    },
    [bridge, setStartWithWindows],
  );
}
