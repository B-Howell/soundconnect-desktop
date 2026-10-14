/**
 * What the renderer tells the Rust side about the app's settings.
 *
 * The settings store (`src/state/settingsStore.ts`, `localStorage`) is the
 * source of truth. Rust cannot read WebView storage, but it needs
 * `keepRunningInTray` when the window is closed and `startWithWindows` /
 * `startMinimized` before the window is shown, so `write` mirrors all four
 * values into `settings.json` in the app config dir through the
 * `settings_write` command (`src-tauri/src/settings.rs`). `setAutostart`
 * registers or removes the Windows sign-in entry through
 * `tauri-plugin-autostart` (which launches the app with `--minimized`).
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import type { SettingsValues } from "../state/settingsStore";

/** The four values Rust reads; the onboarding and auto-connect flags stay in the renderer. */
export type BridgedSettings = Pick<SettingsValues, "theme" | "startWithWindows" | "startMinimized" | "keepRunningInTray">;

export interface SettingsBridge {
  /** `settings_write(settings)`: replaces the Rust-side mirror. */
  write(values: BridgedSettings): Promise<void>;
  /** `plugin:autostart|enable` / `disable`. */
  setAutostart(enabled: boolean): Promise<void>;
  /** `plugin:autostart|is_enabled`; null where there is no entry to ask about. */
  isAutostartEnabled(): Promise<boolean | null>;
}

export const tauriSettingsBridge: SettingsBridge = {
  write: (settings) => invoke("settings_write", { settings }),
  setAutostart: (enabled) => (enabled ? enable() : disable()),
  isAutostartEnabled: () => isEnabled(),
};

/** Outside Tauri (`pnpm dev:web`, tests) there is nothing to tell. */
export const noopSettingsBridge: SettingsBridge = {
  write: async () => {},
  setAutostart: async () => {},
  isAutostartEnabled: async () => null,
};

export const defaultSettingsBridge: SettingsBridge = isTauri() ? tauriSettingsBridge : noopSettingsBridge;

/** Only the four stored values, in a fixed key order (the store also holds its setters). */
export function pickSettings(state: BridgedSettings): BridgedSettings {
  return {
    theme: state.theme,
    startWithWindows: state.startWithWindows,
    startMinimized: state.startMinimized,
    keepRunningInTray: state.keepRunningInTray,
  };
}
