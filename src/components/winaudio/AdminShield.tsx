import "./AdminShield.css";

/**
 * The Windows administrator shield beside a setting that needs one UAC
 * prompt to change. Drawn here (the shared icon set has no shield); the
 * spoken text says what it means.
 */
export function AdminShield() {
  return (
    <span className="admin-shield" title="Needs administrator permission">
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M12 2.75 4.5 5.6v5.65c0 4.7 3.1 8.9 7.5 10.25 4.4-1.35 7.5-5.55 7.5-10.25V5.6z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M12 2.75v18.75c4.4-1.35 7.5-5.55 7.5-10.25V5.6z" fill="currentColor" />
      </svg>
      <span className="sr-only">(needs administrator permission)</span>
    </span>
  );
}
