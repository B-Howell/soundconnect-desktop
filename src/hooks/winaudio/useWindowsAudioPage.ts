import { useCallback, useMemo, useState } from "react";
import type { WinAudioSectionsProps } from "../../components/winaudio/WinAudioSections";
import { attentionCount, audioMode, modeDrift, winAudioCards } from "../../lib/winaudio/rows";
import type { Change, SettingsPage } from "../../lib/winaudio/types";
import { useApplyChanges } from "./useApplyChanges";
import { usePlanPreview } from "./usePlanPreview";
import { useRestorePoint } from "./useRestorePoint";
import { useWinAudioApi } from "./useWinAudioApi";
import { useWinAudioSnapshot } from "./useWinAudioSnapshot";
import { useWinAudioTarget } from "./useWinAudioTarget";

export type WindowsAudioPageView =
  | { state: "noDevice" }
  | { state: "loading"; error: string | null }
  | { state: "ready"; props: WinAudioSectionsProps };

/** Shown when Windows has the headphones' endpoint but they are not connected now. */
export const NOT_CONNECTED_NOTICE =
  "The headphones are not connected to Windows now. Settings show their last known state; defaults cannot point at them until they connect.";

/**
 * Wires the Windows audio page: which headphones (`useWinAudioTarget`), the
 * live snapshot (refreshed on focus and every 10 s), the current mode and
 * its drift, applying single changes and the two modes through a preview,
 * and the restore point.
 */
export function useWindowsAudioPage(): WindowsAudioPageView {
  const { address, codec } = useWinAudioTarget();
  const api = useWinAudioApi();
  const { snapshot, error, refresh } = useWinAudioSnapshot(api, address, codec);
  const onDone = useCallback(() => void refresh(), [refresh]);
  const applier = useApplyChanges(api, address, onDone);
  const preview = usePlanPreview(api, address, codec, applier.apply);
  const restorePoint = useRestorePoint(api, codec, applier.results, onDone);
  const [restoreOpen, setRestoreOpen] = useState(false);

  const onChange = useCallback((change: Change) => void applier.apply([change]), [applier]);
  const onOpenSettings = useCallback((page: SettingsPage) => void api?.openSettings(page), [api]);
  const cards = useMemo(() => (snapshot ? winAudioCards(snapshot) : []), [snapshot]);

  if (!address) return { state: "noDevice" };
  if (!snapshot) return { state: "loading", error };

  const connected = snapshot.stereo?.state === "active";
  const current = audioMode(snapshot);
  return {
    state: "ready",
    props: {
      mode: {
        mode: current,
        attention: attentionCount(cards, modeDrift(snapshot, current)),
        onChoose: preview.open,
      },
      cards,
      advanced: {
        onRestore: restorePoint.available ? () => setRestoreOpen(true) : undefined,
        onForgetRestorePoint: restorePoint.available ? () => void restorePoint.forget() : undefined,
        onOpenSoundSettings: () => onOpenSettings("sound"),
      },
      preview: {
        kind: preview.kind,
        plan: preview.plan,
        error: preview.error,
        onConfirm: preview.confirm,
        onClose: preview.close,
      },
      restoreSheet: {
        open: restoreOpen,
        onConfirm: () =>
          void restorePoint.restore().then(applier.report, (e: unknown) => console.error("restore failed", e)),
        onClose: () => setRestoreOpen(false),
      },
      results: applier.results,
      resultError: applier.error,
      onDismissResults: applier.dismiss,
      notice: snapshot.stereo && !connected ? NOT_CONNECTED_NOTICE : null,
      onChange,
      onOpenSettings,
      busy: applier.busy,
    },
  };
}
