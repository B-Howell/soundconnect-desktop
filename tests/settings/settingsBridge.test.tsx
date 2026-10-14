import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StartupRows } from "../../src/components/settings/StartupRows";
import { tauriSettingsBridge, type SettingsBridge } from "../../src/lib/settingsBridge";
import { SettingsBridgeProvider } from "../../src/state/settingsBridgeContext";
import { useSettingsStore } from "../../src/state/settingsStore";
import { useSettingsSync } from "../../src/state/useSettingsSync";

const plugin = vi.hoisted(() => ({
  enable: vi.fn(async () => {}),
  disable: vi.fn(async () => {}),
  isEnabled: vi.fn(async () => true),
  invoke: vi.fn(async () => {}),
}));
vi.mock("@tauri-apps/plugin-autostart", () => ({
  enable: plugin.enable,
  disable: plugin.disable,
  isEnabled: plugin.isEnabled,
}));
vi.mock("@tauri-apps/api/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tauri-apps/api/core")>()),
  invoke: plugin.invoke,
}));

function spyBridge(overrides: Partial<SettingsBridge> = {}) {
  return {
    write: vi.fn<SettingsBridge["write"]>(async () => {}),
    setAutostart: vi.fn<SettingsBridge["setAutostart"]>(async () => {}),
    isAutostartEnabled: vi.fn<SettingsBridge["isAutostartEnabled"]>(async () => null),
    ...overrides,
  };
}

function wrapper(bridge: SettingsBridge) {
  return ({ children }: { children: ReactNode }) => (
    <SettingsBridgeProvider value={bridge}>{children}</SettingsBridgeProvider>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  vi.clearAllMocks();
});

describe("useSettingsSync", () => {
  it("writes the four values on mount and again only when one changes", () => {
    const bridge = spyBridge();
    const { unmount } = renderHook(() => useSettingsSync(), { wrapper: wrapper(bridge) });
    expect(bridge.write).toHaveBeenCalledTimes(1);
    expect(bridge.write).toHaveBeenLastCalledWith({
      theme: "system",
      startWithWindows: false,
      startMinimized: false,
      keepRunningInTray: true,
    });

    act(() => useSettingsStore.getState().setKeepRunningInTray(false));
    expect(bridge.write).toHaveBeenCalledTimes(2);
    expect(bridge.write).toHaveBeenLastCalledWith(expect.objectContaining({ keepRunningInTray: false }));

    act(() => useSettingsStore.getState().setKeepRunningInTray(false));
    expect(bridge.write).toHaveBeenCalledTimes(2);

    unmount();
    act(() => useSettingsStore.getState().setTheme("dark"));
    expect(bridge.write).toHaveBeenCalledTimes(2);
  });

  it("retries a failed write on the next change, even to the same values", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const bridge = spyBridge({ write: vi.fn(async () => Promise.reject(new Error("disk full"))) });
    renderHook(() => useSettingsSync(), { wrapper: wrapper(bridge) });
    await vi.waitFor(() => expect(error).toHaveBeenCalled());
    expect(bridge.write).toHaveBeenCalledTimes(1);
    act(() => useSettingsStore.getState().setTheme("system"));
    expect(bridge.write).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it("corrects Start with Windows to the real autostart entry once on mount", async () => {
    const bridge = spyBridge({ isAutostartEnabled: vi.fn(async () => true) });
    renderHook(() => useSettingsSync(), { wrapper: wrapper(bridge) });
    await vi.waitFor(() => expect(useSettingsStore.getState().startWithWindows).toBe(true));
    expect(bridge.setAutostart).not.toHaveBeenCalled();
    expect(bridge.write).toHaveBeenLastCalledWith(expect.objectContaining({ startWithWindows: true }));
  });

  it("calls settings_write with the values under `settings`", async () => {
    await tauriSettingsBridge.write({
      theme: "dark",
      startWithWindows: true,
      startMinimized: true,
      keepRunningInTray: false,
    });
    expect(plugin.invoke).toHaveBeenCalledWith("settings_write", {
      settings: { theme: "dark", startWithWindows: true, startMinimized: true, keepRunningInTray: false },
    });
  });
});

describe("Start with Windows", () => {
  it("the Tauri bridge calls the autostart plugin's enable and disable", async () => {
    await tauriSettingsBridge.setAutostart(true);
    expect(plugin.enable).toHaveBeenCalledTimes(1);
    await tauriSettingsBridge.setAutostart(false);
    expect(plugin.disable).toHaveBeenCalledTimes(1);
    await expect(tauriSettingsBridge.isAutostartEnabled()).resolves.toBe(true);
  });

  it("the switch stores the value and registers, then removes, the entry", async () => {
    const user = userEvent.setup();
    const bridge = spyBridge();
    render(<ul><StartupRows /></ul>, { wrapper: wrapper(bridge) });
    const toggle = screen.getByRole("switch", { name: "Start with Windows" });

    await user.click(toggle);
    expect(useSettingsStore.getState().startWithWindows).toBe(true);
    expect(bridge.setAutostart).toHaveBeenLastCalledWith(true);

    await user.click(toggle);
    expect(useSettingsStore.getState().startWithWindows).toBe(false);
    expect(bridge.setAutostart).toHaveBeenLastCalledWith(false);
  });

  it("puts the switch back when the plugin fails", async () => {
    const user = userEvent.setup();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const bridge = spyBridge({ setAutostart: vi.fn(async () => Promise.reject(new Error("registry denied"))) });
    render(<ul><StartupRows /></ul>, { wrapper: wrapper(bridge) });
    const toggle = screen.getByRole("switch", { name: "Start with Windows" });

    await user.click(toggle);
    await vi.waitFor(() => expect(useSettingsStore.getState().startWithWindows).toBe(false));
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
