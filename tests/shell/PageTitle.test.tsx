import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PageTitle } from "../../src/components/page/PageTitle";

describe("PageTitle", () => {
  it("is a plain h1 for a top-level page, with no breadcrumb", () => {
    render(<PageTitle id="t">Sound</PageTitle>);
    expect(screen.getByRole("heading", { level: 1, name: "Sound" })).toHaveAttribute("id", "t");
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).toBeNull();
  });

  it("shows a sub-page as 'Sound › Equalizer': the h1 names the page alone and Sound is a link back", async () => {
    const user = userEvent.setup();
    const back = vi.fn();
    render(
      <PageTitle id="t" trail={[{ label: "Sound", onSelect: back }]}>
        Equalizer
      </PageTitle>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Equalizer" })).toHaveAttribute("id", "t");
    const crumb = screen.getByRole("button", { name: "Sound" });
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toContainElement(crumb);
    expect(crumb).toHaveAttribute("title", "Back to Sound");
    expect(screen.getByText("›")).toHaveAttribute("aria-hidden", "true");
    await user.click(crumb);
    expect(back).toHaveBeenCalledOnce();
  });
});
