import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Sheet } from "../../src/components/primitives/Sheet";
import { useSheet } from "../../src/hooks/useSheet";

/** An opener button and a sheet holding three buttons, as a page would wire them. */
function Harness() {
  const sheet = useSheet();
  return (
    <>
      <button type="button" onClick={sheet.show}>
        Open
      </button>
      <Sheet open={sheet.open} onClose={sheet.hide} title="Pick one" message="Choose wisely.">
        <button type="button">First</button>
        <button type="button">Second</button>
        <button type="button" onClick={sheet.hide}>
          Last
        </button>
      </Sheet>
    </>
  );
}

const dialogGone = () => waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

describe("Sheet", () => {
  it("opens as a named modal dialog with focus inside", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("dialog", { name: "Pick one" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("Choose wisely.");
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
  });

  it("keeps Tab and Shift+Tab inside the sheet", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open" }));

    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "Last" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Last" })).toHaveFocus();
  });

  it("closes on Escape and gives focus back to the opener", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open" });
    await user.click(opener);
    await user.keyboard("{Escape}");
    expect(opener).toHaveFocus();
    await dialogGone();
  });

  it("closes on a backdrop click and gives focus back to the opener", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open" });
    await user.click(opener);
    fireEvent.click(screen.getByTestId("sheet-backdrop"));
    expect(opener).toHaveFocus();
    await dialogGone();
  });

  it("hides the rest of the page from assistive technology while open", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    // Testing Library renders into a container appended to document.body.
    const page = container;
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(page).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("button", { name: "Open" })).toBeNull();
    await user.keyboard("{Escape}");
    expect(page).not.toHaveAttribute("aria-hidden");
  });

  it("does not close on a click inside the sheet", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    await user.click(screen.getByRole("button", { name: "Second" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
