import { useRef } from "react";
import { Sheet } from "../primitives/Sheet";
import { SheetActions } from "../primitives/SheetActions";
import { SheetButton } from "../primitives/SheetButton";

export interface RestoreSheetProps {
  open: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Confirms "Restore": puts back the Windows settings saved before the first change. Cancel is focused. */
export function RestoreSheet({ open, onConfirm, onClose }: RestoreSheetProps) {
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Restore Windows settings?"
      message="Restores the settings from before the first change. Windows may ask for permission."
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
