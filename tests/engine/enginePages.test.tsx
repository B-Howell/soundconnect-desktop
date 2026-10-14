/** The pages wired to the engine store, driven with the recorded XM4 payload. */
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { applyCommand } from "../../src/lib/engine/applyCommand";
import { SLIDER_SEND_INTERVAL_MS } from "../../src/hooks/engine/useEngineCommand";
import { DevicesPage } from "../../src/pages/DevicesPage";
import { EqualizerPage } from "../../src/pages/EqualizerPage";
import { NoiseControlPage } from "../../src/pages/NoiseControlPage";
import { StatusPage } from "../../src/pages/StatusPage";
import { SoundPage } from "../../src/pages/SoundPage";
import { SystemPage } from "../../src/pages/SystemPage";
import type { SnapshotPayload } from "../../src/lib/engine/types";
import { createEngineStore } from "../../src/state/engineStore";
import { connectedStore, renderWithStore, spyApi, xm4, type SpyApi } from "./engineTestKit";

const sent = (api: SpyApi) => api.send.mock.calls.map((call) => call[0]);

describe("StatusPage", () => {
  it("shows searching from a Disconnected status, with no device data", () => {
    renderWithStore(<StatusPage />, createEngineStore(spyApi()));
    expect(screen.getByRole("heading", { name: "Looking for your headphones" })).toBeInTheDocument();
    expect(screen.queryByRole("meter")).toBeNull();
  });

  it("shows the device card, quick noise switch and now playing from the recorded snapshot", () => {
    renderWithStore(<StatusPage />, connectedStore());
    expect(screen.getByRole("heading", { name: "WH-1000XM4" })).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Battery" })).toHaveAttribute("aria-valuetext", "90%");
    expect(screen.getByText("AAC")).toBeInTheDocument();
    expect(screen.getByText("Firmware 2.9.0")).toBeInTheDocument();
    const noise = screen.getByRole("region", { name: "Noise control" });
    expect(within(noise).getAllByRole("radio").map((r) => r.textContent)).toEqual([
      "Noise cancelling",
      "Ambient sound",
      "Off",
    ]);
    expect(within(noise).getByRole("radio", { name: "Noise cancelling" })).toHaveAttribute("aria-checked", "true");
    expect(within(noise).queryByRole("slider")).toBeNull();
    const playing = screen.getByRole("region", { name: "Now playing" });
    expect(within(playing).getByText('Sample Artist - "Sample Track" (Live)')).toBeInTheDocument();
    expect(within(playing).getByRole("slider", { name: "Volume" })).toHaveAttribute("aria-valuetext", "12");
  });

  it("sends setNoise {mode: cancelling} from the quick switch", async () => {
    const user = userEvent.setup();
    const api = spyApi();
    renderWithStore(<StatusPage />, connectedStore(api, applyCommand(xm4(), { type: "setAmbientLevel", level: 7 })));
    await user.click(screen.getByRole("radio", { name: "Noise cancelling" }));
    await waitFor(() => expect(sent(api)).toEqual([{ type: "setNoise", mode: "cancelling" }]));
  });

  it("shows an optimistic change at once and keeps it when the device's snapshot confirms it", async () => {
    const user = userEvent.setup();
    const api = spyApi();
    const store = connectedStore(api);
    renderWithStore(<StatusPage />, store);
    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(store.getState().patches).toHaveLength(1);
    act(() => store.getState().receiveSnapshot(applyCommand(xm4(), { type: "playback", action: "pause" })));
    expect(store.getState().patches).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });
});

