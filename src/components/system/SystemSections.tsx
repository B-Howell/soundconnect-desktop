import { CardGrid, CardStack } from "../page/CardGrid";
import { LabelledSection } from "../page/LabelledSection";
import { PhoneOnlyNote } from "../page/PhoneOnlyNote";
import { PlaceholderSection } from "../page/PlaceholderSection";
import { GroupedList } from "../primitives/GroupedList";
import { DeviceSettingsCard, type DeviceSettingsCardProps } from "./DeviceSettingsCard";
import { PowerOffRow, type PowerOffRowProps } from "./PowerOffRow";
import { VoiceGuidanceRow, type VoiceGuidanceRowProps } from "./VoiceGuidanceRow";

export interface SystemSectionsProps {
  device?: DeviceSettingsCardProps;
  voiceGuidance?: VoiceGuidanceRowProps;
  power?: PowerOffRowProps;
}

/** What Sony's app has on its System screen that only a phone can do. */
export const SYSTEM_PHONE_ONLY = ["Software update", "Activity and badges"] as const;

/**
 * The System page's content, Sony's System screen: the headphones' own
 * settings (touch sensor, automatic pause, automatic power off), then
 * Notification & voice guide and Power off in the second column, and the
 * phone-only footnote. Presentational; `SystemPage` feeds it engine state and
 * the gallery demo values. With nothing to show, a "Headphones" placeholder.
 */
export function SystemSections({ device, voiceGuidance, power }: SystemSectionsProps) {
  if (!device && !voiceGuidance && !power) return <PlaceholderSection title="Headphones" />;
  return (
    <CardGrid>
      <CardStack>
        {device ? (
          <LabelledSection title="Device">
            <DeviceSettingsCard {...device} />
          </LabelledSection>
        ) : null}
      </CardStack>
      <CardStack>
        {voiceGuidance ? (
          <LabelledSection title="Notification & voice guide">
            <GroupedList aria-label="Notification and voice guide">
              <VoiceGuidanceRow {...voiceGuidance} />
            </GroupedList>
          </LabelledSection>
        ) : null}
        {power ? (
          <LabelledSection title="Power">
            <PowerOffRow {...power} />
          </LabelledSection>
        ) : null}
        <PhoneOnlyNote features={SYSTEM_PHONE_ONLY} />
      </CardStack>
    </CardGrid>
  );
}
