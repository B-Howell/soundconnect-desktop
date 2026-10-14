import type { ReactNode } from "react";
import "./NavRail.css";

export interface NavRailProps {
  /** Product name in the rail's title-bar strip (left out when collapsed). */
  wordmark: string;
  collapsed: boolean;
  /** The device block under the strip. */
  device?: ReactNode;
  /** The page list (`SideNav`). */
  children: ReactNode;
}

/**
 * The left column of the desktop frame: a title-bar-height strip with the
 * wordmark (a drag region, continuing the title bar), the connected device,
 * then the page list. 240 px, or 72 px icon-only when `collapsed`.
 */
export function NavRail({ wordmark, collapsed, device, children }: NavRailProps) {
  return (
    <aside className={collapsed ? "nav-rail nav-rail--collapsed" : "nav-rail"}>
      <div className="nav-rail__strip" data-tauri-drag-region>
        {collapsed ? null : <span className="nav-rail__wordmark">{wordmark}</span>}
      </div>
      {device ? <div className="nav-rail__device">{device}</div> : null}
      <div className="nav-rail__nav">{children}</div>
    </aside>
  );
}
