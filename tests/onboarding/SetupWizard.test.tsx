/** The first-run setup wizard, driven through AppRoot over a spy engine (commands) or the mock (the whole flow). */
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { AppRoot } from "../../src/components/shell/AppRoot";
import { createMockEngineApi } from "../../src/lib/engine/mockApi";
import type { ConnectFailureReason } from "../../src/lib/engine/types";
import { createEngineStore } from "../../src/state/engineStore";
import { useEngineBootstrap } from "../../src/state/useEngineBootstrap";
import { useNavStore } from "../../src/state/navStore";
import { useSettingsStore } from "../../src/state/settingsStore";
import { useSetupStore } from "../../src/state/setupStore";
import { renderWithStore, spyApi, xm4 } from "../engine/engineTestKit";

const XM4 = "AA:BB:CC:12:34:56";

function Bootstrapped() {
  useEngineBootstrap();
  return <AppRoot />;
}

/** A spy store that has loaded a first-run status (nothing remembered). */
function firstRunStore() {
  const api = spyApi();
  const store = createEngineStore(api);
  store.getState().receiveStatus({ state: "disconnected", remembered: null });
  return { api, store };
}

const sentTypes = (api: ReturnType<typeof spyApi>) => api.send.mock.calls.map(([command]) => command);

beforeEach(() => {
  window.localStorage.clear();
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  useSetupStore.setState(useSetupStore.getInitialState(), true);
  useNavStore.setState(useNavStore.getInitialState(), true);
});