describe("NoiseControlPage", () => {
  const ambientSlider = () => screen.getByRole("slider", { name: "Ambient sound level" });

  it("asks to connect while disconnected", () => {
    renderWithStore(<NoiseControlPage />, createEngineStore(spyApi()));
    expect(screen.getByText("Connect your headphones to change these settings.")).toBeInTheDocument();
  });

  it("shows the recorded cancelling state on the slider's first stop and the button function", () => {
    renderWithStore(<NoiseControlPage />, connectedStore());
    expect(ambientSlider()).toHaveAttribute("aria-valuetext", "Noise cancelling");
    const button = screen.getByRole("region", { name: "Button function" });
    expect(within(button).getByRole("button")).toHaveTextContent("Ambient sound control");
    expect(screen.getByRole("region", { name: "Only in the phone app" })).toHaveTextContent("Adaptive Sound Control");
  });

  it("sends the slider's stops: wind as setNoise, levels as setAmbientLevel, the final value once", async () => {
    const api = spyApi();
    const store = connectedStore(api);
    renderWithStore(<NoiseControlPage />, store);
    fireEvent.pointerDown(ambientSlider(), { button: 0, pointerId: 1 });
    expect(store.getState().held).toEqual(["noise"]);
    fireEvent.change(ambientSlider(), { target: { value: "1" } });
    await new Promise((resolve) => setTimeout(resolve, SLIDER_SEND_INTERVAL_MS + 20));
    fireEvent.change(ambientSlider(), { target: { value: "13" } });
    fireEvent.change(ambientSlider(), { target: { value: "16" } });
    fireEvent.pointerUp(ambientSlider(), { pointerId: 1 });
    expect(store.getState().held).toEqual([]);
    // Past the throttle interval: the pending live value was dropped, not sent late.
    await new Promise((resolve) => setTimeout(resolve, SLIDER_SEND_INTERVAL_MS + 50));
    expect(sent(api)).toEqual([
      { type: "setNoise", mode: "wind" },
      { type: "setAmbientLevel", level: 12 },
      { type: "setAmbientLevel", level: 15 },
    ]);
    expect(screen.getByRole("radio", { name: "Ambient sound" })).toHaveAttribute("aria-checked", "true");
  });

  it("releases the slider's echo hold when it unmounts mid-gesture", () => {
    const store = connectedStore(spyApi(), applyCommand(xm4(), { type: "setAmbientLevel", level: 7 }));
    const { unmount } = renderWithStore(<NoiseControlPage />, store);
    fireEvent.pointerDown(ambientSlider(), { button: 0, pointerId: 1 });
    expect(store.getState().held).toEqual(["noise"]);
    unmount();
    expect(store.getState().held).toEqual([]);
  });
});

describe("SoundPage", () => {
  it("asks to connect while disconnected", () => {
    renderWithStore(<SoundPage />, createEngineStore(spyApi()));
    expect(screen.getByText("Connect your headphones to change these settings.")).toBeInTheDocument();
  });

  it("shows the equalizer only as an entry card (the controls are on its sub-page)", () => {
    renderWithStore(<SoundPage />, connectedStore());
    const eq = screen.getByRole("button", { name: "Equalizer, Bright, Clear Bass −1" });
    // The recorded Bright curve from the XM4 preset fixture.
    expect(eq.querySelector(".eq-sparkline__line")).not.toBeNull();
    expect(screen.queryByRole("slider", { name: "400 Hz" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Preset/ })).toBeNull();
    expect(screen.queryByRole("switch", { name: "Upscaling" })).toBeNull();
  });
});

