import { describe, expect, it } from "vitest";
import recording from "../../src-tauri/fixtures/winaudio/test-pc.json";
import { applyToSnapshot } from "../../src/lib/winaudio/mockApi";
import { attentionCount, winAudioCards, type SettingRow } from "../../src/lib/winaudio/rows";
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
  it("has the four cards of the research proposal, in order", () => {
    expect(winAudioCards(recorded()).map((c) => c.title)).toEqual([
      "Calls vs music",
      "Processing",
      "Format and volume",
      "Connection",
    ]);
  });

  it("shows live state against the music recommendation", () => {
    const s = recorded();
    expect(row(s, "handsFree")).toMatchObject({ current: "Off", recommended: "Off", ok: true, admin: true });
    expect(row(s, "enhancements")).toMatchObject({ current: "Off", recommended: "Off", ok: true, admin: false });
    expect(row(s, "ducking")).toMatchObject({ current: "Do nothing", ok: true });
    expect(row(s, "callsMic")).toMatchObject({ current: "Snowball (Blue Snowball)", ok: true });
    expect(row(s, "format")).toMatchObject({ current: "48 kHz, 16-bit", ok: null });
    expect(row(s, "absoluteVolume")).toMatchObject({ current: "On", ok: true, admin: true });
    expect(row(s, "powerSaving")).toMatchObject({ current: "On", recommended: "Off", ok: false, counts: false, admin: true });
    expect(row(s, "adapter")).toMatchObject({ current: "MediaTek Bluetooth Adapter" });
    expect(row(s, "codec")).toMatchObject({ current: "AAC" });
    // Not connected to Windows: the speakers as default is not a problem now.
    expect(row(s, "defaultPlayback")).toMatchObject({ current: "PreSonus Eris (Realtek(R) Audio)", ok: null });
    expect(row(s, "defaultPlayback").control).toEqual({ type: "none" });
  });

  it("is set up for music (power saving is advisory)", () => {
    expect(attentionCount(winAudioCards(recorded()))).toBe(0);
  });
});

describe("rows after Windows changes things", () => {
  it("counts enhancements, ducking and the speakers as default once connected", () => {
    const s = recorded();
    if (s.stereo) s.stereo.state = "active";
    s.enhancementsEnabled = true;
    s.duckingMode = "reduce80";
    const cards = winAudioCards(s);
    expect(attentionCount(cards)).toBe(4); // enhancements, ducking, default playback, playback for calls
    const playback = row(s, "defaultPlayback");
    expect(playback.control).toEqual({
      type: "action",
      label: "Use headphones",
      change: {
        kind: "setDefaultEndpoint",
        flow: "render",
        communications: false,
        id: "{0.0.0.00000000}.{33f2e282-497a-462e-89e8-70ce4e01ffdc}",
        name: "Headphones (WH-1000XM4)",
      },
    });
  });

  it("controls yield the matching changes", () => {
    const s = recorded();
    const hf = row(s, "handsFree").control;
    if (hf.type !== "toggle") throw new Error("toggle expected");
    expect(hf.change(true)).toEqual({ kind: "setHandsFree", address: "AA:BB:CC:12:34:56", enabled: true });
    const ducking = row(s, "ducking").control;
    if (ducking.type !== "picker") throw new Error("picker expected");
    expect(ducking.change("reduce50")).toEqual({ kind: "setDucking", mode: "reduce50" });
    const exclusive = row(s, "exclusive").control;
    if (exclusive.type !== "picker") throw new Error("picker expected");
    expect(exclusive.value).toBe("priority");
    expect(exclusive.change("off")).toMatchObject({ kind: "setExclusiveMode", allowed: false, priority: false });
    const mic = row(s, "callsMic").control;
    if (mic.type !== "picker") throw new Error("picker expected");
    expect(mic.options.map((o) => o.label)).toContain("Snowball (Blue Snowball)");
  });

  it("the mock applies a change the way the crate reads it back", () => {
    const s = recorded();
    expect(applyToSnapshot(s, { kind: "setMonoAudio", enabled: true })).toBeNull();
    expect(row(s, "mono")).toMatchObject({ current: "On", ok: false });
    expect(applyToSnapshot(s, { kind: "useHandsFreeForCommunications", address: s.address })).toMatch(/did not appear/);
  });
});
