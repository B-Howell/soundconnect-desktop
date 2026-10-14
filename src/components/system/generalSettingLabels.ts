/**
 * Display text for the general-setting text keys the device reports
 * (`MDR_TEXT_GENERAL_SETTING_SUBJECT` / `_SUMMARY`), after upstream's
 * `kGSSubjectStrings` / `kGSSummaryStrings` (client/Client.cpp) and their
 * English strings (client/I18N/Default.cpp: `_Def(Multipoint, "Connect to 2
 * devices simultaneously")`, `_Def(TouchControl, "Touch sensor control
 * panel")` ...), in the app's sentence case. The summaries are shortened to
 * fit a row subtitle; the multipoint one keeps the LDAC caveat.
 */
const subjects: Record<string, string> = {
  MULTIPOINT_SETTING: "Connect to 2 devices simultaneously",
  SIDETONE_SETTING: "Capture voice during a phone call",
  TOUCH_PANEL_SETTING: "Touch sensor control panel",
};

const summaries: Record<string, string> = {
  MULTIPOINT_SETTING_SUMMARY: "Use a PC and a phone without switching. LDAC is unavailable while both are connected.",
  MULTIPOINT_SETTING_SUMMARY_LDAC_AVAILABLE: "Use a PC and a phone without switching connections.",
  SIDETONE_SETTING_SUMMARY: "Hear your own voice more easily during calls.",
};

/** The setting's name; upstream's "Unknown" for a key it does not know. */
export function generalSettingSubject(key: string): string {
  return subjects[key] ?? "Unknown setting";
}

/** The setting's explanation, or undefined when the device sent none or an unknown key. */
export function generalSettingSummary(key: string): string | undefined {
  return key ? summaries[key] : undefined;
}
