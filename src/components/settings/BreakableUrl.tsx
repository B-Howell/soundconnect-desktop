import { Fragment } from "react";
import "./BreakableUrl.css";

export interface BreakableUrlProps {
  url: string;
}

/**
 * A URL shown as selectable text that, when it has to wrap, breaks after a
 * "/" (a `<wbr>` after each slash) instead of mid-word, so a long repository
 * path never truncates or splits a name at 380 px.
 */
export function BreakableUrl({ url }: BreakableUrlProps) {
  const parts = url.split("/");
  return (
    <span className="breakable-url">
      {parts.map((part, index) => (
        <Fragment key={index}>
          {part}
          {index < parts.length - 1 ? (
            <>
              /<wbr />
            </>
          ) : null}
        </Fragment>
      ))}
    </span>
  );
}
