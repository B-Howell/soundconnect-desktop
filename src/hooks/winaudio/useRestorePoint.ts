import { useCallback, useEffect, useState } from "react";
import type { WinAudioApi } from "../../lib/winaudio/api";
import type { ChangeResult } from "../../lib/winaudio/types";

export interface RestorePointState {
  /** A restore point exists (saved before SoundConnect's first change). */
  available: boolean;
  restore: () => Promise<ChangeResult[]>;
  forget: () => Promise<void>;
}

/**
 * The saved pre-fix state. Re-read whenever `version` changes (pass the last
 * apply's results: the first apply saves it); `onDone` refreshes the page
 * after a restore.
 */
export function useRestorePoint(
  api: WinAudioApi | null,
  codec: string | null,
  version: unknown,
  onDone: () => void,
): RestorePointState {
  const [available, setAvailable] = useState(false);
  const [reads, setReads] = useState(0);

  useEffect(() => {
    if (!api) return;
    let live = true;
    api.restorePoint().then(
      (point) => {
        if (live) setAvailable(point !== null);
      },
      () => {
        if (live) setAvailable(false);
      },
    );
    return () => {
      live = false;
    };
  }, [api, version, reads]);

  const restore = useCallback(async () => {
    if (!api) return [];
    try {
      return await api.restore(codec);
    } finally {
      setReads((n) => n + 1);
      onDone();
    }
  }, [api, codec, onDone]);

  const forget = useCallback(async () => {
    if (!api) return;
    await api.forgetRestorePoint();
    setReads((n) => n + 1);
  }, [api]);

  return { available, restore, forget };
}