describe("setup wizard", () => {
  it("opens on first run without the rail, and each step sends its command", async () => {
    const user = userEvent.setup();
    const { api, store } = firstRunStore();
    renderWithStore(<AppRoot />, store);

    // Welcome: no navigation rail, the disclaimer, nothing scanned or connected.
    expect(screen.getByRole("heading", { level: 1, name: "Welcome to SoundConnect" })).toHaveFocus();
    expect(screen.queryByRole("navigation", { name: "Pages" })).toBeNull();
    expect(screen.getByText(/Not affiliated with, endorsed by, or supported by Sony/)).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
    await expect.poll(() => sentTypes(api)).toEqual([{ type: "setAutoConnect", enabled: false }]);

    // Pair with Windows: over-ear first; earbuds switch; the button opens Windows' page.
    await user.click(screen.getByRole("button", { name: "Get started" }));
    expect(screen.getByRole("heading", { level: 1, name: "Pair with Windows" })).toBeInTheDocument();
    // Two bullets per family, one short sentence each.
    expect(screen.getByText("With the headphones off, hold the power button for 7 seconds.")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "With the headphones off, hold the power button for 7 seconds.",
      "In Bluetooth settings, select Add device, then the headphones.",
    ]);
    await user.click(screen.getByRole("radio", { name: "Earbuds" }));
    expect(screen.getByText(/both touch sensors/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Bluetooth settings" }));
    expect(api.send).toHaveBeenLastCalledWith({ type: "openBluetoothSettings" });

    // Choose: Scan sends scan; the answer lists devices; a pick sends connect {address}.
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { level: 1, name: "Choose headphones" })).toBeInTheDocument();
    expect(sentTypes(api).some((c) => c.type === "scan" || c.type === "connect")).toBe(false);
    await user.click(screen.getByRole("button", { name: "Scan" }));
    expect(api.send).toHaveBeenLastCalledWith({ type: "scan" });
    // Still focusable (disabling it would drop focus); a second press sends nothing.
    await user.click(screen.getByRole("button", { name: "Scanning…" }));
    expect(sentTypes(api).filter((c) => c.type === "scan")).toHaveLength(1);
    act(() =>
      store.getState().receiveDevices({
        devices: [
          { address: XM4, name: "WH-1000XM4", remembered: false },
          { address: "F8:4E:17:00:00:01", name: "WF-1000XM5", remembered: false },
        ],
      }),
    );
    const list = screen.getByRole("list", { name: "Bluetooth devices" });
    await user.click(within(list).getByRole("button", { name: /WH-1000XM4/ }));
    expect(api.send).toHaveBeenLastCalledWith({ type: "connect", address: XM4 });
    expect(within(list).getByText("Connecting…")).toBeInTheDocument();
    // Focus stays on the pressed row; a second pick while connecting sends nothing.
    expect(within(list).getByRole("button", { name: /WH-1000XM4/ })).toHaveFocus();
    await user.click(within(list).getByRole("button", { name: /WF-1000XM5/ }));
    expect(sentTypes(api).filter((c) => c.type === "connect")).toHaveLength(1);
    // The other device's statuses do not end the attempt.
    act(() => store.getState().receiveStatus({ state: "disconnected", address: "F8:4E:17:00:00:01", reason: "busy", remembered: null }));
    expect(screen.queryByRole("alert")).toBeNull();

    // Ready with a snapshot: Setup complete with model and firmware; Done opens the app on Status.
    act(() => {
      store.getState().receiveStatus({ state: "ready", deviceName: "WH-1000XM4", address: XM4, protocol: "V1" });
      store.getState().receiveSnapshot(xm4());
    });
    expect(screen.getByRole("heading", { level: 1, name: "Setup complete" })).toBeInTheDocument();
    const details = screen.getByRole("list", { name: "Headphones" });
    expect(details).toHaveTextContent("WH-1000XM4");
    expect(details).toHaveTextContent("2.9.0");
    expect(document.querySelector("img.device-image[data-model=\"WH-1000XM4\"]")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(useSettingsStore.getState().onboardingDone).toBe(true);
    expect(screen.getByRole("navigation", { name: "Pages" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Status" })).toBeInTheDocument();
  });

  it.each<[ConnectFailureReason, string]>([
    ["notConnectedToWindows", "Headphones off or disconnected."],
    ["busy", "Another app is using the headphones."],
    ["timeout", "Connection timed out."],
    ["refused", "Connection refused."],
  ])("shows the %s failure and retries the same device", async (reason, text) => {
    const user = userEvent.setup();
    const { api, store } = firstRunStore();
    useSetupStore.getState().openSetup("choose");
    renderWithStore(<AppRoot />, store);
    await user.click(screen.getByRole("button", { name: "Scan" }));
    act(() => store.getState().receiveDevices({ devices: [{ address: XM4, name: "WH-1000XM4", remembered: false }] }));
    await user.click(screen.getByRole("button", { name: /WH-1000XM4/ }));
    act(() => store.getState().receiveStatus({ state: "disconnected", address: XM4, reason, remembered: null }));
    expect(screen.getByRole("alert")).toHaveTextContent(text);
    api.send.mockClear();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(api.send).toHaveBeenCalledWith({ type: "connect", address: XM4 });
  });

  it("runs end to end against the mock engine, which remembers the device afterwards", async () => {
    const user = userEvent.setup();
    const store = createEngineStore(createMockEngineApi(xm4(), { stepMs: 10, scanMs: 10, remembered: false }));
    renderWithStore(<Bootstrapped />, store);
    await user.click(await screen.findByRole("button", { name: "Get started" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Scan" }));
    await user.click(await screen.findByRole("button", { name: /WH-1000XM4/ }));
    expect(await screen.findByRole("heading", { level: 1, name: "Setup complete" })).toBeInTheDocument();
    expect(store.getState().status.remembered?.address).toBe(XM4);
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(await screen.findByRole("meter", { name: "Battery" })).toBeInTheDocument();
  });

  it("starts at Pair with Windows once setup was finished before, and offers no Cancel without a remembered device", () => {
    useSettingsStore.getState().setOnboardingDone(true);
    const { store } = firstRunStore();
    renderWithStore(<AppRoot />, store);
    expect(screen.getByRole("heading", { level: 1, name: "Pair with Windows" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  it("shows nothing but the frame until the first status arrives", () => {
    renderWithStore(<AppRoot />, createEngineStore(spyApi()));
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Pages" })).toBeNull();
  });
});
