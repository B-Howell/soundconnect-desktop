/**
 * A `WinAudioApi` without Windows, for the browser (`VITE_MOCK_ENGINE=1`) and
 * tests. It serves the snapshot recorded on the maintainer's PC and the fix plans the
 * crate built for it (`src-tauri/fixtures/winaudio/`), applies changes to a
 * local copy (each reported verified, as the crate's read-back would), and
 * keeps the restore point in memory. Admin changes resolve after `adminMs`
 * as the elevated helper would after its Windows prompt. Changes that need
 * endpoints the recording does not have fail as the crate would.
 */
import type { WinAudioApi } from "./api";
import type { Change, ChangeResult, FixKind, Plan, WinAudioSnapshot } from "./types";
import { needsAdmin } from "./types";

export interface MockWinAudioOptions {
  /** Delay of an admin batch (the Windows prompt), ms. */
  adminMs?: number;
  /** Start with a restore point (the recording). */
  restorePoint?: boolean;
}

export interface MockWinAudioApi extends WinAudioApi {
  /** Every batch `apply` / `applyAdmin` received, oldest first. */
  readonly batches: readonly { admin: boolean; changes: Change[] }[];
}

const clone = <T>(value: T): T => structuredClone(value);

/** The local copy after one change, or an error message when the recording cannot express it. */
export function applyToSnapshot(snap: WinAudioSnapshot, change: Change): string | null {
  switch (change.kind) {
    case "setDefaultEndpoint": {
      const isThisDevice = [snap.stereo, snap.handsFreeRender, snap.handsFreeCapture].some((e) => e?.id === change.id);
      const value = { id: change.id, name: change.name, isThisDevice };
      if (change.flow === "render") {
        if (change.communications) snap.defaultCommunicationsRender = value;
        else snap.defaultRender = value;
      } else if (change.communications) snap.defaultCommunicationsCapture = value;
      else snap.defaultCapture = value;
      return null;
    }
    case "useHandsFreeForCommunications":
      if (!snap.handsFreeRender || !snap.handsFreeCapture) {
        return "the Hands-Free playback and microphone endpoints did not appear";
      }
      snap.defaultCommunicationsRender = { ...snap.handsFreeRender, isThisDevice: true };
      snap.defaultCommunicationsCapture = { ...snap.handsFreeCapture, isThisDevice: true };
      return null;
    case "setEnhancements":
      snap.enhancementsEnabled = change.enabled;
      return null;
    case "setFormat":
      snap.defaultFormat = {
        channels: snap.defaultFormat?.channels ?? 2,
        sampleRate: change.sampleRate,
        bitsPerSample: change.bitsPerSample,
      };
      return null;
    case "setExclusiveMode":
      snap.exclusiveModeAllowed = change.allowed;
      snap.exclusivePriority = change.priority;
      return null;
    case "setDucking":
      snap.duckingMode = change.mode;
      return null;
    case "setMonoAudio":
      snap.monoAudio = change.enabled;
      return null;
    case "setHandsFree":
      snap.handsFreeEnabled = change.enabled;
      return null;
    case "setAbsoluteVolumeDisabled":
      snap.absoluteVolumeDisabled = change.disabled;
      return null;
    case "setAdapterPowerSaving":
      if (snap.adapter) snap.adapter.powerSavingAllowed = change.allowed;
      return null;
  }
}

export function createMockWinAudioApi(
  recording: WinAudioSnapshot,
  plans: Record<FixKind, Plan>,
  { adminMs = 600, restorePoint = false }: MockWinAudioOptions = {},
): MockWinAudioApi {
  let current = clone(recording);
  let saved: WinAudioSnapshot | null = restorePoint ? clone(recording) : null;
  const batches: { admin: boolean; changes: Change[] }[] = [];

  const run = (changes: Change[]): ChangeResult[] => {
    let stopped = false;
    return changes.map((change) => {
      if (stopped) return { change, applied: false, verified: false, error: "Skipped after an earlier change failed." };
      const error = applyToSnapshot(current, change);
      stopped = error !== null;
      return { change, applied: error === null, verified: error === null, error };
    });
  };
  const keepRestorePoint = () => {
    saved ??= clone(current);
  };

  return {
    batches,
    snapshot: async (_address, codec) => ({ ...clone(current), codec }),
    fixPreset: async (kind) => clone(plans[kind]),
    apply: async (_address, changes) => {
      if (changes.some(needsAdmin)) throw new Error("administrator changes go through winaudio_apply_admin");
      batches.push({ admin: false, changes });
      keepRestorePoint();
      return run(changes);
    },
    applyAdmin: async (_address, changes) => {
      batches.push({ admin: true, changes });
      keepRestorePoint();
      await new Promise((resolve) => setTimeout(resolve, adminMs));
      return run(changes);
    },
    restore: async () => {
      if (!saved) throw new Error("there is no restore point");
      const before = saved;
      current = { ...clone(before), codec: current.codec };
      return [];
    },
    restorePoint: async () => (saved ? clone(saved) : null),
    forgetRestorePoint: async () => {
      saved = null;
    },
    openSettings: async () => undefined,
  };
}
