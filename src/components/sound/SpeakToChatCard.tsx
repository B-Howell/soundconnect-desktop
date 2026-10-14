import { GroupedList } from "../primitives/GroupedList";
import { PickerRow } from "../primitives/PickerRow";
import { ToggleRow } from "../primitives/ToggleRow";
import {
  SPEAK_TO_CHAT_SENSITIVITIES,
  SPEAK_TO_CHAT_TIMEOUTS,
  type SpeakToChatSensitivityValue,
  type SpeakToChatTimeoutValue,
} from "./speakToChatOptions";

export interface SpeakToChatCardProps {
  enabled: boolean;
  /** The device's sensitivity; a value outside the options reads "Unknown". */
  sensitivity: SpeakToChatSensitivityValue | string | number;
  timeout: SpeakToChatTimeoutValue | string | number;
  onEnabledChange: (enabled: boolean) => void;
  onSensitivityChange: (sensitivity: SpeakToChatSensitivityValue) => void;
  onTimeoutChange: (timeout: SpeakToChatTimeoutValue) => void;
  disabled?: boolean;
}

/**
 * Sony's Speak-to-Chat: the switch, then "Voice detect sensitivity" and
 * "Time until Speak-to-Chat closes" pickers, which are dimmed while
 * Speak-to-Chat is off (they only matter while it listens).
 */
export function SpeakToChatCard({
  enabled,
  sensitivity,
  timeout,
  onEnabledChange,
  onSensitivityChange,
  onTimeoutChange,
  disabled = false,
}: SpeakToChatCardProps) {
  const pickersDisabled = disabled || !enabled;
  return (
    <GroupedList aria-label="Speak-to-Chat">
      <ToggleRow
        title="Speak-to-Chat"
        subtitle="Pauses music when you talk"
        checked={enabled}
        onChange={onEnabledChange}
        disabled={disabled}
      />
      <PickerRow
        title="Voice detect sensitivity"
        options={SPEAK_TO_CHAT_SENSITIVITIES}
        value={sensitivity as SpeakToChatSensitivityValue}
        onChange={onSensitivityChange}
        disabled={pickersDisabled}
      />
      <PickerRow
        title="Time until Speak-to-Chat closes"
        options={SPEAK_TO_CHAT_TIMEOUTS}
        value={timeout as SpeakToChatTimeoutValue}
        onChange={onTimeoutChange}
        valuePlacement="subtitle"
        disabled={pickersDisabled}
      />
    </GroupedList>
  );
}
