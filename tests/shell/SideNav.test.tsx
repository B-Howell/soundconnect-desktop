import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { navPages, navTrail } from "../../src/components/frame/navPages";
import { visibleNavTree } from "../../src/components/frame/visibleNavTree";
import { SideNav } from "../../src/components/frame/SideNav";
import type { NavPage } from "../../src/state/navStore";

function Harness({
  onChange,
  collapsed,
  initial = "status",
}: {
  onChange?: (page: NavPage) => void;
  collapsed?: boolean;
  initial?: NavPage;
}) {
  const [page, setPage] = useState<NavPage>(initial);
  return (
    <SideNav
      label="Pages"
      items={navPages}
      value={page}
      collapsed={collapsed}
      onChange={(next) => {
        setPage(next);
        onChange?.(next);
      }}
    />
  );
}

const items = () => screen.getAllByRole("button");

describe("SideNav", () => {
  it("is a named navigation landmark of the six top-level pages with the open one aria-current and the only tab stop", () => {
    render(<Harness />);
    expect(screen.getByRole("navigation", { name: "Pages" })).toBeInTheDocument();
    expect(items().map((item) => item.textContent)).toEqual([
      "Status",
      "Sound",
      "System",
      "Devices",
      "Windows audio",
      "Settings",
    ]);
    expect(items().filter((item) => item.getAttribute("aria-current") === "page")).toEqual([items()[0]]);
    expect(items().map((item) => item.tabIndex)).toEqual([0, -1, -1, -1, -1, -1]);
  });

  it("lists Equalizer and Noise control under Sound, indented, once Sound is open", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Sound" }));
    expect(items().map((item) => item.textContent)).toEqual([
      "Status",
      "Sound",
      "Equalizer",
      "Noise control",
      "System",
      "Devices",
      "Windows audio",
      "Settings",
    ]);
    const group = screen.getByRole("list", { name: "Sound pages" });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual(["Equalizer", "Noise control"]);
    for (const child of within(group).getAllByRole("button")) expect(child).toHaveClass("nav-item--child");
  });

  it("opens a sub-page: it alone is aria-current, Sound reads as its open group, and the children stay listed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} initial="sound" />);
    await user.click(screen.getByRole("button", { name: "Equalizer" }));
    expect(onChange).toHaveBeenCalledWith("equalizer");
    const current = items().filter((item) => item.getAttribute("aria-current") === "page");
    expect(current.map((item) => item.textContent)).toEqual(["Equalizer"]);
    expect(screen.getByRole("button", { name: "Sound" })).toHaveClass("nav-item--ancestor");
    expect(screen.getByRole("button", { name: "Noise control" })).toBeInTheDocument();
    // Leaving the group folds it away again.
    await user.click(screen.getByRole("button", { name: "System" }));
    expect(screen.queryByRole("button", { name: "Equalizer" })).toBeNull();
    // The single tab stop follows to System; Up from it reaches Sound.
    expect(items().map((item) => item.tabIndex)).toEqual([-1, -1, 0, -1, -1, -1]);
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("button", { name: "Sound" })).toHaveFocus();
  });

  it("reaches the sub-pages with the arrows and opens them with Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} initial="sound" />);
    await user.tab();
    expect(screen.getByRole("button", { name: "Sound" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Equalizer" })).toHaveFocus();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("noise");
    expect(screen.getByRole("button", { name: "Noise control" })).toHaveAttribute("aria-current", "page");
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "System" })).toHaveFocus();
  });

  it("moves focus with the arrows, Home and End without opening, and opens on Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.tab();
    expect(items()[0]).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(items()[2]).toHaveFocus();
    expect(items()[2].tabIndex).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard("{End}");
    expect(items()[5]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(items()[5]).toHaveFocus(); // clamped at the end
    await user.keyboard("{Home}{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("sound");
    expect(items()[1]).toHaveAttribute("aria-current", "page");
  });

  it("opens a page on click and moves the tab stop there", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Devices" }));
    expect(screen.getByRole("button", { name: "Devices" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Devices" }).tabIndex).toBe(0);
    expect(screen.getByRole("button", { name: "Status" }).tabIndex).toBe(-1);
  });

  it("keeps the labels as accessible names and tooltips when collapsed, sub-pages included", () => {
    render(<Harness collapsed initial="noise" />);
    const noise = screen.getByRole("button", { name: "Noise control" });
    expect(noise).toHaveAttribute("title", "Noise control");
    expect(noise.querySelector(".nav-item__label")).toBeNull();
  });
});

describe("visibleNavTree and navTrail", () => {
  it("shows Sound's sub-pages only while Sound or one of them is open", () => {
    const shown = (page: NavPage) =>
      visibleNavTree(navPages, page).flatMap((node) => [node.item.value, ...node.children.map((c) => c.value)]);
    expect(shown("status")).toEqual(["status", "sound", "system", "devices", "windowsAudio", "settings"]);
    expect(shown("sound")).toEqual(["status", "sound", "equalizer", "noise", "system", "devices", "windowsAudio", "settings"]);
    expect(shown("equalizer")).toEqual(shown("sound"));
    expect(shown("noise")).toEqual(shown("sound"));
  });

  it("gives a sub-page its parent as the breadcrumb trail, a top-level page none", () => {
    expect(navTrail(navPages, "equalizer").map((item) => item.label)).toEqual(["Sound"]);
    expect(navTrail(navPages, "noise").map((item) => item.label)).toEqual(["Sound"]);
    expect(navTrail(navPages, "sound")).toEqual([]);
  });
});
