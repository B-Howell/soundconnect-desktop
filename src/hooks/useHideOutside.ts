import { useEffect, type RefObject } from "react";

/**
 * While `active`, hides every other child of `document.body` from assistive
 * technology (`aria-hidden="true"`), so a screen reader's virtual cursor stays
 * in a modal layer portalled into the body. `aria-hidden` rather than `inert`:
 * the title bar keeps working with the pointer (window drag and caption
 * buttons), while the dialog's focus trap keeps the keyboard inside.
 * Attributes the siblings already had are restored on deactivation.
 */
export function useHideOutside(layer: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    const own = layer.current;
    if (!active || !own) return;
    const hidden: Element[] = [];
    for (const child of Array.from(document.body.children)) {
      if (child === own || child.contains(own) || child.getAttribute("aria-hidden") === "true") continue;
      child.setAttribute("aria-hidden", "true");
      hidden.push(child);
    }
    return () => {
      for (const child of hidden) child.removeAttribute("aria-hidden");
    };
  }, [layer, active]);
}
