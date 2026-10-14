import { useCallback, useEffect } from "react";
import { useEngine, useEngineStoreApi } from "../../state/engineContext";
import { useNavStore } from "../../state/navStore";
import { useSettingsStore } from "../../state/settingsStore";
import { SETUP_STEPS, useSetupStore, type SetupStep } from "../../state/setupStore";

export interface SetupWizard {
  /** The step on screen now. */
  step: SetupStep;
  count: number;
  /** Moves from the current step to the next one. */
  next: () => void;
  /** Moves from the current step to the previous one. */
  back: () => void;
  /** Leaves the wizard for the app; only offered while headphones are remembered. */
  cancel: (() => void) | undefined;
  /** Finishes setup: remembers it was done, closes the wizard, opens Status. */
  finish: () => void;
}

/**
 * Step navigation for the setup wizard. A connect started on "Choose your
 * headphones" that succeeds moves on to "All set" by itself. Going back or
 * leaving clears a settled connect attempt, so a stale failure is not shown
 * again. `next` and `back` read the step when called, so a step card that is
 * still fading out cannot move the wizard from a stale step.
 */
export function useSetupWizard(): SetupWizard {
  const step = useSetupStore((state) => state.step);
  const setStep = useSetupStore((state) => state.setStep);
  const closeSetup = useSetupStore((state) => state.closeSetup);
  const setOnboardingDone = useSettingsStore((state) => state.setOnboardingDone);
  const setPage = useNavStore((state) => state.setPage);
  const store = useEngineStoreApi();
  const attemptPhase = useEngine((state) => state.attempt?.phase);
  const hasRemembered = useEngine((state) => state.remembered !== null);

  useEffect(() => {
    if (step === "choose" && attemptPhase === "connected") setStep("done");
  }, [step, attemptPhase, setStep]);

  const next = useCallback(() => {
    const following = SETUP_STEPS[SETUP_STEPS.indexOf(useSetupStore.getState().step) + 1];
    if (following) setStep(following);
  }, [setStep]);

  const back = useCallback(() => {
    const previous = SETUP_STEPS[SETUP_STEPS.indexOf(useSetupStore.getState().step) - 1];
    if (!previous) return;
    store.getState().clearAttempt();
    setStep(previous);
  }, [setStep, store]);

  const close = useCallback(() => {
    store.getState().clearAttempt();
    closeSetup();
    setPage("status");
  }, [closeSetup, setPage, store]);

  const finish = useCallback(() => {
    setOnboardingDone(true);
    close();
  }, [setOnboardingDone, close]);

  return { step, count: SETUP_STEPS.length, next, back, cancel: hasRemembered ? close : undefined, finish };
}
