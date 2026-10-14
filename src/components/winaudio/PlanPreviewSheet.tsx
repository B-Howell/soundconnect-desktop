import { useRef } from "react";
import { MODE_LABELS } from "../../lib/winaudio/rows";
import type { FixKind, Plan } from "../../lib/winaudio/types";
import { InfoNote } from "../primitives/InfoNote";
import { Sheet } from "../primitives/Sheet";
import { SheetActions } from "../primitives/SheetActions";
import { SheetButton } from "../primitives/SheetButton";
import { AdminShield } from "./AdminShield";
import "./PlanPreviewSheet.css";

export interface PlanPreviewSheetProps {
  /** The mode being previewed; null closes the sheet. */
  kind: FixKind | null;
  /** null while the app builds the plan. */
  plan: Plan | null;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/** The prompt line shown when the plan holds admin changes. */
export const ADMIN_PROMPT_NOTE = "Windows will ask for permission once for the items marked with a shield.";

/**
 * Lists exactly what switching to a mode will change before anything changes, marks admin
 * items and says a Windows prompt will appear for them, and shows the plan's
 * notes (what the app will not change). Apply is focused last: Cancel first.
 */
export function PlanPreviewSheet({ kind, plan, error, onConfirm, onClose }: PlanPreviewSheetProps) {
  const cancel = useRef<HTMLButtonElement>(null);
  const empty = plan !== null && plan.changes.length === 0;
  const admin = plan?.changes.some((c) => c.admin) ?? false;
  return (
    <Sheet
      open={kind !== null}
      onClose={onClose}
      title={kind ? `Switch to ${MODE_LABELS[kind]}` : ""}
      message={
        error ? error : plan === null ? "Reading Windows settings…" : empty ? "Nothing to change." : "These will change:"
      }
      initialFocus={cancel}
    >
      {plan && !empty ? (
        <ul className="plan-preview__list" aria-label="Changes">
          {plan.changes.map((c, i) => (
            <li key={`${c.change.kind}-${i}`} className="plan-preview__item">
              {c.summary}
              {c.admin ? <AdminShield /> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {admin ? <InfoNote>{ADMIN_PROMPT_NOTE}</InfoNote> : null}
      {plan?.notes.map((note) => (
        <InfoNote key={note}>{note}</InfoNote>
      ))}
      <SheetActions>
        {plan && !empty ? <SheetButton onPress={onConfirm}>Apply</SheetButton> : null}
        <SheetButton variant="secondary" onPress={onClose} ref={cancel}>
          {plan && !empty ? "Cancel" : "Close"}
        </SheetButton>
      </SheetActions>
    </Sheet>
  );
}
