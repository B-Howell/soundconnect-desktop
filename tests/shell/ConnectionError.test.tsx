import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConnectionError } from "../../src/components/shell/ConnectionError";

const raw = "RFCOMM connect failed: 0x80070079";

describe("ConnectionError", () => {
  it("says Connection failed and keeps the raw message hidden until Details is opened", async () => {
    const user = userEvent.setup();
    render(<ConnectionError deviceName="WH-1000XM4" message={raw} onRetry={() => undefined} />);

    expect(screen.getByRole("heading", { name: "Connection failed" })).toBeInTheDocument();
    // No reason from the engine: the title is the only line.
    expect(document.querySelector(".connection-state__description")).toBeNull();

    const details = screen.getByRole("button", { name: "Details" });
    expect(details).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(raw)).not.toBeVisible();

    await user.click(details);
    expect(details).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(raw)).toBeVisible();

    await user.click(details);
    expect(screen.getByText(raw)).not.toBeVisible();
  });

  it("offers Bluetooth settings beside Try again when given the handler", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<ConnectionError message={raw} onRetry={() => undefined} onOpenBluetoothSettings={onOpen} />);
    await user.click(screen.getByRole("button", { name: "Bluetooth settings" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("calls onRetry from Try again", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ConnectionError message={raw} onRetry={onRetry} />);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
