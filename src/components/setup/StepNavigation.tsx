import { TextButton } from "../primitives/TextButton";

export interface StepNavigationProps {
  /** Back to the previous step; left out on the first. */
  onBack?: () => void;
  /** Leave setup for the app; only offered while headphones are remembered. */
  onCancel?: () => void;
}

/** The setup card's quiet text actions under the primary button: Back and Cancel. */
export function StepNavigation({ onBack, onCancel }: StepNavigationProps) {
  if (!onBack && !onCancel) return null;
  return (
    <>
      {onBack ? <TextButton onPress={onBack}>Back</TextButton> : null}
      {onCancel ? <TextButton onPress={onCancel}>Cancel</TextButton> : null}
    </>
  );
}
