import { Icon } from "../icons/Icon";
import { ListRow } from "../primitives/ListRow";

export interface SetUpHeadphonesRowProps {
  /** Opens the setup wizard. */
  onPress: () => void;
}

/** "Set up new headphones": reopens the setup wizard, for a second pair or a replacement. */
export function SetUpHeadphonesRow({ onPress }: SetUpHeadphonesRowProps) {
  return (
    <ListRow
      leading={<Icon name="plus" />}
      title="Set up new headphones"
      subtitle="Pair and connect another pair, as on first use."
      disclosure
      onPress={onPress}
    />
  );
}
