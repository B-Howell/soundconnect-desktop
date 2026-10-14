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

/**
 * The scan's result in a few words, read politely: null before the first
 * scan, while scanning (the button says "Scanning…") and once devices are
 * listed.
 */
function scanMessage(scan: ScanState): string | null {
  switch (scan.phase) {
    case "idle":
    case "scanning":
      return null;
    case "done":
      return scan.devices.length === 0 ? "No Bluetooth devices found." : null;
    case "failed":
      return "Scan failed.";
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
      title="Choose headphones"
      primary={
        // Not disabled while scanning: that would drop focus to the page; `startScan` ignores a second press.
        <SheetButton onPress={onScan}>
          {scan.phase === "scanning" ? "Scanning…" : scan.phase === "idle" ? "Scan" : "Scan again"}
        </SheetButton>
      }
      secondary={<StepNavigation onBack={onBack} onCancel={onCancel} />}
    >
      <p className={message ? "choose-step__message" : "sr-only"} role="status">
        {message ?? (scan.phase === "idle" ? "" : `${devices.length} ${devices.length === 1 ? "device" : "devices"} found.`)}
      </p>
      {devices.length > 0 ? (
        <DeviceChoiceList devices={devices} connectingAddress={connecting} onSelect={onSelect} />
      ) : null}
      {failure ? (
        <ConnectFailureNote text={failureText(failure.reason) || "Connection failed."} onRetry={() => onSelect(failure.address)} />
      ) : null}
      {nothingFound || failure?.reason === "notConnectedToWindows" ? (
        <SheetButton variant="secondary" onPress={onOpenBluetoothSettings}>
          Bluetooth settings
        </SheetButton>
      ) : null}
    </SetupCard>
  );
}
