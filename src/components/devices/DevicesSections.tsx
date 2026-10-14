import { CardGrid, CardStack } from "../page/CardGrid";
import { LabelledSection } from "../page/LabelledSection";
import { PlaceholderSection } from "../page/PlaceholderSection";
import { MultipointCard, type MultipointCardProps } from "./MultipointCard";
import { PairedDeviceList, type PairedDeviceListProps } from "./PairedDeviceList";
import { PairingCard, type PairingCardProps } from "./PairingCard";

export interface DevicesSectionsProps {
  multipoint?: MultipointCardProps;
  paired?: PairedDeviceListProps;
  pairing?: PairingCardProps;
}

/**
 * The Devices page's content, Sony's connection screens: "Connect to 2
 * devices simultaneously" and the paired devices with their actions in the
 * first column, "Pair a new device" in the second. Presentational;
 * `DevicesPage` feeds it engine state.
 */
export function DevicesSections({ multipoint, paired, pairing }: DevicesSectionsProps) {
  if (!multipoint && !paired && !pairing) return <PlaceholderSection title="Paired devices" />;
  return (
    <CardGrid>
      <CardStack>
        {multipoint ? (
          <LabelledSection title="Multipoint">
            <MultipointCard {...multipoint} />
          </LabelledSection>
        ) : null}
        {paired ? (
          <LabelledSection title="Paired devices">
            <PairedDeviceList {...paired} />
          </LabelledSection>
        ) : null}
      </CardStack>
      <CardStack>
        {pairing ? (
          <LabelledSection title="New device">
            <PairingCard {...pairing} />
          </LabelledSection>
        ) : null}
      </CardStack>
    </CardGrid>
  );
}
