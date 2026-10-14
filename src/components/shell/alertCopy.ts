import { CONFIRM_CONNECTION_MODE_CHANGE, type AlertEvent } from "../../lib/engine/types";

export interface AlertCopy {
  title: string;
  /** One short line under the title; "" when the title says it all. */
  message: string;
}

/**
 * The one alert upstream documents for the v1 family (docs/device-support/
 * WH-1000XM3.md): "Changing the equalizer preset made the device raise
 * `ALERT_NTFY_PARAM` `DISCONNECT_CAUSED_BY_CONNECTION_MODE_CHANGE` with a
 * yes/no choice". The engine answers it NEGATIVE itself (`autoResponse`).
 */
const CONNECTION_MODE_CHANGE = "DISCONNECT_CAUSED_BY_CONNECTION_MODE_CHANGE";

export { CONFIRM_CONNECTION_MODE_CHANGE };

/** `SOME_ALERT_KEY` -> "Some alert key"; free text passes through. */
export function humanizeAlertKey(key: string): string {
  if (!/^[A-Z0-9_]+$/.test(key)) return key;
  const words = key.toLowerCase().replace(/_+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The banner's words for an `engine:alert`: a title and at most one short line. */
export function alertCopy(alert: AlertEvent): AlertCopy {
  const answered = alert.autoResponse !== null;
  if (alert.message === CONFIRM_CONNECTION_MODE_CHANGE) {
    return {
      title: "Change connection quality?",
      message: "Audio stops for a few seconds while the headphones reconnect.",
    };
  }
  if (alert.message.includes(CONNECTION_MODE_CHANGE)) {
    return answered
      ? {
          title: "Setting changed",
          message: "",
        }
      : {
          title: "Reconnect headphones?",
          message: "Audio stops for a few seconds.",
        };
  }
  const detail = humanizeAlertKey(alert.message);
  return answered
    ? { title: "Headphones notice", message: detail }
    : { title: "Headphones request", message: detail };
}
