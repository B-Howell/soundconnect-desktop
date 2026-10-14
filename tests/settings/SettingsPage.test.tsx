import { act, render, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { AboutCard, SONY_DISCLAIMER } from "../../src/components/settings/AboutCard";
import { StartupRows } from "../../src/components/settings/StartupRows";
import { ThemePicker } from "../../src/components/settings/ThemePicker";
import { useApplyTheme } from "../../src/hooks/useApplyTheme";
import { useSettingsStore } from "../../src/state/settingsStore";
import { SettingsPage } from "../../src/pages/SettingsPage";
import upstreamLicense from "../../upstream/SonyHeadphonesClient/LICENSE?raw";

// The real file's first line, taken here without the component's paragraph logic.
const licenseFirstLine = upstreamLicense.split(/\r?\n/)[0];
const COMMIT = "4c91fe69711ce638a34e066d9bdcfaff504bbec8";

beforeEach(() => {
  window.localStorage.clear();
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  document.documentElement.removeAttribute("data-theme");
});

describe("useApplyTheme", () => {
  it("sets data-theme for light and dark and removes it for system", () => {
    renderHook(() => useApplyTheme());
    const root = document.documentElement;
    expect(root).not.toHaveAttribute("data-theme");

    act(() => useSettingsStore.getState().setTheme("dark"));
    expect(root).toHaveAttribute("data-theme", "dark");
    act(() => useSettingsStore.getState().setTheme("light"));
    expect(root).toHaveAttribute("data-theme", "light");
    act(() => useSettingsStore.getState().setTheme("system"));
    expect(root).not.toHaveAttribute("data-theme");
  });
});

describe("ThemePicker", () => {
  it("updates the store and <html data-theme> when a theme is picked", async () => {
    const user = userEvent.setup();
    renderHook(() => useApplyTheme());
    render(
      <ul>
        <ThemePicker />
      </ul>,
    );
    const row = screen.getByRole("button", { name: /Theme/ });
    expect(row).toHaveTextContent("System");

    await user.click(row);
    await user.click(within(screen.getByRole("dialog", { name: "Theme" })).getByRole("button", { name: "Light" }));
    expect(useSettingsStore.getState().theme).toBe("light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(row).toHaveTextContent("Light");

    await user.click(row);
    await user.click(within(screen.getByRole("dialog", { name: "Theme" })).getByRole("button", { name: "System" }));
    expect(useSettingsStore.getState().theme).toBe("system");
    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });
});

describe("StartupRows", () => {
  it("disables Start minimized until Start with Windows is on", async () => {
    const user = userEvent.setup();
    render(
      <ul>
        <StartupRows />
      </ul>,
    );
    const startMinimized = screen.getByRole("switch", { name: "Start minimized" });
    expect(startMinimized).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Keep running in the tray" })).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("switch", { name: "Start with Windows" }));
    expect(useSettingsStore.getState().startWithWindows).toBe(true);
    expect(startMinimized).toBeEnabled();

    await user.click(startMinimized);
    expect(useSettingsStore.getState().startMinimized).toBe(true);
  });
});

describe("AboutCard", () => {
  it("shows the version, the short engine commit, the upstream URL, credits and the Sony disclaimer", () => {
    render(<AboutCard version="0.1.0" engineCommit={COMMIT} />);
    expect(screen.getByRole("heading", { name: "SoundConnect Desktop" })).toBeInTheDocument();
    expect(screen.getByText("Version 0.1.0")).toBeInTheDocument();
    expect(screen.getByText("4c91fe6")).toHaveAttribute("title", COMMIT);
    expect(screen.getByRole("button", { name: "View licenses" })).toBeInTheDocument();
    expect(screen.getByText(/github\.com/).textContent).toBe("https://github.com/mos9527/SonyHeadphonesClient");
    expect(screen.getByText(/libmdr by mos9527 and contributors/)).toBeInTheDocument();
    expect(screen.getByText(SONY_DISCLAIMER)).toHaveTextContent(
      "Not affiliated with, endorsed by, or supported by Sony.",
    );
  });

  it("opens the licences sheet with the upstream MIT text and our licence line", async () => {
    const user = userEvent.setup();
    render(<AboutCard version="0.1.0" engineCommit={COMMIT} />);
    expect(licenseFirstLine).toBe("MIT License");

    await user.click(screen.getByRole("button", { name: "View licenses" }));
    const sheet = screen.getByRole("dialog", { name: "Licenses" });
    const license = within(sheet).getByRole("region", { name: "SonyHeadphonesClient and libmdr" });
    const paragraphs = Array.from(license.querySelectorAll("p"), (p) => p.textContent);
    expect(paragraphs[0]).toBe(licenseFirstLine);
    expect(paragraphs[2]).toMatch(/^Permission is hereby granted, free of charge, to any person obtaining a copy of/);
    expect(license).toHaveFocus();
    expect(within(sheet).getByText("SoundConnect Desktop itself: MIT License (see LICENSE)")).toBeInTheDocument();
  });
});

describe("SettingsPage", () => {
  it("has Appearance, Startup and About sections", () => {
    render(<SettingsPage />);
    for (const name of ["Appearance", "Startup", "About"]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
  });
});
