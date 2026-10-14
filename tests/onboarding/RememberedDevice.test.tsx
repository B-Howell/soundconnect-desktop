/** Launch with remembered headphones: the Status card, manual Connect, the rail, auto-connect and the Settings rows. */
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { AppRoot } from "../../src/components/shell/AppRoot";
import type { RememberedDevice } from "../../src/lib/engine/types";
import { createEngineStore } from "../../src/state/engineStore";
import { useNavStore } from "../../src/state/navStore";
import { useSettingsStore } from "../../src/state/settingsStore";
import { useSetupStore } from "../../src/state/setupStore";
import { renderWithStore, spyApi, xm4 } from "../engine/engineTestKit";

const XM4 = "AA:BB:CC:12:34:56";
const remembered: RememberedDevice = {
  address: XM4,
  name: "WH-1000XM4",
  modelName: "WH-1000XM4",
  firmware: "2.9.0",
  protocol: "V1",
  lastSeen: 1760270000000,
};

/** A spy store that loaded the launch status with the XM4 remembered and auto-connect off. */
function rememberedStore() {
  const api = spyApi();
  const store = createEngineStore(api);
  store.getState().receiveStatus({ state: "disconnected", remembered });
  return { api, store };
}

const commands = (api: ReturnType<typeof spyApi>) => api.send.mock.calls.map(([command]) => command);

beforeEach(() => {
  window.localStorage.clear();
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  useSetupStore.setState(useSetupStore.getInitialState(), true);
  useNavStore.setState(useNavStore.getInitialState(), true);
});

describe("remembered headphones at launch", () => {
  it("are titled by model, never by the address a 0.1.3 profile stored as the name", () => {
    const store = createEngineStore(spyApi());
    store.getState().receiveStatus({ state: "disconnected", remembered: { ...remembered, name: XM4 } });
    renderWithStore(<AppRoot />, store);

    const page = screen.getByRole("region", { name: "Status" });
    expect(within(page).getByRole("heading", { name: "WH-1000XM4" })).toBeInTheDocument();
    expect(page).not.toHaveTextContent(XM4);
    expect(screen.getByRole("complementary")).not.toHaveTextContent(XM4);
  });

  it("say they are not connected and wait for Connect instead of searching", async () => {
    const user = userEvent.setup();
    const { api, store } = rememberedStore();
    renderWithStore(<AppRoot />, store);

    const page = screen.getByRole("region", { name: "Status" });
    expect(within(page).getByRole("heading", { name: "WH-1000XM4" })).toBeInTheDocument();
    expect(page).toHaveTextContent("Connected to Windows");
    expect(page).toHaveTextContent("Select Connect to control them from SoundConnect.");
    expect(page).not.toHaveTextContent("Looking for");
    expect(page.querySelector("img.device-image[data-model=\"WH-1000XM4\"]")).not.toBeNull();
    // The rail names the remembered headphones too.
    const rail = screen.getByRole("complementary");
    expect(rail).toHaveTextContent("WH-1000XM4");
    expect(rail).toHaveTextContent("Connected to Windows");
    // Nothing was asked of the engine but the stored auto-connect choice (off).
    await expect.poll(() => commands(api)).toEqual([{ type: "setAutoConnect", enabled: false }]);

    await user.click(within(page).getByRole("button", { name: "Open Bluetooth settings" }));
    expect(api.send).toHaveBeenLastCalledWith({ type: "openBluetoothSettings" });
    await user.click(within(page).getByRole("button", { name: "Connect" }));
    expect(api.send).toHaveBeenLastCalledWith({ type: "connect", address: XM4 });

    act(() => store.getState().receiveStatus({ state: "connecting", deviceName: "WH-1000XM4", address: XM4, remembered }));
    expect(within(page).getByRole("button", { name: "Connecting…" })).toBeDisabled();
    expect(rail).toHaveTextContent("Connecting…");
    // The pressed button turned disabled, so focus moved to the device's name instead of the page.
    expect(within(page).getByRole("heading", { name: "WH-1000XM4" })).toHaveFocus();

    act(() =>
      store.getState().receiveStatus({ state: "disconnected", address: XM4, reason: "busy", remembered }),
    );
    expect(page).toHaveTextContent("Couldn't connect");
    expect(page).toHaveTextContent(
      "Another app is controlling the headphones (for example the Sony app on your phone). Close it and try again.",
    );
    api.send.mockClear();
    await user.click(within(page).getByRole("button", { name: "Try again" }));
    expect(api.send).toHaveBeenCalledWith({ type: "connect", address: XM4 });
  });

  it("do not open the setup wizard", () => {
    const { store } = rememberedStore();
    renderWithStore(<AppRoot />, store);
    expect(screen.queryByRole("heading", { name: "Welcome to SoundConnect" })).toBeNull();
    expect(screen.getByRole("navigation", { name: "Pages" })).toBeInTheDocument();
  });
});

