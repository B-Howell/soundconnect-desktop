import { describe, expect, it } from "vitest";
import recording from "../../src-tauri/fixtures/winaudio/test-pc.json";
import { applyToSnapshot } from "../../src/lib/winaudio/mockApi";
import { attentionCount, audioMode, modeDrift, winAudioCards, type SettingRow } from "../../src/lib/winaudio/rows";
import type { WinAudioSnapshot } from "../../src/lib/winaudio/types";

/** The snapshot `snapshot()` recorded on the maintainer's PC (XM4 remembered, not connected to Windows). */
const recorded = (): WinAudioSnapshot => structuredClone(recording) as WinAudioSnapshot;

function row(snapshot: WinAudioSnapshot, id: string): SettingRow {
  const found = winAudioCards(snapshot)
    .flatMap((c) => c.rows)
    .find((r) => r.id === id);
  if (!found) throw new Error(`no row ${id}`);
  return found;
}

describe("winAudioCards on the recording", () => {
  it("has the three cards under the mode tiles, in order, with the renamed rows", () => {
    const cards = winAudioCards(recorded());
    expect(cards.map((c) => [c.title, c.rows.map((r) => r.title)])).toEqual([
      ["Processing", ["Audio enhancements", "Spatial sound", "Mono mix (accessibility)"]],
      [
        "Format and volume",
        ["Default format", "Exclusive mode", "Lower other sounds during calls", "Absolute volume"],
      ],
      ["Connection", ["Codec reported by headphones", "Adapter power saving", "Bluetooth service", "2.4 GHz Wi-Fi"]],
    ]);
  });

  it("shows live state against the recommendation", () => {
    const s = recorded();
    expect(row(s, "enhancements")).toMatchObject({ current: "Off", recommended: "Off", ok: true, admin: false });
    expect(row(s, "ducking")).toMatchObject({ current: "Do nothing", ok: true });
    expect(row(s, "format")).toMatchObject({ current: "48 kHz, 16-bit", ok: true, counts: false });
    expect(row(s, "exclusive")).toMatchObject({ current: "Allowed, with priority", ok: true, counts: false });
    expect(row(s, "absoluteVolume")).toMatchObject({ current: "On", ok: true, admin: true });
    expect(row(s, "powerSaving")).toMatchObject({ current: "On", recommended: "Off", ok: false, counts: false, admin: true });
    expect(row(s, "powerSaving").description).toContain("MediaTek Bluetooth Adapter");
    expect(row(s, "codec")).toMatchObject({ current: "AAC" });
  });

  it("is in stereo mode with nothing needing attention (power saving is advisory)", () => {
    const s = recorded();
    expect(audioMode(s)).toBe("stereo");
    expect(modeDrift(s)).toEqual([]);
    expect(attentionCount(winAudioCards(s), modeDrift(s))).toBe(0);
  });
});

describe("modes and drift", () => {
  it("is mono with mic while the hands-free profile is on", () => {
    const s = recorded();
    s.handsFreeEnabled = true;
    expect(audioMode(s)).toBe("monoMic");
  });

  it("counts the speakers as default once connected, plus mismatched rows", () => {
    const s = recorded();
    if (s.stereo) s.stereo.state = "active";
    s.enhancementsEnabled = true;
    s.duckingMode = "reduce80";
    const drift = modeDrift(s);
    expect(drift).toEqual([
      "The headphones are not the default playback device.",
      "Voice chat and calls do not play on the headphones' stereo output.",
    ]);
    expect(attentionCount(winAudioCards(s), drift)).toBe(4);
  });

  it("flags a headphone mic as a default in stereo mode", () => {
    const s = recorded();
    s.defaultCommunicationsCapture = { id: "hf-mic", name: "Headset (WH-1000XM4 Hands-Free)", isThisDevice: true };
    expect(modeDrift(s, "stereo")).toHaveLength(1);
  });

  it("flags voice chat off the hands-free endpoints in mono-with-mic mode", () => {
    const s = recorded();
    s.handsFreeEnabled = true;
    s.handsFreeRender = { id: "hf-out", name: "Headset (WH-1000XM4)", state: "active", bluetooth: true };
    s.handsFreeCapture = { id: "hf-mic", name: "Headset (WH-1000XM4)", state: "active", bluetooth: true };
    expect(modeDrift(s)).toEqual(["Voice chat does not use the headphones' hands-free audio and mic."]);
    expect(applyToSnapshot(s, { kind: "useHandsFreeForCommunications", address: s.address })).toBeNull();
    expect(modeDrift(s)).toEqual([]);
  });
});

describe("controls", () => {
  it("yield the matching changes", () => {
    const s = recorded();
    const ducking = row(s, "ducking").control;
    if (ducking.type !== "picker") throw new Error("picker expected");
    expect(ducking.change("reduce50")).toEqual({ kind: "setDucking", mode: "reduce50" });
    const exclusive = row(s, "exclusive").control;
    if (exclusive.type !== "picker") throw new Error("picker expected");
    expect(exclusive.value).toBe("priority");
    expect(exclusive.change("off")).toMatchObject({ kind: "setExclusiveMode", allowed: false, priority: false });
    const saving = row(s, "powerSaving").control;
    if (saving.type !== "toggle") throw new Error("toggle expected");
    expect(saving.change(false)).toEqual({ kind: "setAdapterPowerSaving", allowed: false });
    expect(row(s, "spatial").control).toEqual({ type: "openSettings", page: "sound" });
  });

  it("the mock applies a change the way the crate reads it back", () => {
    const s = recorded();
    expect(applyToSnapshot(s, { kind: "setMonoAudio", enabled: true })).toBeNull();
    expect(row(s, "monoMix")).toMatchObject({ current: "On", ok: false });
    expect(applyToSnapshot(s, { kind: "useHandsFreeForCommunications", address: s.address })).toMatch(/did not appear/);
  });
});
