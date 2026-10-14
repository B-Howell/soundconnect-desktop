import { create } from "zustand";

/** The setup wizard's steps, in order. */
export const SETUP_STEPS = ["welcome", "pair", "choose", "done"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

export interface SetupState {
  /** True while the wizard replaces the app (rail hidden). */
  open: boolean;
  step: SetupStep;
  /** Opens the wizard at `step` (the welcome by default). */
  openSetup: (step?: SetupStep) => void;
  closeSetup: () => void;
  setStep: (step: SetupStep) => void;
}

/**
 * Whether the setup wizard is showing and on which step. In memory only:
 * whether setup is needed comes from the engine (no remembered headphones,
 * `useSetupGate`) and the persisted `onboardingDone` flag, not from here.
 */
export const useSetupStore = create<SetupState>()((set) => ({
  open: false,
  step: "welcome",
  openSetup: (step = "welcome") => set({ open: true, step }),
  closeSetup: () => set({ open: false, step: "welcome" }),
  setStep: (step) => set({ step }),
}));
