/** Each snapshot -> props hook against the recorded WH-1000XM4 payload. */
import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { V1_AUTO_POWER_OFF_OPTIONS } from "../../src/components/system/autoPowerOff";
import { useConnectionView } from "../../src/hooks/engine/useConnectionView";
import { useDeviceHeaderProps } from "../../src/hooks/engine/useDeviceHeaderProps";
import { useEqualizerProps } from "../../src/hooks/engine/useEqualizerProps";
import { ambientPositionCommand, useNoiseControlProps } from "../../src/hooks/engine/useNoiseControlProps";
import { ambientPositionIndex, ambientPositions } from "../../src/components/noise/ambientPositions";
import { useNowPlayingProps } from "../../src/hooks/engine/useNowPlayingProps";
import { useSystemProps } from "../../src/hooks/engine/useSystemProps";
import { useAssignableControlsProps } from "../../src/hooks/engine/useAssignableControlsProps";
import { createEngineStore } from "../../src/state/engineStore";
import { connectedStore, renderHookWithStore, spyApi } from "./engineTestKit";

describe("useConnectionView", () => {
  it("maps engine states to the connection screens; Try again sends reconnect", () => {
    const api = spyApi();
    const store = createEngineStore(api);
    const { result } = renderHookWithStore(useConnectionView, store);
    expect(result.current).toEqual({ kind: "searching" });

    act(() => store.getState().receiveStatus({ state: "connecting", deviceName: "WH-1000XM4", protocol: "V1" }));
    expect(result.current).toEqual({ kind: "connecting", deviceName: "WH-1000XM4" });

    act(() => store.getState().receiveStatus({ state: "initialising", deviceName: "WH-1000XM4" }));
    expect(result.current.kind).toBe("connecting");

    act(() => store.getState().receiveStatus({ state: "disconnected", lastError: "Unable to receive from the device" }));
    expect(result.current).toMatchObject({ kind: "error", message: "Unable to receive from the device" });
    if (result.current.kind !== "error") throw new Error("expected error");
    result.current.onRetry();
    return expect.poll(() => api.send.mock.calls).toEqual([[{ type: "reconnect" }]]);
  });
});

describe("useDeviceHeaderProps", () => {
  it("reads name, main battery and codec from the recording", () => {
    const { result } = renderHookWithStore(useDeviceHeaderProps, connectedStore());
    expect(result.current).toEqual({ name: "WH-1000XM4", percent: 90, charging: false, codec: "AAC", firmware: "2.9.0" });
  });
});

describe("useNoiseControlProps", () => {
  it("uses noiseView: cancelling, level 20, wind offered; the switch sends setNoise", async () => {
    const api = spyApi();
    const { result } = renderHookWithStore(useNoiseControlProps, connectedStore(api));
    expect(result.current).toMatchObject({
      mode: "cancelling",
      ambientLevel: 20,
      focusOnVoice: false,
      canCancel: true,
      canAmbient: true,
      canWind: true,
      canFocusOnVoice: true,
    });
    act(() => result.current?.onModeChange("ambient"));
    expect(result.current?.mode).toBe("ambient");
    await expect.poll(() => api.send.mock.calls[0]?.[0]).toEqual({ type: "setNoise", mode: "ambient" });
  });

  it("maps slider stops to commands: cancelling and wind are modes, the rest ambient levels", () => {
    const positions = ambientPositions({ canCancel: true, canAmbient: true, canWind: true });
    expect(positions).toHaveLength(22);
    expect(ambientPositionCommand(positions[0])).toEqual({ type: "setNoise", mode: "cancelling" });
    expect(ambientPositionCommand(positions[1])).toEqual({ type: "setNoise", mode: "wind" });
    expect(ambientPositionCommand(positions[2])).toEqual({ type: "setAmbientLevel", level: 1 });
    expect(ambientPositionCommand(positions[21])).toEqual({ type: "setAmbientLevel", level: 20 });
    // Every stop n >= 2 is level n - 1, and the device state maps back to the same stop.
    positions.forEach((position, n) => {
      if (n >= 2) expect(ambientPositionCommand(position)).toEqual({ type: "setAmbientLevel", level: n - 1 });
    });
    expect(ambientPositionIndex(positions, "cancelling", 20)).toBe(0);
    expect(ambientPositionIndex(positions, "wind", 20)).toBe(1);
    expect(ambientPositionIndex(positions, "ambient", 7)).toBe(8);
    expect(ambientPositionIndex(positions, "off", 7)).toBe(-1);
  });
});

