import { GroupedList } from "../primitives/GroupedList";
import { ListRow } from "../primitives/ListRow";
import { DeviceImage } from "../device-art/DeviceImage";
import { SheetButton } from "../primitives/SheetButton";
import { SetupCard } from "./SetupCard";

/** Side of the product photo on the last step, px. */
export const SETUP_IMAGE_SIZE = 160;

export interface DoneStepProps {
  index: number;
  count: number;
  /** The device's model name ("WH-1000XM4"). */
  modelName: string;
  /** Firmware version, when the device reported one. */
  firmware?: string;
  onDone: () => void;
}

/** Setup step 4: the connected headphones, their picture, model and firmware, and Done. */
export function DoneStep({ index, count, modelName, firmware, onDone }: DoneStepProps) {
  return (
    <SetupCard
      index={index}
      count={count}
      visual={<DeviceImage model={modelName} size={SETUP_IMAGE_SIZE} />}
      title="Setup complete"
      primary={<SheetButton onPress={onDone}>Done</SheetButton>}
    >
      <GroupedList aria-label="Headphones">
        <ListRow title="Model" trailing={modelName} />
        {firmware ? <ListRow title="Firmware" trailing={firmware} /> : null}
      </GroupedList>
    </SetupCard>
  );
}
