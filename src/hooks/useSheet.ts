import { useCallback, useEffect, useState } from "react";

export interface SheetState {
  open: boolean;
  /** Opens the sheet (from the control that should get focus back on close). */
  show: () => void;
  /** Closes the sheet; pass as the `Sheet`'s `onClose`. */
  hide: () => void;
}

/**
 * Open / closed state for one `Sheet`, with stable `show` and `hide`. While
 * `disabled` is true the sheet cannot open, and an open sheet closes, so a
 * sheet left open when the device disconnects cannot send a pick or a
 * confirmation afterwards.
 */
export function useSheet(disabled = false): SheetState {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => {
    if (!disabled) setOpen(true);
  }, [disabled]);
  const hide = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  return { open: open && !disabled, show, hide };
}
