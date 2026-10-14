import { useRef } from "react";
import { releasePageUrl } from "../../lib/updater/api";
import { Sheet } from "../primitives/Sheet";
import { SheetActions } from "../primitives/SheetActions";
import { SheetButton } from "../primitives/SheetButton";
import "./UpdateNotesSheet.css";

export interface UpdateNotesSheetProps {
  open: boolean;
  version: string;
  /** `notes` from `latest.json`; the release page's address is shown when empty. */
  notes?: string;
  onClose: () => void;
}

/** "What's new in X": the release notes the update carries, and where the full release page is. */
export function UpdateNotesSheet({ open, version, notes, onClose }: UpdateNotesSheetProps) {
  const close = useRef<HTMLButtonElement>(null);
  return (
    <Sheet open={open} onClose={onClose} title={`What's new in ${version}`} initialFocus={close}>
      <div className="update-notes">
        {notes?.trim() ? <p className="update-notes__text">{notes.trim()}</p> : null}
        <p className="update-notes__link">Release page: {releasePageUrl(version)}</p>
      </div>
      <SheetActions>
        <SheetButton variant="secondary" onPress={onClose} ref={close}>
          Close
        </SheetButton>
      </SheetActions>
    </Sheet>
  );
}
