import type { ReactNode } from "react";
import { PageTransition } from "./PageTransition";
import { TitleBar } from "./TitleBar";
import "./AppFrame.css";

export interface AppFrameProps {
  /** Product name: at the left of the title bar, or in the rail's strip when there is a rail. */
  wordmark: string;
  /** Changes when the page changes; the old page cross-fades out and the new one in. */
  pageKey: string;
  /** Optional centred title-bar content (the gallery's label). */
  title?: ReactNode;
  /**
   * Optional left column (the navigation rail). It spans the window's height,
   * title-bar row included, and then carries the wordmark itself.
   */
  nav?: ReactNode;
  /** Optional heading at the top of the page column (the page's `<h1>`); it scrolls with the page. */
  heading?: ReactNode;
  children: ReactNode;
}

/**
 * The desktop window: `[rail][content]` columns under one title-bar row, the
 * content a scroll area whose page column is at most `--content-max-width`
 * wide, centred, with `--page-gutter` padding. Pages render inside the
 * column and own nothing of the chrome.
 */
export function AppFrame({ wordmark, pageKey, title, nav, heading, children }: AppFrameProps) {
  return (
    <div className={nav ? "app-frame app-frame--with-nav" : "app-frame"}>
      {nav ? <div className="app-frame__nav">{nav}</div> : null}
      <TitleBar wordmark={nav ? undefined : wordmark}>{title}</TitleBar>
      <main className="app-frame__content">
        <PageTransition pageKey={pageKey}>
          <div className="app-frame__scroll">
            <div className="app-frame__page">
              {heading}
              {children}
            </div>
          </div>
        </PageTransition>
      </main>
    </div>
  );
}
