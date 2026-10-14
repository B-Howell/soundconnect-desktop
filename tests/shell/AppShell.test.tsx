import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "../../src/components/shell/AppShell";
import { INFO_ALERT_MS } from "../../src/hooks/engine/useAlertBannerProps";
import { createMockEngineApi } from "../../src/lib/engine/mockApi";
import { createEngineStore } from "../../src/state/engineStore";
import { useEngineBootstrap } from "../../src/state/useEngineBootstrap";
import { useNavStore } from "../../src/state/navStore";
import { connectedStore, readyStatus, renderWithStore, spyApi, xm4 } from "../engine/engineTestKit";

/** The app's own wiring: bootstrap once, then the shell. */
function BootstrappedShell() {
  useEngineBootstrap();
  return <AppShell />;
}

describe("AppShell", () => {
  beforeEach(() => useNavStore.setState(useNavStore.getInitialState(), true));
  afterEach(() => vi.useRealTimers());

  it("opens on Status in the searching state, never a fake connected device", () => {
    renderWithStore(<AppShell />, createEngineStore(spyApi()));
    expect(screen.getByRole("heading", { level: 1, name: "Status" })).toBeInTheDocument();
    const page = screen.getByRole("region", { name: "Status" });
    expect(page).toHaveTextContent("No headphones set up");
    expect(screen.queryByRole("meter")).toBeNull();
    // The rail still renders while nothing is connected, with every page enabled.
    const nav = screen.getByRole("navigation", { name: "Pages" });
    expect(within(nav).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Status",
      "Sound",
      "System",
      "Devices",
      "Windows audio",
      "Settings",
    ]);
    for (const item of within(nav).getAllByRole("button")) expect(item).toBeEnabled();
    expect(within(nav).getByRole("button", { name: "Status" })).toHaveAttribute("aria-current", "page");
    expect(within(screen.getByRole("complementary")).getByText("No headphones set up")).toBeInTheDocument();
  });

  it("switches the page and its title when a rail item is chosen", async () => {
    const user = userEvent.setup();
    renderWithStore(<AppShell />, createEngineStore(spyApi()));
    await user.click(screen.getByRole("button", { name: "Devices" }));
    expect(screen.getByRole("heading", { level: 1, name: "Devices" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Devices" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Status" })).not.toHaveAttribute("aria-current");
    // While it fades out, the leaving page is hidden from assistive tech.
    const leaving = document.querySelector(".connection-state__title");
    expect(leaving).toHaveTextContent("No headphones set up");
    expect(leaving?.closest("[aria-hidden='true'][inert]")).not.toBeNull();
    expect(screen.getByRole("region", { name: "Devices" })).toHaveTextContent(
      "Connect headphones to change these settings.",
    );
    // The leaving page fades out; once gone, only the new page remains.
    await waitFor(() => expect(document.querySelector(".connection-state__title")).toBeNull());
  });

  it("opens Equalizer from the Sound overview's entry card, titles it 'Sound › Equalizer', and the crumb goes back", async () => {
    const user = userEvent.setup();
    renderWithStore(<AppShell />, connectedStore());
    await user.click(screen.getByRole("button", { name: "Sound" }));
    const sound = screen.getByRole("region", { name: "Sound" });
    await user.click(within(sound).getByRole("button", { name: /^Equalizer, Bright/ }));
    expect(useNavStore.getState().page).toBe("equalizer");
    expect(screen.getByRole("heading", { level: 1, name: "Equalizer" })).toBeInTheDocument();
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    const nav = screen.getByRole("navigation", { name: "Pages" });
    expect(within(nav).getByRole("button", { name: "Equalizer" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("button", { name: "Sound" })).not.toHaveAttribute("aria-current");
    await user.click(within(crumbs).getByRole("button", { name: "Sound" }));
    expect(useNavStore.getState().page).toBe("sound");
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).toBeNull();
  });

  it("opens Noise control from its entry card, showing the recorded mode", async () => {
    const user = userEvent.setup();
    renderWithStore(<AppShell />, connectedStore());
    await user.click(screen.getByRole("button", { name: "Sound" }));
    const sound = screen.getByRole("region", { name: "Sound" });
    await user.click(within(sound).getByRole("button", { name: "Noise control, Noise cancelling, Blocks surrounding sound" }));
    expect(useNavStore.getState().page).toBe("noise");
    expect(screen.getByRole("heading", { level: 1, name: "Noise control" })).toBeInTheDocument();
  });

  it("reaches Ready from the mock engine and shows the recorded device", async () => {
    const store = createEngineStore(createMockEngineApi(xm4(), { stepMs: 10, autoConnect: true }));
    renderWithStore(<BootstrappedShell />, store);
    // The remembered card also names the device, so wait for the connected card's battery meter.
    expect(await screen.findByRole("meter", { name: "Battery" })).toHaveAttribute("aria-valuetext", "90%");
    expect(screen.getByRole("heading", { name: "WH-1000XM4" })).toBeInTheDocument();
    // The rail's device block shows the same device with battery and codec chips; the battery
    // stands in for a "Connected" line.
    const nav = screen.getByRole("complementary");
    expect(within(nav).queryByText("Connected")).toBeNull();
    expect(nav).toHaveTextContent("Battery 90%");
    expect(nav).toHaveTextContent("Codec AAC");
  });
});

