import { useCallback, useState } from "react";
import type { WinAudioApi } from "../../lib/winaudio/api";
import { needsAdmin, type Change, type ChangeResult } from "../../lib/winaudio/types";

export interface ApplyChangesState {
  /** Admin changes first (one Windows prompt), then user changes; then `onDone`. */
  apply: (changes: Change[]) => Promise<ChangeResult[]>;
  busy: boolean;
  /** The last batch's results. */
  results: ChangeResult[] | null;
  /** The last batch's error (a command failed outright). */
  error: string | null;
  /** Clears the last results. */
  dismiss: () => void;
  /** Shows results that came from elsewhere (a restore). */
  report: (results: ChangeResult[]) => void;
}

/**
 * Applies a batch through the Windows audio commands. Admin changes go first
 * because user-level ones may need what they create (Hands-Free's endpoints).
 * A declined Windows prompt comes back as failed admin results; the
 * user-level changes still run.
 */
export function useApplyChanges(api: WinAudioApi | null, address: string | null, onDone: () => void): ApplyChangesState {
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ChangeResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(
    async (changes: Change[]) => {
      if (!api || !address || changes.length === 0) return [];
      const admin = changes.filter(needsAdmin);
      const user = changes.filter((c) => !needsAdmin(c));
      setBusy(true);
      setError(null);
      try {
        const done = [
          ...(admin.length > 0 ? await api.applyAdmin(address, admin) : []),
          ...(user.length > 0 ? await api.apply(address, user) : []),
        ];
        setResults(done);
        return done;
      } catch (e: unknown) {
        setError(String(e));
        setResults(null);
        return [];
      } finally {
        setBusy(false);
        onDone();
      }
    },
    [api, address, onDone],
  );

  const dismiss = useCallback(() => {
    setResults(null);
    setError(null);
  }, []);

  const report = useCallback((done: ChangeResult[]) => {
    setResults(done);
    setError(null);
  }, []);

  return { apply, busy, results, error, dismiss, report };
}
