import type { ReactNode } from "react";
import { useIsTauri } from "../../hooks/useIsTauri";
import { WindowControls } from "./WindowControls";
import "./TitleBar.css";

export interface TitleBarProps {
  /** Product name at the left edge; left out when the navigation rail carries it. */
  wordmark?: string;
  /** Optional centred label or small control cluster. */
  children?: ReactNode;
}

/**
 * The 40 px drag strip across the top of the frameless window. Its background
 * is the drag region; the wordmark and title ignore the pointer so dragging
 * works everywhere except on the caption buttons, which render only inside
 * Tauri (a plain browser has its own chrome).
 */
export function TitleBar({ wordmark, children }: TitleBarProps) {
  const inTauri = useIsTauri();
  return (
    <header className="titlebar" data-tauri-drag-region>
      {wordmark ? <div className="titlebar__wordmark">{wordmark}</div> : null}
      {children ? <div className="titlebar__title">{children}</div> : null}
      {inTauri ? (
        <div className="titlebar__controls">
          <WindowControls />
        </div>
      ) : null}
    </header>
  );
}
