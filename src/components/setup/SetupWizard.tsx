import { useDeviceHeaderProps } from "../../hooks/engine/useDeviceHeaderProps";
import { useConnectAttempt } from "../../hooks/setup/useConnectAttempt";
import { useDeviceScan } from "../../hooks/setup/useDeviceScan";
import { useOpenBluetoothSettings } from "../../hooks/setup/useOpenBluetoothSettings";
import { usePairingFamily } from "../../hooks/setup/usePairingFamily";
import { useRememberedDevice } from "../../hooks/setup/useRememberedDevice";
import { rememberedTitle } from "../../lib/devices/deviceTitle";
import { useSetupWizard } from "../../hooks/setup/useSetupWizard";
import { SETUP_STEPS, type SetupStep } from "../../state/setupStore";
import { ChooseStep } from "./ChooseStep";
import { DoneStep } from "./DoneStep";
import { PairStep } from "./PairStep";
import { WelcomeStep } from "./WelcomeStep";

export interface SetupWizardProps {
  /** The step to show; a prop, not read from the store here, so the card fading out between steps keeps its step. */
  step: SetupStep;
}

/**
 * The first-run setup, as Sony's phone app does it for new headphones:
 * Welcome, Pair with Windows, Choose headphones, Setup complete. A container:
 * the hooks hold the scan, the connect attempt and the navigation; the steps
 * are presentational.
 */
export function SetupWizard({ step }: SetupWizardProps) {
  const wizard = useSetupWizard();
  const { scan, start: startScan } = useDeviceScan();
  const { attempt, connect } = useConnectAttempt();
  const openBluetoothSettings = useOpenBluetoothSettings();
  const [family, setFamily] = usePairingFamily();
  const header = useDeviceHeaderProps();
  const remembered = useRememberedDevice();
  const { count, cancel } = wizard;
  const index = SETUP_STEPS.indexOf(step);

  switch (step) {
    case "welcome":
      return <WelcomeStep index={index} count={count} onStart={wizard.next} onCancel={cancel} />;
    case "pair":
      return (
        <PairStep
          index={index}
          count={count}
          family={family}
          onFamilyChange={setFamily}
          onOpenBluetoothSettings={openBluetoothSettings}
          onContinue={wizard.next}
          onBack={wizard.back}
          onCancel={cancel}
        />
      );
    case "choose":
      return (
        <ChooseStep
          index={index}
          count={count}
          scan={scan}
          attempt={attempt}
          onScan={startScan}
          onSelect={connect}
          onOpenBluetoothSettings={openBluetoothSettings}
          onBack={wizard.back}
          onCancel={cancel}
        />
      );
    case "done":
      return (
        <DoneStep
          index={index}
          count={count}
          modelName={header?.name || rememberedTitle(remembered) || "Headphones"}
          firmware={header?.firmware || remembered?.firmware || undefined}
          onDone={wizard.finish}
        />
      );
  }
}
