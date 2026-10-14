import { useRef } from "react";
import { Sheet } from "../primitives/Sheet";
import { SheetActions } from "../primitives/SheetActions";
import { SheetButton } from "../primitives/SheetButton";

export interface RestoreSheetProps {
  open: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Confirms "Restore": puts back the Windows settings saved before the first fix. Cancel is focused. */
export function RestoreSheet({ open, onConfirm, onClose }: RestoreSheetProps) {
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Restore Windows settings?"
      message="Puts back what these settings were before SoundConnect first changed them. Windows may ask for permission for Hands-Free, absolute volume or the adapter."
      initialFocus={cancel}
    >
      <SheetActions>
        <SheetButton
          variant="destructive"
          onPress={() => {
            onClose();
            onConfirm();
          }}
        >
          Restore
        </SheetButton>
        <SheetButton variant="secondary" onPress={onClose} ref={cancel}>
          Cancel
        </SheetButton>
      </SheetActions>
    </Sheet>
  );
}
