import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpdateRows } from "../../src/components/settings/UpdateRows";
import { UpdateBannerHost } from "../../src/components/updates/UpdateBannerHost";
import { useAutoUpdateCheck, UPDATE_CHECK_INTERVAL_MS } from "../../src/hooks/updates/useAutoUpdateCheck";
import { updateErrorText, type AvailableUpdate, type UpdaterApi } from "../../src/lib/updater/api";
import { SETTINGS_DEFAULTS, useSettingsStore } from "../../src/state/settingsStore";
import { createUpdaterStore, type UpdaterStore } from "../../src/state/updaterStore";

/** An updater api whose check and install the test controls. */
function mockApi(update: AvailableUpdate | null | Error) {
  const api = {
    check: vi.fn(async () => {
      if (update instanceof Error) throw update;
      return update;
    }),
    relaunch: vi.fn(async () => undefined),
  } satisfies UpdaterApi;
  return api;
}

/** An update whose install reports progress through `steps`, then resolves or rejects. */
function fakeUpdate(steps: (number | null)[] = [0, 0.5, 1], fail?: Error) {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const update: AvailableUpdate = {
    version: "0.1.10",
    notes: "- Something new.",
    install: vi.fn(async (onProgress) => {
      for (const step of steps.slice(0, -1)) onProgress(step);
      await gate;
      if (fail) throw fail;
      onProgress(steps[steps.length - 1] ?? 1);
    }),
  };
  return { update, release: () => release() };
}

function renderHost(store: UpdaterStore) {
  return render(<UpdateBannerHost store={store} />);
}

beforeEach(() => {
  useSettingsStore.setState({ ...SETTINGS_DEFAULTS });
});

describe("update banner", () => {
  it("shows nothing when there is no update", async () => {
    const store = createUpdaterStore(mockApi(null));
    renderHost(store);
    await act(() => store.getState().check());
    expect(store.getState().phase).toBe("upToDate");
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("announces an available update with Install, Later and What's new", async () => {
    const user = userEvent.setup();
    const { update } = fakeUpdate();
    const store = createUpdaterStore(mockApi(update));
    renderHost(store);
    await act(() => store.getState().check());
    const banner = screen.getByRole("status");
    // One line, no sentence under it.
    expect(banner).toHaveTextContent("Version 0.1.10 is available.");
    expect(banner.querySelector(".alert-banner__message")).toBeNull();
    await user.click(within(banner).getByRole("button", { name: "What's new" }));
    const sheet = await screen.findByRole("dialog", { name: "What's new in 0.1.10" });
    expect(sheet).toHaveTextContent("- Something new.");
    expect(sheet).toHaveTextContent("releases/tag/v0.1.10");
    await user.click(within(sheet).getByRole("button", { name: "Close" }));
    await user.click(within(screen.getByRole("status")).getByRole("button", { name: "Later" }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows a progress bar while downloading, then installs and relaunches", async () => {
    const user = userEvent.setup();
    const api = mockApi(null);
    const { update, release } = fakeUpdate([0, 0.5, 1]);
    api.check.mockResolvedValue(update);
    const store = createUpdaterStore(api);
    renderHost(store);
    await act(() => store.getState().check());
    await user.click(screen.getByRole("button", { name: "Install" }));
    const banner = await screen.findByRole("status");
    expect(banner).toHaveTextContent("Downloading update… 50%");
    expect(within(banner).getByRole("progressbar", { name: "Download progress" })).toHaveAttribute("value", "0.5");
    await act(async () => release());
    await waitFor(() => expect(api.relaunch).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveTextContent("Installing update…");
  });

  it("shows a failed signature check plainly and retries the same update", async () => {
    const user = userEvent.setup();
    const { update, release } = fakeUpdate([0, 1], new Error("signature verification failed"));
    const store = createUpdaterStore(mockApi(update));
    renderHost(store);
    await act(() => store.getState().check());
    await user.click(screen.getByRole("button", { name: "Install" }));
    await act(async () => release());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Update failed");
    expect(alert).toHaveTextContent("Signature check failed.");
    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(update.install).toHaveBeenCalledTimes(2);
  });

  it("says plainly when the update server cannot be reached", async () => {
    const store = createUpdaterStore(mockApi(new Error("error sending request for url (https://github.com/...)")));
    renderHost(store);
    await act(() => store.getState().check());
    expect(screen.getByRole("alert")).toHaveTextContent("Can't reach the update server.");
  });
});

describe("a failed check after an update was found", () => {
  it("retries the check, not the install", async () => {
    const user = userEvent.setup();
    const { update } = fakeUpdate();
    const api = mockApi(update);
    const store = createUpdaterStore(api);
    renderHost(store);
    await act(() => store.getState().check());
    api.check.mockRejectedValueOnce(new Error("network unreachable"));
    await act(() => store.getState().check());
    await user.click(within(screen.getByRole("alert")).getByRole("button", { name: "Try again" }));
    expect(api.check).toHaveBeenCalledTimes(3);
    expect(update.install).not.toHaveBeenCalled();
  });
});

describe("update error text", () => {
  it("maps offline and signature failures, else passes the message on", () => {
    expect(updateErrorText(new Error("Network error"))).toBe("Can't reach the update server.");
    expect(updateErrorText("InvalidSignature")).toBe("Signature check failed.");
    expect(updateErrorText(new Error("disk full"))).toBe("disk full");
  });
});

describe("Settings update rows", () => {
  it("checks on demand and reports the result; the automatic switch is on by default", async () => {
    const user = userEvent.setup();
    const api = mockApi(null);
    const store = createUpdaterStore(api);
    render(
      <ul>
        <UpdateRows store={store} />
      </ul>,
    );
    expect(screen.getByRole("switch", { name: "Check for updates automatically" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Check now" }));
    expect(api.check).toHaveBeenCalledOnce();
    expect(await screen.findByText("Up to date.")).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Check for updates automatically" }));
    expect(useSettingsStore.getState().checkForUpdates).toBe(false);
  });
});

function AutoCheck({ store }: { store: UpdaterStore }) {
  useAutoUpdateCheck(store, 0);
  return null;
}

describe("automatic check", () => {
  it("checks once a day at launch, and never when switched off", async () => {
    const api = mockApi(null);
    const store = createUpdaterStore(api);
    const first = render(<AutoCheck store={store} />);
    await waitFor(() => expect(api.check).toHaveBeenCalledOnce());
    const stamp = useSettingsStore.getState().lastUpdateCheck;
    expect(stamp).toBeGreaterThan(0);
    first.unmount();

    // A second launch the same day does not check again.
    const second = render(<AutoCheck store={store} />);
    await new Promise((r) => setTimeout(r, 10));
    expect(api.check).toHaveBeenCalledOnce();
    second.unmount();

    // A day later it does, unless the switch is off.
    useSettingsStore.setState({ lastUpdateCheck: stamp - UPDATE_CHECK_INTERVAL_MS, checkForUpdates: false });
    const third = render(<AutoCheck store={store} />);
    await new Promise((r) => setTimeout(r, 10));
    expect(api.check).toHaveBeenCalledOnce();
    third.unmount();
  });
});
