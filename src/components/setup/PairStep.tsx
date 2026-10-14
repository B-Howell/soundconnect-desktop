import type { DeviceFamily } from "../../lib/devices/pairingInstructions";
import { SheetButton } from "../primitives/SheetButton";
import { PairingSteps } from "./PairingSteps";
import { SetupCard } from "./SetupCard";
import { StepNavigation } from "./StepNavigation";

export interface PairStepProps {
  index: number;
  count: number;
  family: DeviceFamily;
  onFamilyChange: (family: DeviceFamily) => void;
  onOpenBluetoothSettings: () => void;
  onContinue: () => void;
  onBack?: () => void;
  onCancel?: () => void;
}

/**
 * Setup step 2: pair the headphones with Windows. The app cannot pair a
 * device itself, so it shows how to enter pairing mode and opens the Windows
 * Bluetooth page; headphones Windows already knows can skip ahead.
 */
export function PairStep({
  index,
  count,
  family,
  onFamilyChange,
  onOpenBluetoothSettings,
  onContinue,
  onBack,
  onCancel,
}: PairStepProps) {
  return (
    <SetupCard
      index={index}
      count={count}
      title="Pair with Windows"
      lead="Already paired? Select Continue."
      primary={<SheetButton onPress={onContinue}>Continue</SheetButton>}
      secondary={<StepNavigation onBack={onBack} onCancel={onCancel} />}
    >
      <PairingSteps family={family} onFamilyChange={onFamilyChange} />
      <SheetButton variant="secondary" onPress={onOpenBluetoothSettings}>
        Bluetooth settings
      </SheetButton>
    </SetupCard>
  );
}
