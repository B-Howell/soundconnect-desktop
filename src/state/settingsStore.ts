import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { browserLocalStorage, safeStorage } from "./safeStorage";

export type ThemePreference = "system" | "light" | "dark";

export const THEME_PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];

/** The app's own preferences (not the headphones'). */
export interface SettingsValues {
  /** "system" follows Windows; the others force a scheme (`useApplyTheme`). */
  theme: ThemePreference;
  /** The switch also registers or removes the autostart entry (`useStartWithWindowsToggle`). */
  startWithWindows: boolean;
  /** Closing the window hides it to the tray instead of quitting (Task 18). */
  keepRunningInTray: boolean;
  /** At autostart, open to the tray without showing the window; only meaningful with `startWithWindows`. */
  startMinimized: boolean;
  /** The setup wizard was finished once; a later wizard (after "Forget") skips the welcome. */
  onboardingDone: boolean;
  /** Connect when the remembered headphones appear (`setAutoConnect`, pushed by `useAutoConnectSync`). */
  autoConnect: boolean;
}

export interface SettingsState extends SettingsValues {
  setTheme: (theme: ThemePreference) => void;
  setStartWithWindows: (value: boolean) => void;
  setKeepRunningInTray: (value: boolean) => void;
  setStartMinimized: (value: boolean) => void;
  setOnboardingDone: (value: boolean) => void;
  setAutoConnect: (value: boolean) => void;
}

export const SETTINGS_DEFAULTS: SettingsValues = {
  theme: "system",
  startWithWindows: false,
  keepRunningInTray: true,
  startMinimized: false,
  onboardingDone: false,
  autoConnect: false,
};

/** The single `localStorage` key holding every app setting as JSON. */
export const SETTINGS_STORAGE_KEY = "soundconnect.settings";

/**
 * Keeps only well-typed known fields from whatever was stored, so a stale,
 * hand-edited or corrupt entry can never put an invalid value into the
 * store; anything else falls back to the defaults.
 */
export function sanitizeSettings(stored: unknown): Partial<SettingsValues> {
  if (typeof stored !== "object" || stored === null) return {};
  const raw = stored as Record<string, unknown>;
  const clean: Partial<SettingsValues> = {};
  if (THEME_PREFERENCES.includes(raw.theme as ThemePreference)) clean.theme = raw.theme as ThemePreference;
  for (const key of ["startWithWindows", "keepRunningInTray", "startMinimized", "onboardingDone", "autoConnect"] as const) {
    if (typeof raw[key] === "boolean") clean[key] = raw[key];
  }
  return clean;
}

/**
 * Builds a settings store persisted to `storage` under `SETTINGS_STORAGE_KEY`.
 * Exported so tests can use a fake storage; the app uses `useSettingsStore`.
 * Synchronous storage means the store is hydrated as soon as it is created,
 * so the saved theme can be applied before the first paint.
 */
export function createSettingsStore(storage: StateStorage) {
  return create<SettingsState>()(
    persist(
      (set) => ({
        ...SETTINGS_DEFAULTS,
        setTheme: (theme) => set({ theme }),
        setStartWithWindows: (startWithWindows) => set({ startWithWindows }),
        setKeepRunningInTray: (keepRunningInTray) => set({ keepRunningInTray }),
        setStartMinimized: (startMinimized) => set({ startMinimized }),
        setOnboardingDone: (onboardingDone) => set({ onboardingDone }),
        setAutoConnect: (autoConnect) => set({ autoConnect }),
      }),
      {
        name: SETTINGS_STORAGE_KEY,
        version: 1,
        storage: createJSONStorage(() => storage),
        partialize: ({
          theme,
          startWithWindows,
          keepRunningInTray,
          startMinimized,
          onboardingDone,
          autoConnect,
        }): SettingsValues => ({
          theme,
          startWithWindows,
          keepRunningInTray,
          startMinimized,
          onboardingDone,
          autoConnect,
        }),
        merge: (stored, current) => ({ ...current, ...sanitizeSettings(stored) }),
      },
    ),
  );
}

/** The app's settings, persisted to `localStorage` (failures ignored, see `safeStorage`). */
export const useSettingsStore = createSettingsStore(safeStorage(browserLocalStorage));
