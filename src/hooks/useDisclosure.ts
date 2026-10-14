import { useCallback, useId, useState } from "react";

export interface Disclosure {
  open: boolean;
  toggle: () => void;
  /** Spread on the toggle button. */
  buttonProps: { "aria-expanded": boolean; "aria-controls": string; onClick: () => void };
  /** Spread on the region the button shows and hides. */
  panelProps: { id: string; hidden: boolean };
}

/** Open / closed state plus the ARIA wiring for a button that shows and hides a region. */
export function useDisclosure(initiallyOpen = false): Disclosure {
  const [open, setOpen] = useState(initiallyOpen);
  const panelId = useId();
  const toggle = useCallback(() => setOpen((current) => !current), []);
  return {
    open,
    toggle,
    buttonProps: { "aria-expanded": open, "aria-controls": panelId, onClick: toggle },
    panelProps: { id: panelId, hidden: !open },
  };
}
