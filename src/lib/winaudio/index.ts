/**
 * The one `WinAudioApi` the renderer talks to: the mock (the recording of
 * the maintainer's PC) whenever the engine is mocked (`isMockEngine`, so
 * `VITE_MOCK_ENGINE=1` or a plain browser in dev), else the Tauri commands.
 * The mock and its fixtures load with a dynamic `import()`, so a release
 * bundle never contains them.
 */
import { isMockEngine } from "../engine";
import { tauriWinAudioApi, type WinAudioApi } from "./api";
import type { FixKind, Plan, WinAudioSnapshot } from "./types";

let ready: Promise<WinAudioApi> | undefined;

export function getWinAudioApi(): Promise<WinAudioApi> {
  ready ??= isMockEngine
    ? Promise.all([
        import("./mockApi"),
        import("../../../src-tauri/fixtures/winaudio/test-pc.json"),
        import("../../../src-tauri/fixtures/winaudio/plan-music.json"),
        import("../../../src-tauri/fixtures/winaudio/plan-calls.json"),
      ]).then(([{ createMockWinAudioApi }, recording, music, calls]) =>
        createMockWinAudioApi(recording.default as WinAudioSnapshot, {
          music: music.default as Plan,
          calls: calls.default as Plan,
        } satisfies Record<FixKind, Plan>),
      )
    : Promise.resolve(tauriWinAudioApi);
  return ready;
}
