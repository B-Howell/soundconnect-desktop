import { create } from "zustand";
import { defaultUpdaterApi, updateErrorText, type AvailableUpdate, type UpdaterApi } from "../lib/updater/api";

/**
 * Where the update flow is: `idle` (nothing checked yet), `checking`,
 * `upToDate` (a check found nothing), `available`, `downloading` (with
 * `progress`), `installing` (the installer is running; the app is about to
 * close), or `error`.
 */
export type UpdatePhase = "idle" | "checking" | "upToDate" | "available" | "downloading" | "installing" | "error";

export interface UpdaterState {
  phase: UpdatePhase;
  /** The announced update, from `available` on. */
  update: AvailableUpdate | null;
  /** 0..1 while downloading, null while the size is unknown. */
  progress: number | null;
  /** The plain error sentence (`updateErrorText`). */
  error: string | null;
  /** "Later" hides the banner until the next check; Settings still shows the state. */
  dismissed: boolean;
  /** Asks the endpoint; a second call while checking or installing is ignored. */
  check: () => Promise<void>;
  /** Downloads and installs the available update, then restarts the app. */
  install: () => Promise<void>;
  dismiss: () => void;
}

/** The update flow over `api`. Exported so tests can pass a mocked api; the app uses `useUpdaterStore`. */
export function createUpdaterStore(api: UpdaterApi) {
  return create<UpdaterState>()((set, get) => ({
    phase: "idle",
    update: null,
    progress: null,
    error: null,
    dismissed: false,
    check: async () => {
      const { phase } = get();
      if (phase === "checking" || phase === "downloading" || phase === "installing") return;
      set({ phase: "checking", error: null, dismissed: false });
      try {
        const update = await api.check();
        set(update ? { phase: "available", update } : { phase: "upToDate", update: null });
      } catch (e: unknown) {
        set({ phase: "error", error: updateErrorText(e) });
      }
    },
    install: async () => {
      const { update, phase } = get();
      if (!update || phase === "downloading" || phase === "installing") return;
      set({ phase: "downloading", progress: 0, error: null, dismissed: false });
      try {
        await update.install((progress) => set(progress === 1 ? { phase: "installing", progress } : { progress }));
        set({ phase: "installing", progress: 1 });
        await api.relaunch();
      } catch (e: unknown) {
        set({ phase: "error", error: updateErrorText(e), progress: null });
      }
    },
    dismiss: () => set({ dismissed: true }),
  }));
}

export type UpdaterStore = ReturnType<typeof createUpdaterStore>;

/** The app's update flow (the Tauri plugins inside the app, a no-op in the browser). */
export const useUpdaterStore = createUpdaterStore(defaultUpdaterApi);
