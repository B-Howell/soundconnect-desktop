import { useRef } from "react";
import { useSheet } from "../../hooks/useSheet";
import { Sheet } from "../primitives/Sheet";
import { SheetActions } from "../primitives/SheetActions";
import { SheetButton } from "../primitives/SheetButton";

export interface PowerOffRowProps {
  /** Model name for the confirmation, for example "WH-1000XM4". */
  deviceName: string;
  /** Called only after the user confirms in the sheet. */
  onConfirm: () => void;
  /** Disables the button and closes an open confirmation (for example on disconnect). */
  disabled?: boolean;
}

/**
 * The destructive "Power off" button, confirmed in a sheet. It stands on the
 * page under its section header rather than inside a card: a tinted
 * full-width button inside a padded card read as a box in a box. The sheet opens
 * with focus on Cancel, so Enter right after opening does not switch the
 * headphones off.
 */
export function PowerOffRow({ deviceName, onConfirm, disabled }: PowerOffRowProps) {
  const sheet = useSheet(disabled);
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <>
      <SheetButton variant="destructive" onPress={sheet.show} disabled={disabled}>
        Power off
      </SheetButton>
      <Sheet
        open={sheet.open}
        onClose={sheet.hide}
        title={`Power off ${deviceName}?`}
        message="Turn them on again with their power button."
        initialFocus={cancel}
      >
        <SheetActions>
          <SheetButton
            variant="destructive"
            onPress={() => {
              sheet.hide();
              onConfirm();
            }}
          >
            Power off
          </SheetButton>
          <SheetButton variant="secondary" onPress={sheet.hide} ref={cancel}>
            Cancel
          </SheetButton>
        </SheetActions>
      </Sheet>
    </>
  );
}
