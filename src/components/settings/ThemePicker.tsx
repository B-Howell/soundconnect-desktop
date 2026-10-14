import type { Option } from "../primitives/OptionList";
import { PickerRow } from "../primitives/PickerRow";
import { useSettingsStore, type ThemePreference } from "../../state/settingsStore";

const themeOptions: readonly Option<ThemePreference>[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** "Theme" row (the Appearance section): System / Light / Dark, stored in the settings store and applied by `useApplyTheme`. */
export function ThemePicker() {
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  return <PickerRow title="Theme" options={themeOptions} value={theme} onChange={setTheme} />;
}
