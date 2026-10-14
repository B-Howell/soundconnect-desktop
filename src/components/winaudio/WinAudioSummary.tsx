import { Card } from "../primitives/Card";
import { Pill } from "../primitives/Pill";
import { SheetButton } from "../primitives/SheetButton";
import { TextButton } from "../primitives/TextButton";
import "./WinAudioSummary.css";

export interface WinAudioSummaryProps {
  /** Rows that differ from the music recommendation. */
  attention: number;
  /** The headphones Windows plays to, for the sentence ("Headphones (WH-1000XM4)"). */
  deviceName: string;
  onFixMusic: () => void;
  onFixCalls: () => void;
  /** Present when a restore point exists. */
  onRestore?: () => void;
  onForgetRestorePoint?: () => void;
  busy?: boolean;
}

/**
 * The page's top card: "Set up for music" or "Needs attention (n)", and the
 * two fixes plus Restore. Each fix opens a preview first (the page owns it).
 */
export function WinAudioSummary({
  attention,
  deviceName,
  onFixMusic,
  onFixCalls,
  onRestore,
  onForgetRestorePoint,
  busy = false,
}: WinAudioSummaryProps) {
  return (
    <Card inset>
      <div className="winaudio-summary">
        <div className="winaudio-summary__status" role="status">
          {attention === 0 ? (
            <Pill tone="success">Set up for music</Pill>
          ) : (
            <Pill tone="warning">Needs attention ({attention})</Pill>
          )}
          <p className="winaudio-summary__text">
            How Windows handles the sound on its way to {deviceName}.
            {busy ? " Applying…" : ""}
          </p>
        </div>
        <div className="winaudio-summary__actions">
          <SheetButton onPress={onFixMusic} disabled={busy}>
            Fix for music
          </SheetButton>
          <SheetButton variant="secondary" onPress={onFixCalls} disabled={busy}>
            Fix for calls
          </SheetButton>
        </div>
        {onRestore ? (
          <div className="winaudio-summary__restore">
            <TextButton onPress={onRestore} disabled={busy}>
              Restore
            </TextButton>
            {onForgetRestorePoint ? (
              <TextButton onPress={onForgetRestorePoint} disabled={busy}>
                Forget restore point
              </TextButton>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