describe("useNowPlayingProps", () => {
  it("reads track texts, status and volume 0..30; play/pause sends pause while playing", async () => {
    const api = spyApi();
    const { result } = renderHookWithStore(useNowPlayingProps, connectedStore(api));
    expect(result.current).toMatchObject({
      title: 'Sample Artist - "Sample Track" (Live)',
      artist: "SampleArtistMusic",
      album: undefined,
      status: "playing",
      volume: 12,
      maxVolume: 30,
      disabled: false,
    });
    act(() => result.current?.onPlayPause());
    expect(result.current?.status).toBe("paused");
    await expect.poll(() => api.send.mock.calls[0]?.[0]).toEqual({ type: "playback", action: "pause" });
  });
});

describe("useEqualizerProps", () => {
  it("lists the advertised presets with upstream names and maps ids to MDR numbers", async () => {
    const api = spyApi();
    const { result } = renderHookWithStore(useEqualizerProps, connectedStore(api));
    const eq = result.current.equalizer;
    expect(eq?.presets.map((p) => p.name)).toEqual([
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
    expect(eq?.presets[1].id).toBe(8);
    expect(eq).toMatchObject({ presetId: 8, bands: [0, 5, 7, 7, 9], clearBass: -1, available: true });
    expect(result.current.dsee).toMatchObject({ available: true, enabled: true, type: 2 });

    act(() => eq?.onPresetChange(14));
    expect(result.current.equalizer?.presetId).toBe(14);
    await expect.poll(() => api.send.mock.calls[0]?.[0]).toEqual({ type: "setEqualizerPreset", preset: "bass" });
  });
});

describe("useAssignableControlsProps", () => {
  it("lists the custom button with its own options minus Google Assistant and writes the whole list", async () => {
    const api = spyApi();
    const { result } = renderHookWithStore(useAssignableControlsProps, connectedStore(api));
    expect(result.current?.controls).toEqual([
      {
        location: 3,
        type: 2,
        action: 2,
        actionLabel: "Ambient sound control",
        actions: [
          { action: 2, label: "Ambient sound control" },
          { action: 7, label: "Amazon Alexa" },
        ],
      },
    ]);
    act(() => result.current?.onChange(3, 7));
    await expect.poll(() => api.send.mock.calls[0]?.[0]).toEqual({
      type: "setAssignableControls",
      controls: [
        {
          location: "custom",
          kind: "button",
          action: "amazonAlexa",
          options: ["noiseControl", "googleAssistant", "amazonAlexa"],
        },
      ],
    });
  });
});

describe("useSystemProps", () => {
  it("builds Device (multipoint left out), voice guide and Power from the recording", () => {
    const { result } = renderHookWithStore(useSystemProps, connectedStore());
    const { device, voiceGuidance, power } = result.current;
    // generalSettings[1] is MULTIPOINT_SETTING: the Devices page shows it, System does not.
    expect(device?.generalSettings).toEqual([
      { index: 0, subject: "Touch sensor control panel", summary: undefined, value: false, writable: true },
    ]);
    expect(device?.autoPause).toMatchObject({ enabled: true });
    expect(device?.autoPowerOff).toMatchObject({ value: null, options: V1_AUTO_POWER_OFF_OPTIONS });
    expect(voiceGuidance).toMatchObject({ enabled: true });
    expect(voiceGuidance?.volume).toBeUndefined();
    expect(power?.deviceName).toBe("WH-1000XM4");
  });

  it("sends setPower with 0 minutes for Never", async () => {
    const api = spyApi();
    const { result } = renderHookWithStore(useSystemProps, connectedStore(api));
    act(() => result.current.device?.autoPowerOff?.onChange(30));
    expect(result.current.device?.autoPowerOff?.value).toBe(30);
    act(() => result.current.device?.autoPowerOff?.onChange(null));
    await expect.poll(() => api.send.mock.calls.map((c) => c[0])).toEqual([
      { type: "setPower", autoPowerOffMinutes: 30 },
      { type: "setPower", autoPowerOffMinutes: 0 },
    ]);
  });
});
