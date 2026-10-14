import { useLayoutEffect } from "react";
import { useSettingsStore, type ThemePreference } from "../state/settingsStore";

/**
 * Forces a colour scheme on `root` through `data-theme` (tokens.css switches
 * `color-scheme`, and every `light-dark()` token follows); "system" removes
 * the attribute so `prefers-color-scheme` decides.
 */
export function applyTheme(theme: ThemePreference, root: HTMLElement = document.documentElement): void {
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

/**
 * Keeps `<html data-theme>` in step with the stored theme. Mount once (App).
 * A layout effect, so a change is applied before the browser paints the
 * re-rendered page: the picker's check mark and the new colours arrive in the
 * same frame.
 */
export function useApplyTheme(): void {
  const theme = useSettingsStore((state) => state.theme);
  useLayoutEffect(() => applyTheme(theme), [theme]);
}
