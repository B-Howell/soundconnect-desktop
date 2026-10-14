import { useEffect, useMemo } from "react";
import { alertCopy } from "../../components/shell/alertCopy";
import type { AlertBannerProps } from "../../components/shell/AlertBanner";
import { useEngine, useEngineStoreApi } from "../../state/engineContext";

/** How long an alert the engine already answered stays on screen, ms. */
export const INFO_ALERT_MS = 5000;

/**
 * The banner for the pending `engine:alert`, or null. An alert with
 * `autoResponse` was answered by the engine (the v1 connection-mode alert is
 * answered NEGATIVE): it shows as information and hides itself after
 * `INFO_ALERT_MS`; OK only dismisses it. Any other alert waits: OK sends
 * `respondToAlert {positive: true}`, Not now `{positive: false}`.
 */
export function useAlertBannerProps(): AlertBannerProps | null {
  const store = useEngineStoreApi();
  const alert = useEngine((state) => state.alert);
  const info = alert !== null && alert.autoResponse !== null;

  useEffect(() => {
    if (!info) return;
    const timer = setTimeout(() => store.getState().dismissAlert(), INFO_ALERT_MS);
    return () => clearTimeout(timer);
  }, [alert, info, store]);

  return useMemo(() => {
    if (!alert) return null;
    const { respondToAlert, dismissAlert } = store.getState();
    return info
      ? { ...alertCopy(alert), kind: "info", onConfirm: dismissAlert }
      : {
          ...alertCopy(alert),
          kind: "question",
          onConfirm: () => respondToAlert(true),
          onDecline: () => respondToAlert(false),
        };
  }, [alert, info, store]);
}
