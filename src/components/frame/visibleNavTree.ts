/** The minimum a rail item needs for the tree: its value and, for a sub-page, its parent. */
export interface NavTreeItem<T extends string> {
  value: T;
  parent?: T;
}

export interface NavTreeNode<I> {
  item: I;
  /** The sub-pages shown under it: all of them while its group is open, else none. */
  children: I[];
}

/**
 * The rail's visible rows for the open page `value`: every top-level item in
 * order, each with its sub-pages listed only when it or one of them is open.
 * Pure, so the rail's disclosure rule is tested without rendering.
 */
export function visibleNavTree<T extends string, I extends NavTreeItem<T>>(items: readonly I[], value: T): NavTreeNode<I>[] {
  const openGroup = items.find((item) => item.value === value)?.parent ?? value;
  return items
    .filter((item) => item.parent === undefined)
    .map((item) => {
      const all = items.filter((candidate) => candidate.parent === item.value);
      return { item, children: item.value === openGroup ? all : [] };
    });
}
