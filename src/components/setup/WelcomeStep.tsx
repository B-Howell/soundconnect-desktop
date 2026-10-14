import { SheetButton } from "../primitives/SheetButton";
import { SONY_DISCLAIMER } from "../settings/AboutCard";
import { SetupCard } from "./SetupCard";
import { StepNavigation } from "./StepNavigation";
import "./WelcomeStep.css";

export interface WelcomeStepProps {
  index: number;
  count: number;
  onStart: () => void;
  onCancel?: () => void;
}

/** Setup step 1: what the app does, and that it is not Sony's. */
export function WelcomeStep({ index, count, onStart, onCancel }: WelcomeStepProps) {
  return (
    <SetupCard
      index={index}
      count={count}
      visual={<img className="welcome-step__icon" src="/icon.png" alt="" />}
      title="Welcome to SoundConnect"
      lead="Control Sony headphones from your PC."
      primary={<SheetButton onPress={onStart}>Get started</SheetButton>}
      secondary={<StepNavigation onCancel={onCancel} />}
    >
      <p className="welcome-step__note">{SONY_DISCLAIMER}</p>
    </SetupCard>
  );
}
