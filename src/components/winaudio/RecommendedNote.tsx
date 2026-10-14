import "./RecommendedNote.css";

/** "Recommended: Off" under a row's sentence, shown only when the live state differs. */
export function RecommendedNote({ recommended }: { recommended: string }) {
  return (
    <span className="recommended-note">
      <span className="recommended-note__dot" aria-hidden="true" />
      Recommended: {recommended}
    </span>
  );
}
