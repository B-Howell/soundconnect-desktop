import type { ReactNode } from "react";
import { Card } from "./Card";
import "./GroupedList.css";

export interface GroupedListProps {
  /** Accessible name for the list when no visible heading labels it. */
  "aria-label"?: string;
  /** Id of the visible heading (usually a SectionHeader) that names the list. */
  "aria-labelledby"?: string;
  /** `ListRow`s; each renders its own `<li>`. */
  children: ReactNode;
}

/** A card holding a column of rows; rows draw the inset separators between themselves. */
export function GroupedList({ children, ...labelling }: GroupedListProps) {
  return (
    <Card>
      <ul className="grouped-list" {...labelling}>
        {children}
      </ul>
    </Card>
  );
}
