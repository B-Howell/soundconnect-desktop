import type { FocusEventHandler, Ref } from "react";
import { motion } from "framer-motion";
import { Icon, type IconName } from "../icons/Icon";
import "./NavItem.css";

export interface NavItemProps {
  label: string;
  icon: IconName;
  selected: boolean;
  /** One of its sub-pages is open: gold glyph and semibold label, no fill (the fill marks the open page alone). */
  ancestor?: boolean;
  /** A sub-page row, indented under its parent. */
  child?: boolean;
  /** Label hidden visually (icon-only rail); it stays the accessible name and becomes the tooltip. */
  collapsed: boolean;
  /** The rail's single tab stop (roving tabindex). */
  tabbable: boolean;
  /** Shared by the rail's items, so the selection fill slides from item to item. */
  layoutId: string;
  onSelect: () => void;
  onFocus?: FocusEventHandler<HTMLButtonElement>;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * One rail destination, Windows 11 Settings style: glyph and label in a
 * 40 px row; the selected item has a soft accent fill and a gold bar at its
 * left edge, both one `motion.span` that slides between items on the app
 * spring. `aria-current="page"` marks the selection. A sub-page row
 * (`child`) is indented under its parent; a parent whose sub-page is open
 * (`ancestor`) keeps a gold glyph and semibold label without the fill.
 */
export function NavItem({
  label,
  icon,
  selected,
  ancestor = false,
  child = false,
  collapsed,
  tabbable,
  layoutId,
  onSelect,
  onFocus,
  ref,
}: NavItemProps) {
  const className = [
    "nav-item",
    collapsed && "nav-item--collapsed",
    child && "nav-item--child",
    ancestor && "nav-item--ancestor",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      ref={ref}
      type="button"
      className={className}
      aria-current={selected ? "page" : undefined}
      title={collapsed ? label : undefined}
      tabIndex={tabbable ? 0 : -1}
      onClick={onSelect}
      onFocus={onFocus}
    >
      {selected ? <motion.span className="nav-item__selection" layoutId={layoutId} aria-hidden="true" /> : null}
      <Icon name={icon} size={20} className="nav-item__icon" />
      <span className={collapsed ? "sr-only" : "nav-item__label"}>{label}</span>
    </button>
  );
}
