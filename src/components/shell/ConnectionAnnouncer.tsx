export interface ConnectionAnnouncerProps {
  /** Polite progress text (searching, connecting); empty for none. */
  status: string;
  /** Interrupting text for a failure; empty for none. */
  alert: string;
}

/**
 * Two visually hidden live regions that stay mounted while their text
 * changes. Screen readers announce a change of text in a live region they
 * already know, but often ignore a region that is inserted already filled,
 * which is what swapping whole state cards would do. The alert is one-shot:
 * it is empty except while an error is showing, so each new error is read
 * once.
 */
export function ConnectionAnnouncer({ status, alert }: ConnectionAnnouncerProps) {
  return (
    <>
      <p className="sr-only" role="status">
        {status}
      </p>
      <p className="sr-only" role="alert">
        {alert}
      </p>
    </>
  );
}
