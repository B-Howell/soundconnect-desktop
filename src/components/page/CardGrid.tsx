import { Children, type ReactNode } from "react";
import "./CardGrid.css";

export interface CardGridProps {
  /** `CardStack`s, one per column at two columns; they stack in order at one. */
  children: ReactNode;
}

/**
 * The page's responsive layout: one column, or two once the page column is
 * at least 700 px wide (a container query on the page, so the rail's width is
 * accounted for). Each child is a `CardStack`; pages put cards that belong
 * together in one stack so the two columns balance.
 *
 * Stacks fill left to right, row by row, and a stack with nothing in it
 * renders nothing, so it never holds a cell: a lone stack always lands in
 * the left column (half width at two columns), never stranded on the right
 * beside an empty one (the Sound page the maintainer saw in 0.1.7).
 */
export function CardGrid({ children }: CardGridProps) {
  return <div className="card-grid">{children}</div>;
}

export interface CardStackProps {
  /** `full` spans both columns (the Status page's device card). */
  span?: "full";
  children: ReactNode;
}

/** One column cell of a `CardGrid`: its sections stack top to bottom. Renders nothing when every child is empty (`null`, `false`, `undefined`). */
export function CardStack({ span, children }: CardStackProps) {
  if (Children.toArray(children).length === 0) return null;
  return <div className={span === "full" ? "card-stack card-stack--full" : "card-stack"}>{children}</div>;
}
