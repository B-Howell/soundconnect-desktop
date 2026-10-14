import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { EngineCommand } from "../../lib/engine/types";
import { useEngineStoreApi } from "../../state/engineContext";
import { useThrottledCallback } from "../useThrottledCallback";

/** A stable `send(command)` bound to the engine store (optimistic patch included). */
export function useEngineSend(): (command: EngineCommand) => void {
  const store = useEngineStoreApi();
  return useCallback((command: EngineCommand) => void store.getState().send(command), [store]);
}

/** How often a slider's live value is sent while it moves, ms. */
export const SLIDER_SEND_INTERVAL_MS = 150;

export interface SliderCommandHandlers<T> {
  /** Live value: sent at most once per interval, the last value of a burst always delivered. */
  onChange: (value: T) => void;
  /** Final value: drops a pending live send and sends this one unless it was the last one sent. */
  onCommit: (value: T) => void;
  /** Holds the device's echoes for this slider's patch while the gesture is active. */
  onGestureChange: (active: boolean) => void;
}

/**
 * Binds a slider to an engine command, as the Renderer doc asks: live
 * `onChange` through `useThrottledCallback`, the final value on commit, and
 * device echoes held while the gesture is active (`holdEcho` on `slot`, the
 * patch slot `commandKey` gives the slider's commands: the command type for
 * volume and the EQ, `NOISE_SLOT` for the ambient slider, whose positions
 * send either `setNoise` or `setAmbientLevel`). A key press reports a change
 * and then a commit with the same value; the commit is skipped then, so one
 * press sends one command.
 */
export function useSliderCommand<T>(slot: string, toCommand: (value: T) => EngineCommand): SliderCommandHandlers<T> {
  const store = useEngineStoreApi();
  const latest = useRef(toCommand);
  useLayoutEffect(() => {
    latest.current = toCommand;
  });
  const lastSent = useRef<string | null>(null);

  const sendValue = useCallback(
    (value: T) => {
      const command = latest.current(value);
      lastSent.current = JSON.stringify(command);
      void store.getState().send(command);
    },
    [store],
  );
  const throttled = useThrottledCallback(sendValue, SLIDER_SEND_INTERVAL_MS);

  const onCommit = useCallback(
    (value: T) => {
      throttled.cancel();
      if (JSON.stringify(latest.current(value)) !== lastSent.current) sendValue(value);
    },
    [throttled, sendValue],
  );

  const holding = useRef(false);
  const onGestureChange = useCallback(
    (active: boolean) => {
      holding.current = active;
      store.getState().holdEcho(slot, active);
    },
    [store, slot],
  );
  // A slider unmounted mid-gesture (tab switch, link drop) never reports the end: release its hold.
  useEffect(
    () => () => {
      if (holding.current) store.getState().holdEcho(slot, false);
    },
    [store, slot],
  );

  return useMemo(() => ({ onChange: throttled, onCommit, onGestureChange }), [throttled, onCommit, onGestureChange]);
}
