import { NoiseModeSegment, type NoiseModeSegmentProps } from "../noise/NoiseModeSegment";
import { CardGrid, CardStack } from "../page/CardGrid";
import { LabelledSection } from "../page/LabelledSection";
import { NowPlayingCard, type NowPlayingCardProps } from "../playback/NowPlayingCard";
import { Card } from "../primitives/Card";
import { DeviceHeader, type DeviceHeaderProps } from "../shell/DeviceHeader";

export interface StatusSectionsProps {
  /** The connected device's header values. */
  device: DeviceHeaderProps;
  /** The quick noise switch; left out when the device has no noise control. */
  noise?: NoiseModeSegmentProps;
  /** Now playing card values and callbacks; left out without them. */
  playback?: NowPlayingCardProps;
}

/**
 * The Status page once a device is connected: the device card across both
 * columns (large art, name, battery, codec, firmware), then the quick noise
 * switch and Now playing side by side. Presentational; `StatusPage` maps
 * engine state to these props and the gallery renders it with demo values.
 */
export function StatusSections({ device, noise, playback }: StatusSectionsProps) {
  return (
    <CardGrid>
      <CardStack span="full">
        <DeviceHeader {...device} />
      </CardStack>
      {noise ? (
        <CardStack>
          <LabelledSection title="Noise control">
            <Card inset>
              <NoiseModeSegment {...noise} />
            </Card>
          </LabelledSection>
        </CardStack>
      ) : null}
      {playback ? (
        <CardStack>
          <LabelledSection title="Now playing">
            <NowPlayingCard {...playback} />
          </LabelledSection>
        </CardStack>
      ) : null}
    </CardGrid>
  );
}
