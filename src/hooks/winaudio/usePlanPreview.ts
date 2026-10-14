import { useCallback, useState } from "react";
import type { WinAudioApi } from "../../lib/winaudio/api";
import type { Change, FixKind, Plan } from "../../lib/winaudio/types";

export interface PlanPreviewState {
  /** The mode being previewed, or null with the sheet closed. */
  kind: FixKind | null;
  /** The plan once the app has built it. */
  plan: Plan | null;
  error: string | null;
  /** Asks the app for the plan and opens the preview. */
  open: (kind: FixKind) => void;
  close: () => void;
  /** Applies exactly the previewed changes and closes the preview. */
  confirm: () => void;
}

/** Switching to "Stereo audio" / "Mono audio with mic": fetch the plan, preview it, then apply it. */
export function usePlanPreview(
  api: WinAudioApi | null,
  address: string | null,
  codec: string | null,
  apply: (changes: Change[]) => Promise<unknown>,
): PlanPreviewState {
  const [kind, setKind] = useState<FixKind | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(
    (next: FixKind) => {
      if (!api || !address) return;
      setKind(next);
      setPlan(null);
      setError(null);
      api.fixPreset(next, address, codec).then(setPlan, (e: unknown) => setError(String(e)));
    },
    [api, address, codec],
  );
  const close = useCallback(() => setKind(null), []);
  const confirm = useCallback(() => {
    const changes = plan?.changes.map((c) => c.change) ?? [];
    setKind(null);
    if (changes.length > 0) void apply(changes);
  }, [plan, apply]);

  return { kind, plan, error, open, close, confirm };
}