describe("setup while headphones are remembered", () => {
  it("keeps Cancel and the remembered card when another device fails", async () => {
    const user = userEvent.setup();
    const { store } = rememberedStore();
    useSetupStore.getState().openSetup("choose");
    renderWithStore(<AppRoot />, store);
    await user.click(screen.getByRole("button", { name: "Scan" }));
    act(() =>
      store.getState().receiveDevices({ devices: [{ address: "F8:4E:17:00:00:01", name: "WF-1000XM5", remembered: false }] }),
    );
    await user.click(screen.getByRole("button", { name: /WF-1000XM5/ }));
    // The engine names the device it tried, so its status carries no profile.
    act(() =>
      store.getState().receiveStatus({ state: "disconnected", address: "F8:4E:17:00:00:01", reason: "notConnectedToWindows", remembered: null }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("They are off, out of range, or not connected to Windows.");
    await user.click(screen.getByRole("button", { name: "Cancel setup" }));
    expect(within(screen.getByRole("region", { name: "Status" })).getByRole("heading", { name: "WH-1000XM4" })).toBeInTheDocument();
  });

  it("does not skip to All set after Forget when an earlier Connect succeeded", async () => {
    const user = userEvent.setup();
    const { store } = rememberedStore();
    renderWithStore(<AppRoot />, store);
    await user.click(screen.getByRole("button", { name: "Connect" }));
    act(() => {
      store.getState().receiveStatus({ state: "ready", deviceName: "WH-1000XM4", address: XM4, protocol: "V1", remembered });
      store.getState().receiveSnapshot(xm4());
    });
    expect(store.getState().attempt?.phase).toBe("connected");
    act(() => store.getState().forgetDevice(XM4));
    act(() => store.getState().receiveStatus({ state: "disconnected", remembered: null }));
    await user.click(screen.getByRole("button", { name: "Get started" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { level: 1, name: "Choose your headphones" })).toBeInTheDocument();
  });

  it("does not open the wizard when the first status read fails", async () => {
    const api = spyApi();
    api.status = async () => {
      throw new Error("engine_status failed");
    };
    const store = createEngineStore(api);
    await store.getState().load();
    renderWithStore(<AppRoot />, store);
    expect(screen.queryByRole("heading", { name: "Welcome to SoundConnect" })).toBeNull();
    expect(screen.getByRole("navigation", { name: "Pages" })).toBeInTheDocument();
  });
});

describe("Settings: Headphones", () => {
  it("sends setAutoConnect when Connect automatically is switched, and stores it", async () => {
    const user = userEvent.setup();
    const { api, store } = rememberedStore();
    useNavStore.getState().setPage("settings");
    renderWithStore(<AppRoot />, store);
    const toggle = screen.getByRole("switch", { name: "Connect automatically when the headphones appear" });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    expect(useSettingsStore.getState().autoConnect).toBe(true);
    await expect.poll(() => commands(api).slice(-1)[0]).toEqual({ type: "setAutoConnect", enabled: true });
  });

  it("reopens the wizard at Pair with Windows, with Cancel back to the app", async () => {
    const user = userEvent.setup();
    const { store } = rememberedStore();
    useNavStore.getState().setPage("settings");
    renderWithStore(<AppRoot />, store);
    await user.click(screen.getByRole("button", { name: /Set up new headphones/ }));
    expect(screen.getByRole("heading", { level: 1, name: "Pair with Windows" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Pages" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Cancel setup" }));
    expect(screen.getByRole("heading", { level: 1, name: "Status" })).toBeInTheDocument();
  });

  it("forgets the headphones only after the confirmation, then returns to setup", async () => {
    const user = userEvent.setup();
    const { api, store } = rememberedStore();
    useNavStore.getState().setPage("settings");
    renderWithStore(<AppRoot />, store);

    await user.click(screen.getByRole("button", { name: /Forget these headphones/ }));
    const sheet = screen.getByRole("dialog", { name: "Forget WH-1000XM4?" });
    expect(within(sheet).getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.click(within(sheet).getByRole("button", { name: "Cancel" }));
    expect(commands(api).some((c) => c.type === "forgetDevice")).toBe(false);

    await user.click(screen.getByRole("button", { name: /Forget these headphones/ }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Forget" }));
    await expect.poll(() => commands(api).slice(-1)[0]).toEqual({ type: "forgetDevice", address: XM4 });

    // The engine confirms with no remembered device: setup opens again.
    act(() => store.getState().receiveStatus({ state: "disconnected", remembered: null }));
    expect(screen.getByRole("heading", { level: 1, name: "Welcome to SoundConnect" })).toBeInTheDocument();
  });
});
