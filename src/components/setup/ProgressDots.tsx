import "./ProgressDots.css";

export interface ProgressDotsProps {
  /** Zero-based current step. */
  index: number;
  count: number;
}

/**
 * Where the user is in a short flow: one dot per step, the current one a
 * wider accent pill, finished ones accent, the rest quiet. The dots are
 * decorative; "Step 2 of 4" is spoken instead.
 */
export function ProgressDots({ index, count }: ProgressDotsProps) {
  return (
    <div className="progress-dots">
      <p className="sr-only">{`Step ${index + 1} of ${count}`}</p>
      <ol className="progress-dots__list" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <li
            key={i}
            className="progress-dots__dot"
            data-state={i < index ? "done" : i === index ? "current" : "todo"}
          />
        ))}
      </ol>
    </div>
  );
}