describe("EqualizerPage", () => {
  it("asks to connect while disconnected", () => {
    renderWithStore(<EqualizerPage />, createEngineStore(spyApi()));
    expect(screen.getByText("Connect your headphones to change these settings.")).toBeInTheDocument();
  });

  it("shows the recorded curve, presets with sparklines from the XM4 fixture, sliders and DSEE", () => {
    const { container } = renderWithStore(<EqualizerPage />, connectedStore());
    expect(screen.getByRole("img", { name: /^Equalizer curve: Clear Bass −1, 400 Hz 0, 1 kHz \+5/ })).toBeInTheDocument();
    const presets = screen.getByRole("group", { name: "Equalizer presets" });
    const names = within(presets)
      .getAllByRole("button")
      .map((button) => button.querySelector(".preset-grid__name")?.textContent);
    expect(names).toEqual([
      "Off",
      "Bright",
      "Excited",
      "Mellow",
      "Relaxed",
      "Vocal",
      "Treble",
      "Bass",
      "Speech",
      "Custom",
      "User Setting 1",
      "User Setting 2",
    ]);
    expect(within(presets).getByRole("button", { name: "Bright" })).toHaveAttribute("aria-pressed", "true");
    // Recorded sparklines for the nine fixed presets, a flat line for the three editable ones, captioned "Custom" unless that is the name.
    expect(container.querySelectorAll(".preset-grid .eq-sparkline")).toHaveLength(12);
    expect(container.querySelectorAll(".preset-grid__caption")).toHaveLength(2);
    expect(screen.getByRole("slider", { name: "400 Hz" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Upscaling" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Preset/ })).toBeNull();
  });

  it("sends setEqualizerPreset when a preset card is picked", async () => {
    const user = userEvent.setup();
    const api = spyApi();
    renderWithStore(<EqualizerPage />, connectedStore(api));
    await user.click(screen.getByRole("button", { name: "Bass" }));
    await waitFor(() => expect(sent(api)).toEqual([{ type: "setEqualizerPreset", preset: "bass" }]));
    expect(screen.getByRole("button", { name: "Bass" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("SystemPage", () => {
  it("asks to connect while disconnected", () => {
    renderWithStore(<SystemPage />, createEngineStore(spyApi()));
    expect(screen.getByText("Connect your headphones to change these settings.")).toBeInTheDocument();
  });

  it("sends powerOff only after the confirmation", async () => {
    const user = userEvent.setup();
    const api = spyApi();
    renderWithStore(<SystemPage />, connectedStore(api));
    await user.click(screen.getByRole("button", { name: "Power off" }));
    const sheet = screen.getByRole("dialog", { name: "Power off WH-1000XM4?" });
    expect(sent(api)).toEqual([]);
    await user.click(within(sheet).getByRole("button", { name: "Power off" }));
    await waitFor(() => expect(sent(api)).toEqual([{ type: "powerOff" }]));
  });
});

describe("SoundPage: connection quality and Speak-to-Chat", () => {
  it("shows the recorded stability priority and sends setConnectionMode for sound quality", async () => {
    const user = userEvent.setup();
    const api = spyApi();
    renderWithStore(<SoundPage />, connectedStore(api));
    const quality = screen.getByRole("list", { name: "Bluetooth connection quality" });
    expect(within(quality).getByRole("button", { name: "Priority on stable connection" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await user.click(within(quality).getByRole("button", { name: "Priority on sound quality" }));
    await waitFor(() => expect(sent(api)).toEqual([{ type: "setConnectionMode", audioPriority: "quality" }]));
  });

  it("sends the whole setSpeakToChat: on, then a timeout with the reported sensitivity", async () => {
    const user = userEvent.setup();
    const api = spyApi();
    renderWithStore(<SoundPage />, connectedStore(api));
    const timeout = screen.getByRole("button", { name: /Time until Speak-to-Chat closes/ });
    expect(timeout).toBeDisabled();
    await user.click(screen.getByRole("switch", { name: "Speak-to-Chat" }));
    expect(timeout).toBeEnabled();
    expect(timeout).toHaveTextContent("Short (about 5 s)");
    await user.click(timeout);
    await user.click(
      within(screen.getByRole("dialog", { name: "Time until Speak-to-Chat closes" })).getByRole("button", {
        name: "Does not close automatically",
      }),
    );
    await waitFor(() =>
      expect(sent(api)).toEqual([
        { type: "setSpeakToChat", enabled: true, sensitivity: "auto", timeout: "short" },
        { type: "setSpeakToChat", enabled: true, sensitivity: "auto", timeout: "manual" },
      ]),
    );
  });
});

describe("SystemPage: automatic pause", () => {
  it("shows the recorded auto pause on and sends setAutoPause off", async () => {
    const user = userEvent.setup();
    const api = spyApi();
    renderWithStore(<SystemPage />, connectedStore(api));
    const toggle = screen.getByRole("switch", { name: "Automatic pause when headphones are removed" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("switch", { name: "Connect to 2 devices simultaneously" })).toBeNull();
    await user.click(toggle);
    await waitFor(() => expect(sent(api)).toEqual([{ type: "setAutoPause", enabled: false }]));
  });
});

describe("DevicesPage", () => {
  const laptop = "00:11:22:33:44:52";

  it("asks to connect while disconnected", () => {
    renderWithStore(<DevicesPage />, createEngineStore(spyApi()));
    expect(screen.getByText("Connect your headphones to change these settings.")).toBeInTheDocument();
  });

  /** The recording as a protocol V2 device would report it: the engine sends setPairedDevice only on V2. */
  const v2 = (): SnapshotPayload => {
    const payload = xm4();
    payload.snapshot.protocol = "V2";
    return payload;
  };

  it("lists the three recorded devices read-only on the V1 XM4, Desktop-1 as this PC, connected and playing", () => {
    renderWithStore(<DevicesPage />, connectedStore());
    const list = screen.getByRole("list", { name: "Paired devices" });
    expect(within(list).getAllByRole("listitem").map((row) => row.textContent)).toEqual([
      "Desktop-1This PCConnectedPlayback device",
      "Laptop-1",
      "Phone-1",
    ]);
    // libmdr rejects setPairedDevice on V1 (Core Services): no actions are offered.
    expect(within(list).queryAllByRole("button")).toEqual([]);
    expect(screen.getByText(/do not let a computer connect, switch or forget/)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Connect to 2 devices simultaneously" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("connects a paired device from its sheet and shows it pending until the headphones report it", async () => {
    const user = userEvent.setup();
    const api = spyApi();
    const store = connectedStore(api, v2());
    renderWithStore(<DevicesPage />, store);
    await user.click(screen.getByRole("button", { name: /Laptop-1/ }));
    const sheet = screen.getByRole("dialog", { name: "Laptop-1" });
    expect(within(sheet).getAllByRole("button").map((b) => b.textContent)).toEqual(["Connect", "Forget this device"]);
    await user.click(within(sheet).getByRole("button", { name: "Connect" }));
    await waitFor(() =>
      expect(sent(api)).toEqual([{ type: "setPairedDevice", command: "connect", deviceId: laptop }]),
    );
    expect(screen.getByRole("button", { name: /Laptop-1/ })).toHaveTextContent("Connecting…");
    act(() =>
      store
        .getState()
        .receiveSnapshot(applyCommand(v2(), { type: "setPairedDevice", command: "connect", deviceId: laptop })),
    );
    const row = screen.getByRole("button", { name: /Laptop-1/ });
    expect(row).not.toHaveTextContent("Connecting…");
    expect(row).toHaveTextContent("Connected");
  });

  it("asks before forgetting a device and sends unpair only after the confirmation", async () => {
    const user = userEvent.setup();
    const api = spyApi();
    renderWithStore(<DevicesPage />, connectedStore(api, v2()));
    await user.click(screen.getByRole("button", { name: /Phone-1/ }));
    await user.click(screen.getByRole("button", { name: "Forget this device" }));
    const confirm = screen.getByRole("dialog", { name: "Forget Phone-1?" });
    expect(within(confirm).getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(sent(api)).toEqual([]);
    await user.click(within(confirm).getByRole("button", { name: "Forget" }));
    await waitFor(() =>
      expect(sent(api)).toEqual([{ type: "setPairedDevice", command: "unpair", deviceId: "00:11:22:33:44:53" }]),
    );
  });

  it("offers this PC no disconnect or forget, and sends setPairing and setMultipoint", async () => {
    const user = userEvent.setup();
    const api = spyApi();
    renderWithStore(<DevicesPage />, connectedStore(api, v2()));
    await user.click(screen.getByRole("button", { name: /Desktop-1/ }));
    const sheet = screen.getByRole("dialog", { name: "Desktop-1" });
    expect(within(sheet).getAllByRole("button").map((b) => b.textContent)).toEqual(["Close"]);
    await user.click(within(sheet).getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Pair a new device" }));
    await user.click(screen.getByRole("switch", { name: "Connect to 2 devices simultaneously" }));
    await waitFor(() =>
      expect(sent(api)).toEqual([
        { type: "setPairing", enabled: true },
        { type: "setMultipoint", enabled: false },
      ]),
    );
    expect(screen.getByRole("button", { name: /Stop pairing mode/ })).toBeInTheDocument();
  });
});
