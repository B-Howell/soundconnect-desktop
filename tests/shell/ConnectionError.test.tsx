import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConnectionError } from "../../src/components/shell/ConnectionError";

const raw = "RFCOMM connect failed: 0x80070079";

describe("ConnectionError", () => {
  it("leads with friendly text and keeps the raw message hidden until Details is opened", async () => {
    const user = userEvent.setup();
    render(<ConnectionError deviceName="WH-1000XM4" message={raw} onRetry={() => undefined} />);

    expect(screen.getByRole("heading", { name: "Couldn't connect to WH-1000XM4" })).toBeInTheDocument();
    expect(screen.getByText(/connected in Windows Bluetooth settings/)).toBeVisible();

    const details = screen.getByRole("button", { name: "Details" });
    expect(details).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(raw)).not.toBeVisible();

    await user.click(details);
    expect(details).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(raw)).toBeVisible();

    await user.click(details);
    expect(screen.getByText(raw)).not.toBeVisible();
  });

  it("names the headphones generically when no device was found", () => {
    render(<ConnectionError message={raw} onRetry={() => undefined} />);
    expect(screen.getByRole("heading", { name: "Couldn't connect to your headphones" })).toBeInTheDocument();
  });

  it("calls onRetry from Try again", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ConnectionError message={raw} onRetry={onRetry} />);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
