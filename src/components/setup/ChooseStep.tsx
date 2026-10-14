import { failureText } from "../../lib/devices/connectFailureText";
import type { ConnectAttempt } from "../../lib/engine/connectAttempt";
import type { ScanState } from "../../state/engineStore";
import { SheetButton } from "../primitives/SheetButton";
import { ConnectFailureNote } from "./ConnectFailureNote";
import { DeviceChoiceList } from "./DeviceChoiceList";
import { SetupCard } from "./SetupCard";
import { StepNavigation } from "./StepNavigation";
import "./ChooseStep.css";

export interface ChooseStepProps {
  index: number;
  count: number;
  scan: ScanState;
  attempt: ConnectAttempt | null;
  onScan: () => void;
  onSelect: (address: string) => void;
  onOpenBluetoothSettings: () => void;
  onBack?: () => void;
  onCancel?: () => void;
}

/** The scan's progress in one sentence, read politely; null once devices are listed. */
function scanMessage(scan: ScanState): string | null {
  const empty = scan.phase === "idle" || scan.devices.length === 0;
  switch (scan.phase) {
    case "idle":
      return "Select Scan to list the Bluetooth devices Windows is connected to.";
    case "scanning":
      return empty ? "Looking for Bluetooth devices…" : null;
    case "done":
      return empty
        ? "Windows isn't connected to any Bluetooth devices. Connect your headphones in Bluetooth settings, then scan again."
        : null;
    case "failed":
      return `The scan didn't finish (${scan.message}). Try scanning again.`;
  }
}

/**
 * Setup step 3: scan, pick the headphones, connect. Selecting a device sends
 * `connect {address}`; its row says "Connecting…" meanwhile, a failure shows
 * the advice for the engine's reason with Try again, and success moves on
 * (`useSetupWizard`).
 */
export function ChooseStep({
  index,
  count,
  scan,
  attempt,
  onScan,
  onSelect,
  onOpenBluetoothSettings,
  onBack,
  onCancel,
}: ChooseStepProps) {
  const devices = scan.phase === "idle" ? [] : scan.devices;
  const connecting = attempt?.phase === "connecting" ? attempt.address : undefined;
  const message = scanMessage(scan);
  const nothingFound = scan.phase === "done" && devices.length === 0;
  const failure = attempt?.phase === "failed" ? attempt : null;

  return (
    <SetupCard
      index={index}
      count={count}
      title="Choose your headphones"
      lead="Switch your headphones on, then scan and select them."
      primary={
        // Not disabled while scanning: that would drop focus to the page; `startScan` ignores a second press.
        <SheetButton onPress={onScan}>
          {scan.phase === "scanning" ? "Scanning…" : scan.phase === "idle" ? "Scan" : "Scan again"}
        </SheetButton>
      }
      secondary={<StepNavigation onBack={onBack} onCancel={onCancel} />}
    >
      <p className={message ? "choose-step__message" : "sr-only"} role="status">
        {message ?? `${devices.length} ${devices.length === 1 ? "device" : "devices"} found.`}
      </p>
      {devices.length > 0 ? (
        <DeviceChoiceList devices={devices} connectingAddress={connecting} onSelect={onSelect} />
      ) : null}
      {failure ? (
        <ConnectFailureNote text={failureText(failure.reason)} onRetry={() => onSelect(failure.address)} />
      ) : null}
      {nothingFound || failure?.reason === "notConnectedToWindows" ? (
        <SheetButton variant="secondary" onPress={onOpenBluetoothSettings}>
          Open Windows Bluetooth settings
        </SheetButton>
      ) : null}
    </SetupCard>
  );
}
