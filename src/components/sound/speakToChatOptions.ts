import type { Option } from "../primitives/OptionList";

/** Voice detect sensitivity, as the engine names it (`SpeechSensitivity` without `unknown`). */
export type SpeakToChatSensitivityValue = "auto" | "high" | "low";
/** Time until Speak-to-Chat closes (`SpeakTimeout` without `unknown`). */
export type SpeakToChatTimeoutValue = "short" | "medium" | "long" | "manual";

/** Sony's "Voice detect sensitivity" choices, in the app's order. */
export const SPEAK_TO_CHAT_SENSITIVITIES: readonly Option<SpeakToChatSensitivityValue>[] = [
  { value: "auto", label: "Auto" },
  { value: "high", label: "High sensitivity" },
  { value: "low", label: "Low sensitivity" },
];

/** Sony's "Time until Speak-to-Chat closes" choices: short, medium and long are about 5, 15 and 30 seconds. */
export const SPEAK_TO_CHAT_TIMEOUTS: readonly Option<SpeakToChatTimeoutValue>[] = [
  { value: "short", label: "Short (about 5 s)" },
  { value: "medium", label: "Standard (about 15 s)" },
  { value: "long", label: "Long (about 30 s)" },
  { value: "manual", label: "Does not close automatically" },
];
