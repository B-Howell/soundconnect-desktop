import type { ChangeResult } from "../../lib/winaudio/types";
import { Card } from "../primitives/Card";
import { InfoNote } from "../primitives/InfoNote";
import { TextButton } from "../primitives/TextButton";
import "./ApplyResultNote.css";

export interface ApplyResultNoteProps {
  results: ChangeResult[] | null;
  error: string | null;
  onDismiss: () => void;
}

/** One line per change that did not take (with Windows' reason), or a short "done". */
export function resultLines(results: readonly ChangeResult[]): string[] {
  const failed = results.filter((r) => !r.verified);
  if (failed.length === 0) {
    return [`${results.length} ${results.length === 1 ? "change" : "changes"} applied and checked.`];
  }
  return failed.map((r) => `Not changed: ${describe(r)}${r.error ? ` (${r.error})` : ""}`);
}

function describe(r: ChangeResult): string {
  const c = r.change;
  switch (c.kind) {
    case "setDefaultEndpoint":
      return c.name;
    case "useHandsFreeForCommunications":
      return "hands-free audio for voice chat";
    case "setEnhancements":
      return "audio enhancements";
    case "setFormat":
      return "format";
    case "setExclusiveMode":
      return "exclusive mode";
    case "setDucking":
      return "lowering sounds during calls";
    case "setMonoAudio":
      return "mono mix";
    case "setHandsFree":
      return "hands-free profile";
    case "setAbsoluteVolumeDisabled":
      return "absolute volume";
    case "setAdapterPowerSaving":
      return "adapter power saving";
  }
}

/** The outcome of the last apply, as a polite live region with a Dismiss action. */
export function ApplyResultNote({ results, error, onDismiss }: ApplyResultNoteProps) {
  if (!error && (!results || results.length === 0)) return null;
  const lines = error ? [error] : resultLines(results ?? []);
  const failed = !!error || (results ?? []).some((r) => !r.verified);
  return (
    <Card inset>
      <div className="apply-result" role="status">
        <div className="apply-result__lines">
          {lines.map((line) => (
            <InfoNote key={line} icon={failed ? "info" : "check"}>
              {line}
            </InfoNote>
          ))}
        </div>
        <TextButton onPress={onDismiss}>Dismiss</TextButton>
      </div>
    </Card>
  );
}
