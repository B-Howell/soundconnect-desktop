import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SectionHeader } from "../../src/components/primitives/SectionHeader";

describe("SectionHeader", () => {
  it("renders its title as a heading and its action slot", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(
      <SectionHeader
        id="devices"
        action={
          <button type="button" onClick={onEdit}>
            Edit
          </button>
        }
      >
        Devices
      </SectionHeader>,
    );
    expect(screen.getByRole("heading", { name: "Devices" })).toHaveAttribute("id", "devices");
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("renders no action container without an action", () => {
    const { container } = render(<SectionHeader>Status</SectionHeader>);
    expect(container.querySelector(".section-header__action")).toBeNull();
  });
});
