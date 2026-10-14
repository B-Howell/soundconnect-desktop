import { useCallback, useEffect, useRef, useState } from "react";
import type { WinAudioApi } from "../../lib/winaudio/api";
import type { WinAudioSnapshot } from "../../lib/winaudio/types";

/** How often the page re-reads Windows while it is open, ms. */
export const REFRESH_MS = 10_000;

export interface WinAudioSnapshotState {
  snapshot: WinAudioSnapshot | null;
  error: string | null;
  /** Re-reads now; resolves when the read is done. */
  refresh: () => Promise<void>;
}

/**
 * Reads the Windows audio snapshot for `address` on mount, whenever the
 * window gains focus, and every `REFRESH_MS` while mounted (Windows settings
 * change behind the app's back). The newest read wins.
 */
export function useWinAudioSnapshot(
  api: WinAudioApi | null,
  address: string | null,
  codec: string | null,
  intervalMs = REFRESH_MS,
): WinAudioSnapshotState {
  const [snapshot, setSnapshot] = useState<WinAudioSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    if (!api || !address) return;
    const mine = ++generation.current;
    try {
      const next = await api.snapshot(address, codec);
      if (mine === generation.current) {
        setSnapshot(next);
        setError(null);
      }
    } catch (e: unknown) {
      if (mine === generation.current) setError(String(e));
    }
  }, [api, address, codec]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), intervalMs);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, intervalMs]);

  return { snapshot, error, refresh };
}
