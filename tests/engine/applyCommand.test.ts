import { describe, expect, it } from "vitest";
import { applyCommand, commandKey, reflects } from "../../src/lib/engine/applyCommand";
import type { SnapshotPayload } from "../../src/lib/engine/types";
import recorded from "../fixtures/snapshots/xm4-ready.json";

const xm4 = (): SnapshotPayload => structuredClone(recorded) as SnapshotPayload;

describe("applyCommand on the recorded XM4 (protocol V1)", () => {
  it("encodes V1 noise modes like noise_view.rs: 255 cancelling, 0 wind, 1..20 ambient", () => {
    const wind = applyCommand(xm4(), { type: "setNoise", mode: "wind" });
    expect(wind.noiseView?.mode).toBe("wind");
    expect(wind.snapshot.noiseControl).toMatchObject({ mode: "cancelling", ambientLevel: 0 });

    const ambient = applyCommand(xm4(), { type: "setAmbientLevel", level: 7 });
    expect(ambient.noiseView).toMatchObject({ mode: "ambient", ambientLevel: 7 });
    expect(ambient.snapshot.noiseControl).toMatchObject({ mode: "cancelling", ambientLevel: 7 });

    const back = applyCommand(ambient, { type: "setNoise", mode: "cancelling" });
    expect(back.snapshot.noiseControl?.ambientLevel).toBe(255);
    expect(back.noiseView).toMatchObject({ mode: "cancelling", ambientLevel: 7 });

    const off = applyCommand(xm4(), { type: "setNoise", mode: "off" });
    expect(off.snapshot.noiseControl?.mode).toBe("off");
  });

  it("clamps the ambient level to 1..20", () => {
    expect(applyCommand(xm4(), { type: "setAmbientLevel", level: 40 }).noiseView?.ambientLevel).toBe(20);
    expect(applyCommand(xm4(), { type: "setAmbientLevel", level: 0 }).noiseView?.ambientLevel).toBe(1);
  });

  it("applies equalizer, playback, power and settings commands", () => {
    let p = applyCommand(xm4(), { type: "setEqualizerPreset", preset: "bass" });
    p = applyCommand(p, { type: "setDsee", enabled: false });
    p = applyCommand(p, { type: "playback", action: "pause" });
    p = applyCommand(p, { type: "setVolume", volume: 20 });
    p = applyCommand(p, { type: "setPower", autoPowerOffMinutes: 30 });
    p = applyCommand(p, { type: "setGeneralSetting", index: 1, value: false });
    expect(p.snapshot.equalizer).toMatchObject({ preset: "bass", dseeEnabled: false });
    expect(p.snapshot.playback).toEqual({ status: "paused", volume: 20 });
    expect(p.snapshot.power).toMatchObject({ autoPowerOffMinutes: 30, autoPause: true });
    expect(p.snapshot.generalSettings?.[1].value).toBe(false);
    expect(p.snapshot.generalSettings?.[0].value).toBe(false);
  });

  it("keeps a control's options when a write leaves them out", () => {
    const p = applyCommand(xm4(), {
      type: "setAssignableControls",
      controls: [{ location: "custom", kind: "button", action: "amazonAlexa", options: [] }],
    });
    expect(p.snapshot.assignableControls?.[0]).toMatchObject({ action: "amazonAlexa" });
    expect(p.snapshot.assignableControls?.[0].options).toHaveLength(3);
  });

  it("reflects: true only when the payload already shows the command", () => {
    expect(reflects(xm4(), { type: "setDsee", enabled: true })).toBe(true);
    expect(reflects(xm4(), { type: "setDsee", enabled: false })).toBe(false);
    expect(reflects(xm4(), { type: "setNoise", mode: "cancelling" })).toBe(true);
    expect(reflects(xm4(), { type: "setAmbientLevel", level: 7 })).toBe(false);
  });

  it("gives each command its patch slot", () => {
    expect(commandKey({ type: "setVolume", volume: 3 })).toBe("setVolume");
    expect(commandKey({ type: "setGeneralSetting", index: 1, value: true })).toBe("setGeneralSetting.1");
    expect(commandKey({ type: "setPower", autoPowerOffMinutes: 5 })).toBe("setPower.autoPowerOffMinutes");
    expect(commandKey({ type: "playback", action: "next" })).toBeNull();
    expect(commandKey({ type: "powerOff" })).toBeNull();
    // The noise segment and the ambient slider share one slot: the newest choice wins.
    expect(commandKey({ type: "setNoise", mode: "wind" })).toBe("noise");
    expect(commandKey({ type: "setAmbientLevel", level: 3 })).toBe("noise");
    // Paired-device actions are not predicted: the list shows what the headphones report.
    expect(commandKey({ type: "setPairedDevice", command: "connect", deviceId: "00:11:22:33:44:52" })).toBeNull();
    expect(commandKey({ type: "setMultipoint", enabled: false })).toBe("setMultipoint");
  });
});

describe("applyCommand: speak-to-chat, connection, devices, pairing, auto pause, multipoint", () => {
  it("writes speak-to-chat and connection quality as the recording names them", () => {
    let p = applyCommand(xm4(), { type: "setSpeakToChat", enabled: true, sensitivity: "high", timeout: "manual" });
    p = applyCommand(p, { type: "setConnectionMode", audioPriority: "quality" });
    expect(p.snapshot.speakToChat).toEqual({ enabled: true, sensitivity: "high", timeout: "manual" });
    expect(p.snapshot.connectionMode).toEqual({ audioPriority: "quality" });
  });

  it("applies the four paired-device actions to the recorded three devices", () => {
    const laptop = "00:11:22:33:44:52";
    const pc = "00:11:22:33:44:51";
    let p = applyCommand(xm4(), { type: "setPairedDevice", command: "connect", deviceId: laptop });
    expect(p.snapshot.pairedDevices?.find((d) => d.macAddress === laptop)).toMatchObject({ connected: true });
    p = applyCommand(p, { type: "setPairedDevice", command: "selectPlayback", deviceId: laptop });
    expect(p.snapshot.pairedDevices?.map((d) => d.playbackDevice)).toEqual([false, true, false]);
    p = applyCommand(p, { type: "setPairedDevice", command: "disconnect", deviceId: laptop });
    expect(p.snapshot.pairedDevices?.find((d) => d.macAddress === laptop)).toMatchObject({
      connected: false,
      playbackDevice: false,
    });
    p = applyCommand(p, { type: "setPairedDevice", command: "unpair", deviceId: "00:11:22:33:44:53" });
    expect(p.snapshot.pairedDevices?.map((d) => d.macAddress)).toEqual([pc, laptop]);
  });

  it("sets pairing, auto pause and the multipoint general setting", () => {
    let p = applyCommand(xm4(), { type: "setPairing", enabled: true });
    p = applyCommand(p, { type: "setAutoPause", enabled: false });
    p = applyCommand(p, { type: "setMultipoint", enabled: false });
    expect(p.snapshot.pairing).toEqual({ enabled: true });
    expect(p.snapshot.power).toMatchObject({ autoPause: false, autoPowerOffMinutes: 0 });
    expect(p.snapshot.generalSettings?.map((s) => [s.subject, s.value])).toEqual([
      ["TOUCH_PANEL_SETTING", false],
      ["MULTIPOINT_SETTING", false],
    ]);
  });
});
