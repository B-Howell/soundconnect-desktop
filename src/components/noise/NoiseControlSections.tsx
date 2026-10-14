import { CardGrid, CardStack } from "../page/CardGrid";
import { LabelledSection } from "../page/LabelledSection";
import { PhoneOnlyNote } from "../page/PhoneOnlyNote";
import { PlaceholderSection } from "../page/PlaceholderSection";
import { AssignableControlsCard, type AssignableControlsCardProps } from "../system/AssignableControlsCard";
import { AmbientSoundControlCard, type AmbientSoundControlCardProps } from "./AmbientSoundControlCard";

export interface NoiseControlSectionsProps {
  ambient?: AmbientSoundControlCardProps;
  /** The function of the headphones' assignable button (the XM4's CUSTOM button, NC/AMB on others). */
  button?: AssignableControlsCardProps;
}

/** What Sony's app has on its noise screen that only a phone can do. */
export const NOISE_PHONE_ONLY = ["Adaptive Sound Control (switches by place and activity)"] as const;

/**
 * The Noise control page's content: Ambient Sound Control (switch, slider,
 * Focus on voice) in the first column; the NC/AMB button's function and the
 * phone-only footnote in the second. Presentational; `NoiseControlPage` feeds
 * it engine state.
 */
export function NoiseControlSections({ ambient, button }: NoiseControlSectionsProps) {
  const showButton = button !== undefined && button.controls.length > 0;
  if (!ambient && !showButton) return <PlaceholderSection title="Ambient sound control" />;
  return (
    <CardGrid>
      <CardStack>
        {ambient ? (
          <LabelledSection title="Ambient sound control">
            <AmbientSoundControlCard {...ambient} />
          </LabelledSection>
        ) : null}
      </CardStack>
      <CardStack>
        {button && showButton ? (
          <LabelledSection title="Button function">
            <AssignableControlsCard {...button} />
          </LabelledSection>
        ) : null}
        <PhoneOnlyNote features={NOISE_PHONE_ONLY} />
      </CardStack>
    </CardGrid>
  );
}
