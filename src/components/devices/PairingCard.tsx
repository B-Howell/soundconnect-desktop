import { Icon } from "../icons/Icon";
import { GroupedList } from "../primitives/GroupedList";
import { ListRow } from "../primitives/ListRow";
import { SectionFooter } from "../primitives/SectionFooter";

export interface PairingCardProps {
  /** The headphones are in pairing mode now. */
  pairing: boolean;
  /** The headphones' name as a new device will list it. */
  deviceName: string;
  onPairingChange: (enabled: boolean) => void;
  disabled?: boolean;
}

/**
 * Sony's "Pair a new device": one row that puts the headphones in pairing
 * mode (and, while they are in it, stops it), with a footer saying what
 * happens next.
 */
export function PairingCard({ pairing, deviceName, onPairingChange, disabled }: PairingCardProps) {
  return (
    <>
      <GroupedList aria-label="Pairing">
        {pairing ? (
          <ListRow
            title="Stop pairing mode"
            subtitle="Pairing mode is on"
            leading={<Icon name="bluetooth" />}
            onPress={() => onPairingChange(false)}
            disabled={disabled}
          />
        ) : (
          <ListRow
            title="Pair a new device"
            leading={<Icon name="plus" />}
            onPress={() => onPairingChange(true)}
            disabled={disabled}
          />
        )}
      </GroupedList>
      <SectionFooter>
        <p>
          Select {deviceName} in the other device&apos;s Bluetooth settings.
        </p>
      </SectionFooter>
    </>
  );
}
