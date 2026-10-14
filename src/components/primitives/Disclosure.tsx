import type { ReactNode } from "react";
import { useDisclosure } from "../../hooks/useDisclosure";
import { Icon } from "../icons/Icon";
import "./Disclosure.css";

export interface DisclosureProps {
  /** Text of the toggle, for example "Details". */
  summary: string;
  children: ReactNode;
}

/** A small accent text button with a turning chevron that shows and hides its content. */
export function Disclosure({ summary, children }: DisclosureProps) {
  const { buttonProps, panelProps } = useDisclosure();
  return (
    <div className="disclosure">
      <button type="button" className="disclosure__toggle" {...buttonProps}>
        <Icon name="chevron-right" className="disclosure__chevron" />
        {summary}
      </button>
      <div className="disclosure__panel" {...panelProps}>
        {children}
      </div>
    </div>
  );
}
