import { EqualizerEntryCard, type EqualizerEntryCardProps } from "../equalizer/EqualizerEntryCard";
import { NoiseControlEntryCard, type NoiseControlEntryCardProps } from "../noise/NoiseControlEntryCard";
import { CardGrid, CardStack } from "../page/CardGrid";
import { LabelledSection } from "../page/LabelledSection";
import { PlaceholderSection } from "../page/PlaceholderSection";
import { ConnectionQualityCard, type ConnectionQualityCardProps } from "./ConnectionQualityCard";
import { SpeakToChatCard, type SpeakToChatCardProps } from "./SpeakToChatCard";

export interface SoundOverviewProps {
  equalizer?: EqualizerEntryCardProps;
  noise?: NoiseControlEntryCardProps;
  connectionQuality?: ConnectionQualityCardProps;
  speakToChat?: SpeakToChatCardProps;
}

/**
 * The Sound page: the overview of Sound and its two sub-pages. First row, the
 * entry cards into Equalizer and Noise control (each showing its current
 * state); second row, Bluetooth connection quality beside Speak-to-Chat.
 * Each card is its own grid cell, so the grid fills left to right and a
 * missing card never leaves a gap or strands its neighbour on the right.
 * Presentational; `SoundPage` feeds it engine state.
 */
export function SoundOverview({ equalizer, noise, connectionQuality, speakToChat }: SoundOverviewProps) {
  if (!equalizer && !noise && !connectionQuality && !speakToChat) return <PlaceholderSection title="Sound" />;
  return (
    <CardGrid>
      <CardStack>
        {equalizer ? (
          <LabelledSection title="Equalizer">
            <EqualizerEntryCard {...equalizer} />
          </LabelledSection>
        ) : null}
      </CardStack>
      <CardStack>
        {noise ? (
          <LabelledSection title="Noise control">
            <NoiseControlEntryCard {...noise} />
          </LabelledSection>
        ) : null}
      </CardStack>
      <CardStack>
        {connectionQuality ? (
          <LabelledSection title="Bluetooth connection quality">
            <ConnectionQualityCard {...connectionQuality} />
          </LabelledSection>
        ) : null}
      </CardStack>
      <CardStack>
        {speakToChat ? (
          <LabelledSection title="Speak-to-Chat">
            <SpeakToChatCard {...speakToChat} />
          </LabelledSection>
        ) : null}
      </CardStack>
    </CardGrid>
  );
}
