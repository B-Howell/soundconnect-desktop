/**
 * The TypeScript contract against the real recording: every key of the
 * recorded XM4 payload must be a field of the matching type and every field
 * must be present (the `Record<keyof T, true>` lists fail to compile when a
 * type gains or loses a field), and the values narrow as the types say.
 */
import { describe, expect, it } from "vitest";
import {
  hasFeature,
  type AssignableControl,
  type Battery,
  type Equalizer,
  type GeneralSetting,
  type NoiseControl,
  type NoiseView,
  type Power,
  type Snapshot,
  type SnapshotPayload,
  type Texts,
} from "../../src/lib/engine/types";
import recorded from "../fixtures/snapshots/xm4-ready.json";

const keys = <T>(fields: Record<keyof T, true>): string[] => Object.keys(fields).sort();
const sorted = (value: object): string[] => Object.keys(value).sort();

const snapshotKeys = keys<Snapshot>({
  protocol: true,
  initialized: true,
  ready: true,
  dirty: true,
  model: true,
  batteries: true,
  playback: true,
  noiseControl: true,
  speakToChat: true,
  listening: true,
  equalizer: true,
  equalizerPresets: true,
  pairedDevices: true,
  pairing: true,
  sourceSwitchControl: true,
  generalSettings: true,
  assignableControls: true,
  power: true,
  voiceGuidance: true,
  connectionMode: true,
  safeListening: true,
  wearingStatus: true,
  features: true,
  texts: true,
});

const payload = recorded as SnapshotPayload;
const snapshot = payload.snapshot;

describe("engine types against the recorded XM4 payload", () => {
  it("has exactly the fields of SnapshotPayload, Snapshot and the nested types", () => {
    expect(sorted(recorded)).toEqual(keys<SnapshotPayload>({ snapshot: true, noiseView: true }));
    expect(sorted(recorded.snapshot)).toEqual(snapshotKeys);
    expect(sorted(recorded.noiseView)).toEqual(
      keys<NoiseView>({
        mode: true,
        ambientLevel: true,
        focusOnVoice: true,
        canCancel: true,
        canAmbient: true,
        canWind: true,
        canFocusOnVoice: true,
      }),
    );
    expect(sorted(recorded.snapshot.texts)).toEqual(
      keys<Texts>({
        modelName: true,
        firmwareVersion: true,
        uniqueId: true,
        modelSeries: true,
        modelColor: true,
        lastAlert: true,
        trackTitle: true,
        trackAlbum: true,
        trackArtist: true,
      }),
    );
    expect(sorted(recorded.snapshot.equalizer)).toEqual(
      keys<Equalizer>({
        preset: true,
        clearBass: true,
        bandCount: true,
        dseeEnabled: true,
        dseeType: true,
        available: true,
        dseeAvailable: true,
        bands: true,
      }),
    );
    expect(sorted(recorded.snapshot.noiseControl)).toEqual(
      keys<NoiseControl>({
        mode: true,
        ambientLevel: true,
        changingAsmLevel: true,
        focusOnVoice: true,
        buttonMode: true,
        adaptiveAmbient: true,
        adaptiveSensitivity: true,
      }),
    );
    expect(sorted(recorded.snapshot.batteries[0])).toEqual(
      keys<Battery>({ part: true, present: true, levelPercent: true, updateThresholdPercent: true, charging: true }),
    );
    expect(sorted(recorded.snapshot.power)).toEqual(
      keys<Power>({
        autoPowerOffMinutes: true,
        wearingPower: true,
        autoPause: true,
        headGesture: true,
        shutdownRequested: true,
      }),
    );
    expect(sorted(recorded.snapshot.generalSettings[0])).toEqual(
      keys<GeneralSetting>({ index: true, info: true, value: true, subject: true, summary: true }),
    );
    expect(sorted(recorded.snapshot.assignableControls[0])).toEqual(
      keys<AssignableControl>({ location: true, kind: true, action: true, options: true }),
    );
  });

  it("narrows to the real XM4 values", () => {
    expect(snapshot.protocol).toBe("V1");
    expect(snapshot.ready).toBe(true);
    expect(snapshot.texts.modelName).toBe("WH-1000XM4");
    expect(snapshot.texts.firmwareVersion).toBe("2.9.0");
    expect(snapshot.model?.audioCodec).toBe("aac");
    expect(snapshot.model?.protocolVersion).toBe(0x7000);
    expect(snapshot.batteries?.[0]).toMatchObject({ part: "main", levelPercent: 90, charging: "no" });
    expect(snapshot.equalizer).toMatchObject({ preset: "bright", clearBass: -1, dseeEnabled: true, dseeType: "hx" });
    expect(snapshot.equalizer?.bands).toEqual([0, 5, 7, 7, 9]);
    expect(snapshot.equalizerPresets?.map((p) => p.id)).toEqual([
      "off",
      "bright",
      "excited",
      "mellow",
      "relaxed",
      "vocal",
      "treble",
      "bass",
      "speech",
      "custom",
      "user1",
      "user2",
    ]);
    expect(snapshot.playback).toEqual({ status: "playing", volume: 12 });
    expect(snapshot.power?.autoPowerOffMinutes).toBe(0);
    expect(snapshot.assignableControls?.[0]).toMatchObject({ location: "custom", kind: "button", action: "noiseControl" });
    expect(snapshot.sourceSwitchControl).toBeNull();
    expect(snapshot.safeListening).toBeNull();
    expect(snapshot.wearingStatus).toBeNull();
  });

  it("reports the feature availability map, twenty features available", () => {
    const available = Object.entries(snapshot.features).filter(([, v]) => v === "available");
    expect(available).toHaveLength(20);
    expect(hasFeature(snapshot, "NOISE_CANCELLING")).toBe(true);
    expect(hasFeature(snapshot, "SHUTDOWN")).toBe(true);
    expect(hasFeature(snapshot, "VOICE_GUIDANCE_VOLUME")).toBe(false);
    expect(hasFeature(snapshot, "SAFE_LISTENING")).toBe(false);
  });

  it("carries the normalised noise view, never the raw V1 byte", () => {
    expect(snapshot.noiseControl?.ambientLevel).toBe(255);
    expect(payload.noiseView).toEqual({
      mode: "cancelling",
      ambientLevel: 20,
      focusOnVoice: false,
      canCancel: true,
      canAmbient: true,
      canWind: true,
      canFocusOnVoice: true,
    });
  });
});
