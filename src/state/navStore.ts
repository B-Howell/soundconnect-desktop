import { create } from "zustand";

/** The pages reachable from the navigation rail: six top-level pages plus Sound's two sub-pages (equalizer, noise); `navPages.ts` holds the hierarchy. */
export type NavPage = "status" | "sound" | "equalizer" | "noise" | "system" | "devices" | "windowsAudio" | "settings";

export interface NavState {
  /** The page on screen. */
  page: NavPage;
  setPage: (page: NavPage) => void;
}

/**
 * Which top-level page is showing. Pure in-memory state: nothing is persisted,
 * so every launch opens on Status.
 */
export const useNavStore = create<NavState>()((set) => ({
  page: "status",
  setPage: (page) => set({ page }),
}));
