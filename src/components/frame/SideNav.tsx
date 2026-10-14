import { useEffect, useId } from "react";
import { LayoutGroup } from "framer-motion";
import { useRovingTabIndex } from "../../hooks/useRovingTabIndex";
import type { IconName } from "../icons/Icon";
import { NavItem } from "./NavItem";
import { visibleNavTree } from "./visibleNavTree";
import "./SideNav.css";

export interface SideNavItem<T extends string> {
  value: T;
  label: string;
  icon: IconName;
  /** Makes this a sub-page of `parent`: listed indented under it while that group is open. */
  parent?: T;
}

export interface SideNavProps<T extends string> {
  /** Accessible name of the navigation landmark. */
  label: string;
  items: readonly SideNavItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Icon-only rail: labels become tooltips. */
  collapsed?: boolean;
}

/**
 * The rail's page list: a `<nav>` of buttons with `aria-current="page"` on the
 * open page. Sub-pages (items with a `parent`) are listed under their parent,
 * indented, only while the parent or one of its sub-pages is open (Windows 11
 * Settings); the parent then reads as the open group (gold glyph, no fill).
 * No `aria-expanded`: the parent navigates, it does not toggle. Collapsed
 * (icon-only), the sub-pages stay as icons inside a tinted group under the
 * parent, so they are still one click away.
 *
 * One tab stop (roving tabindex) over every visible row, sub-pages included:
 * Up / Down (and Left / Right), Home and End move focus without opening
 * anything; Enter, Space or a click opens the focused page. The tab stop
 * follows the open page when it changes.
 */
export function SideNav<T extends string>({ label, items, value, onChange, collapsed = false }: SideNavProps<T>) {
  const tree = visibleNavTree(items, value);
  const flat = tree.flatMap((node) => [node.item, ...node.children]);
  const selectedIndex = Math.max(
    flat.findIndex((item) => item.value === value),
    0,
  );
  const { tabIndexFor, refFor, onKeyDown, onItemFocus } = useRovingTabIndex(flat.length, selectedIndex);
  const layoutId = useId();

  // Keyed on the page too: when a group folds, the newly opened page can land on
  // the old page's index (Equalizer 2 -> System 2) while the focused row's index moved.
  useEffect(() => onItemFocus(selectedIndex), [onItemFocus, selectedIndex, value]);

  const row = (item: SideNavItem<T>, child: boolean, ancestor = false) => {
    const index = flat.indexOf(item);
    return (
      <NavItem
        ref={refFor(index)}
        label={item.label}
        icon={item.icon}
        selected={item.value === value}
        ancestor={ancestor}
        child={child}
        collapsed={collapsed}
        tabbable={tabIndexFor(index) === 0}
        layoutId={`${layoutId}-selection`}
        onSelect={() => onChange(item.value)}
        onFocus={() => onItemFocus(index)}
      />
    );
  };

  return (
    <nav className={collapsed ? "side-nav side-nav--collapsed" : "side-nav"} aria-label={label}>
      <LayoutGroup id={layoutId}>
        <ul className="side-nav__list" onKeyDown={onKeyDown}>
          {tree.map((node) => (
            <li key={node.item.value}>
              {row(
                node.item,
                false,
                node.children.some((child) => child.value === value),
              )}
              {node.children.length > 0 ? (
                <ul className="side-nav__children" aria-label={`${node.item.label} pages`}>
                  {node.children.map((child) => (
                    <li key={child.value}>{row(child, true)}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </LayoutGroup>
    </nav>
  );
}
