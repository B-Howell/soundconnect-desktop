import { useStore } from "zustand";
import type { UpdateBannerProps } from "../../components/updates/UpdateBanner";
import type { UpdaterStore } from "../../state/updaterStore";

/**
 * The update banner for the updater store's state, or null when there is
 * nothing to show (no update, up to date, still checking, or "Later").
 * `onNotes` opens the release-notes sheet the caller owns.
 */
export function useUpdateBannerProps(store: UpdaterStore, onNotes: () => void): UpdateBannerProps | null {
  const phase = useStore(store, (s) => s.phase);
  const update = useStore(store, (s) => s.update);
  const progress = useStore(store, (s) => s.progress);
  const error = useStore(store, (s) => s.error);
  const dismissed = useStore(store, (s) => s.dismissed);
  const { install, dismiss, check } = store.getState();
  if (dismissed) return null;
  switch (phase) {
    case "available":
      return update ? { state: "available", version: update.version, onInstall: () => void install(), onLater: dismiss, onNotes } : null;
    case "downloading":
      return update ? { state: "downloading", version: update.version, progress } : null;
    case "installing":
      return update ? { state: "installing", version: update.version } : null;
    case "error":
      return {
        state: "error",
        message: error ?? "The update failed.",
        // A failed download retries the same update; a failed check checks again.
        onRetry: () => void (update ? install() : check()),
        onDismiss: dismiss,
      };
    default:
      return null;
  }
}
