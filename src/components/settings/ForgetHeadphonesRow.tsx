import { useRef } from "react";
import { useSheet } from "../../hooks/useSheet";
import { ListRow } from "../primitives/ListRow";
import { Sheet } from "../primitives/Sheet";
import { SheetActions } from "../primitives/SheetActions";
import { SheetButton } from "../primitives/SheetButton";
import "./ForgetHeadphonesRow.css";

export interface ForgetHeadphonesRowProps {
  /** The remembered headphones' name. */
  name: string;
  /** Called only after the user confirms in the sheet. */
  onConfirm: () => void;
}

/**
 * "Forget these headphones", confirmed in a sheet that opens with focus on
 * Cancel. Forgetting drops the remembered profile (`forgetDevice`); the
 * headphones stay paired with Windows, which the sheet says, and the app
 * returns to setup.
 */
export function ForgetHeadphonesRow({ name, onConfirm }: ForgetHeadphonesRowProps) {
  const sheet = useSheet();
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <>
      <ListRow
        title={<span className="forget-row__title">Forget these headphones</span>}
        subtitle={name}
        onPress={sheet.show}
      />
      <Sheet
        open={sheet.open}
        onClose={sheet.hide}
        title={`Forget ${name}?`}
        message="They stay paired with Windows."
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
            Forget
          </SheetButton>
          <SheetButton variant="secondary" onPress={sheet.hide} ref={cancel}>
            Cancel
          </SheetButton>
        </SheetActions>
      </Sheet>
    </>
  );
}