describe("AppShell connection announcer", () => {
  beforeEach(() => useNavStore.setState(useNavStore.getInitialState(), true));

  it("keeps one status region, swapping only its text, across states and tab switches", async () => {
    const user = userEvent.setup();
    const store = createEngineStore(spyApi());
    renderWithStore(<AppShell />, store);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("No headphones set up");

    act(() => store.getState().receiveStatus({ state: "connecting", deviceName: "WH-1000XM4" }));
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent("Connecting…");

    await user.click(screen.getByRole("button", { name: "System" }));
    act(() => store.getState().receiveStatus(readyStatus));
    act(() => store.getState().receiveSnapshot(xm4()));
    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent("Connected.");
  });

  it("fills the alert region only while an error shows", () => {
    const store = createEngineStore(spyApi());
    renderWithStore(<AppShell />, store);
    const alert = screen.getByRole("alert");
    expect(alert).toBeEmptyDOMElement();
    act(() => store.getState().receiveStatus({ state: "disconnected", lastError: "timeout" }));
    expect(screen.getByRole("alert")).toBe(alert);
    expect(alert).toHaveTextContent("Connection failed.");
    expect(alert).not.toHaveTextContent("Try again");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});

describe("AppShell alert banner", () => {
  beforeEach(() => useNavStore.setState(useNavStore.getInitialState(), true));
  afterEach(() => vi.useRealTimers());

  it("asks, and OK answers the headphones yes", async () => {
    const api = spyApi();
    const store = connectedStore(api);
    renderWithStore(<AppShell />, store);
    act(() => store.getState().receiveAlert({ message: "SOME_DEVICE_QUESTION", autoResponse: null }));
    expect(screen.getByText("Some device question")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.queryByText("Some device question")).toBeNull();
    await waitFor(() => expect(api.send).toHaveBeenCalledWith({ type: "respondToAlert", positive: true }));
  });

  it("shows an alert the engine already answered as information that hides itself", () => {
    vi.useFakeTimers();
    const api = spyApi();
    const store = connectedStore(api);
    renderWithStore(<AppShell />, store);
    act(() =>
      store.getState().receiveAlert({ message: "DISCONNECT_CAUSED_BY_CONNECTION_MODE_CHANGE", autoResponse: "negative" }),
    );
    expect(screen.getByText("Setting changed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Not now" })).toBeNull();
    act(() => vi.advanceTimersByTime(INFO_ALERT_MS));
    expect(screen.queryByText("Setting changed")).toBeNull();
    expect(api.send).not.toHaveBeenCalled();
  });
});
