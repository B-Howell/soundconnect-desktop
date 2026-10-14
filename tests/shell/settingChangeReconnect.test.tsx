import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { alertCopy, CONFIRM_CONNECTION_MODE_CHANGE } from "../../src/components/shell/alertCopy";
import { connectionCopy } from "../../src/components/shell/connectionCopy";
import { ConnectionStatus } from "../../src/components/shell/ConnectionStatus";
import { toConnectionView } from "../../src/hooks/engine/useConnectionView";
import { failureReasonOf } from "../../src/lib/devices/connectFailureText";
import { advanceAttempt, startAttempt } from "../../src/lib/engine/connectAttempt";
import type { AlertEvent, EngineStatus } from "../../src/lib/engine/types";

/**
 * The engine contract for settings that make the WH-1000XM4 drop its links
 * (docs/core/evidence/toggle-dropouts-debug.md): a confirmation alert before a
 * connection-quality change, then `connecting` with reason
 * `reconnectingAfterSettingChange` while the engine reconnects by itself.
 */
const ADDRESS = "AA:BB:CC:12:34:56";
const retry = () => {};

/** The `engine:alert` payload `AlertView` serialises for the confirmation. */
const confirmation: AlertEvent = {
  message: CONFIRM_CONNECTION_MODE_CHANGE,
  autoResponse: null,
  requiresChoice: true,
};

/** The `engine:status` the service publishes right after the drop. */
const reconnecting: EngineStatus = {
  state: "connecting",
  deviceName: "WH-1000XM4",
  address: ADDRESS,
  reason: "reconnectingAfterSettingChange",
};

describe("connection-quality change", () => {
  it("asks before the headphones disconnect, in words", () => {
    expect(alertCopy(confirmation)).toEqual({
      title: "Change connection quality?",
      message: "Audio stops for a few seconds while the headphones reconnect.",
    });
  });

  it("shows the reconnect as reconnecting, not as a failure", () => {
    const view = toConnectionView(reconnecting, retry);
    expect(view).toEqual({ kind: "connecting", deviceName: "WH-1000XM4", reconnecting: true });
    expect(connectionCopy(view)).toEqual({ title: "Reconnecting…" });
    render(<ConnectionStatus view={view} />);
    expect(screen.getByRole("heading", { name: "Reconnecting…" })).toBeInTheDocument();
  });

  it("a plain connect keeps its own copy", () => {
    const view = toConnectionView({ ...reconnecting, reason: undefined }, retry);
    expect(view).toEqual({ kind: "connecting", deviceName: "WH-1000XM4" });
    expect(connectionCopy(view)).toEqual({ title: "Connecting…" });
  });

  it("is not a failure reason for a connect attempt", () => {
    expect(failureReasonOf("reconnectingAfterSettingChange")).toBeUndefined();
    expect(failureReasonOf("timeout")).toBe("timeout");
    expect(advanceAttempt(startAttempt(ADDRESS), reconnecting, false)).toEqual(startAttempt(ADDRESS));
  });
});
