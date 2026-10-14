import { useSetupStore } from "../../state/setupStore";
import { AppFrame } from "../frame/AppFrame";
import { SetupWizard } from "./SetupWizard";

/**
 * The window during setup: the frame without the navigation rail (nothing
 * else is usable yet), the wordmark in the title bar, and the wizard's card
 * centred, cross-fading between steps.
 */
export function SetupScreen() {
  const step = useSetupStore((state) => state.step);
  return (
    <AppFrame wordmark="SoundConnect" pageKey={`setup-${step}`}>
      <SetupWizard step={step} />
    </AppFrame>
  );
}
