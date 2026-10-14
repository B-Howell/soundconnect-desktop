import { CardGrid, CardStack } from "../components/page/CardGrid";
import { LabelledSection } from "../components/page/LabelledSection";
import { GroupedList } from "../components/primitives/GroupedList";
import { AboutCard } from "../components/settings/AboutCard";
import { HeadphonesRows } from "../components/settings/HeadphonesRows";
import { StartupRows } from "../components/settings/StartupRows";
import { ThemePicker } from "../components/settings/ThemePicker";
import { UpdateRows } from "../components/settings/UpdateRows";

/** Settings: the app's own preferences (Headphones, Appearance, Startup) beside Updates and About. Composition only. */
export function SettingsPage() {
  return (
    <CardGrid>
      <CardStack>
        <LabelledSection title="Headphones">
          <GroupedList aria-label="Headphones">
            <HeadphonesRows />
          </GroupedList>
        </LabelledSection>
        <LabelledSection title="Appearance">
          <GroupedList aria-label="Appearance">
            <ThemePicker />
          </GroupedList>
        </LabelledSection>
        <LabelledSection title="Startup">
          <GroupedList aria-label="Startup">
            <StartupRows />
          </GroupedList>
        </LabelledSection>
      </CardStack>
      <CardStack>
        <LabelledSection title="Updates">
          <GroupedList aria-label="Updates">
            <UpdateRows />
          </GroupedList>
        </LabelledSection>
        <LabelledSection title="About">
          <AboutCard />
        </LabelledSection>
      </CardStack>
    </CardGrid>
  );
}
