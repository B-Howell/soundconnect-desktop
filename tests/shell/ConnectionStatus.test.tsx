import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ConnectionView } from "../../src/components/shell/connectionCopy";
import { ConnectionStatus } from "../../src/components/shell/ConnectionStatus";

/** Error until Try again, then connecting, as the engine drives it. The announcer is tested in AppShell. */
function RetryHarness() {
  const [failed, setFailed] = useState(true);
  const view: ConnectionView = failed
    ? { kind: "error", deviceName: "WH-1000XM4", message: "timeout", onRetry: () => setFailed(false) }
    : { kind: "connecting", deviceName: "WH-1000XM4" };
  return <ConnectionStatus view={view} />;
}

describe("ConnectionStatus", () => {
  it("moves focus to the new heading after Try again, not to the page", async () => {
    const user = userEvent.setup();
    render(<RetryHarness />);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    const heading = screen.getByRole("heading", { name: "Connecting…" });
    expect(heading).toHaveFocus();
    expect(document.body).not.toHaveFocus();
  });

  it("leaves focus alone when the state changes without a user action", () => {
    const { rerender } = render(<ConnectionStatus view={{ kind: "searching" }} />);
    rerender(<ConnectionStatus view={{ kind: "connecting", deviceName: "WH-1000XM4" }} />);
    expect(screen.getByRole("heading", { name: "Connecting…" })).not.toHaveFocus();
  });

  it("offers Set up while no headphones are set up", async () => {
    const user = userEvent.setup();
    let opened = 0;
    render(<ConnectionStatus view={{ kind: "searching" }} onSetUp={() => (opened += 1)} />);
    expect(screen.getByRole("heading", { name: "No headphones set up" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Set up" }));
    expect(opened).toBe(1);
  });

  it("shows the awaited device's own photo while searching, and the model prop over the Bluetooth name", () => {
    const { rerender } = render(<ConnectionStatus view={{ kind: "searching", deviceName: "WH-1000XM4" }} />);
    expect(screen.getByRole("img")).toHaveAttribute("data-model", "WH-1000XM4");
    rerender(<ConnectionStatus view={{ kind: "connecting", deviceName: "My Headphones" }} model="WF-1000XM4" />);
    expect(screen.getByRole("img")).toHaveAttribute("data-model", "WF-1000XM4");
  });
});
