/**
 * Names for the upstream assignable-control ids (libmdr Headphones.h:
 * `MDR_ASSIGNABLE_ACTION_KEY_*` locations, `MDR_ASSIGNABLE_ACTION_KEY_TYPE_*`
 * types, `MDR_ASSIGNABLE_*` actions), following upstream's
 * `FormatAssignableActionKeyLocation` / `FormatAssignableAction`
 * (client/Client.cpp) and their English strings (client/I18N/Default.cpp),
 * in the app's sentence case: "[NC/AMB] Button" reads "NC/AMB button",
 * "Ambient Sound Control" reads "Ambient sound control". Product names keep
 * their casing.
 */

const KEY_LEFT = 1;
const KEY_RIGHT = 2;
const TYPE_TOUCH_SENSOR = 1;
const TYPE_FACE_TAP = 3;

const fixedKeyNames: Record<number, string> = {
  3: "Custom button",
  4: "C button",
  5: "NC/AMB button",
  6: "NC/Ambient button",
};

/** The control's name from its location and type ("Left touch sensor", "NC/AMB button"). */
export function assignableKeyLabel(location: number, type: number): string {
  if (location === KEY_LEFT || location === KEY_RIGHT) {
    const side = location === KEY_LEFT ? "Left" : "Right";
    if (type === TYPE_FACE_TAP) return `${side} face tap`;
    if (type === TYPE_TOUCH_SENSOR) return `${side} touch sensor`;
    return `${side} button`;
  }
  return fixedKeyNames[location] ?? "Unknown control";
}

const actionNames: Record<number, string> = {
  0: "No function",
  1: "Playback control",
  2: "Ambient sound control",
  3: "Ambient sound control / Quick Access",
  4: "Track control",
  5: "Voice recognition",
  6: "Google Assistant",
  7: "Amazon Alexa",
  8: "Tencent Xiaowei",
  9: "Microsoft Cortana",
  10: "Quick Access",
  11: "Volume control",
  12: "Playback control (voice assistant limitation)",
  13: "Tencent Xiaowei Q MSC",
  14: "Microsoft Teams",
  15: "Google Assistant (Bluetooth Classic only)",
  16: "Amazon Alexa (Bluetooth Classic only)",
  17: "Tencent Xiaowei (Bluetooth Classic only)",
  18: "Quick Access (Bluetooth Classic only)",
  19: "Ambient sound control / Quick Access (Bluetooth Classic only)",
  20: "Tencent Xiaowei Q MSC (Bluetooth Classic only)",
  21: "Ambient sound control / Microphone",
  22: "Listening mode / Quick Access",
  23: "Ambient sound control / Listening mode",
  24: "Chat mix",
  25: "Custom 1",
  26: "Custom 2",
};

/** The function's name for an `MDR_ASSIGNABLE_*` id; "Unknown" otherwise. */
export function assignableActionLabel(action: number): string {
  return actionNames[action] ?? "Unknown";
}
