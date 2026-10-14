import { createContext, useContext } from "react";
import { defaultSettingsBridge, type SettingsBridge } from "../lib/settingsBridge";

/**
 * Which settings bridge the hooks use: the Tauri one in the app, a no-op in a
 * plain browser; tests wrap a tree in `SettingsBridgeProvider` with a spy.
 */
const SettingsBridgeContext = createContext<SettingsBridge>(defaultSettingsBridge);

export const SettingsBridgeProvider = SettingsBridgeContext.Provider;

export function useSettingsBridge(): SettingsBridge {
  return useContext(SettingsBridgeContext);
}
