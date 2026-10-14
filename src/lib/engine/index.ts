/**
 * The one `EngineApi` the renderer talks to. The mock (the recorded XM4
 * snapshot, `mockApi.ts`) is chosen when `VITE_MOCK_ENGINE=1` (set by
 * `tools/dev-web.ps1`) or when the page is not inside the Tauri webview;
 * otherwise the Tauri commands. `VITE_MOCK_REMEMBERED=0` makes the mock start
 * with nothing remembered, so the setup wizard shows. The mock and its fixture are loaded with a
 * dynamic `import()` behind `mockAllowed`, which is the constant `false` in a
 * production build without the flag, so a release bundle never contains them.
 */
import { isTauri } from "@tauri-apps/api/core";
import type { EngineApi } from "./api";
import type { MockEngineApi } from "./mockApi";
import { tauriEngineApi } from "./tauriApi";
import type { SnapshotPayload } from "./types";

const mockFlag = import.meta.env.VITE_MOCK_ENGINE === "1";
const mockAllowed = import.meta.env.DEV || mockFlag;

/** True when the renderer runs against the mock engine. */
export const isMockEngine: boolean = mockAllowed && (mockFlag || !isTauri());

let ready: Promise<EngineApi> | undefined;

/** Resolves once to the mock or the Tauri api; later calls return the same promise. */
export function getEngineApi(): Promise<EngineApi> {
  ready ??= isMockEngine
    ? Promise.all([import("./mockApi"), import("../../../tests/fixtures/snapshots/xm4-ready.json")]).then(
        ([{ createMockEngineApi }, fixture]) => {
          const mock = createMockEngineApi(fixture.default as SnapshotPayload, {
            // `VITE_MOCK_REMEMBERED=0` starts as a first run, with nothing remembered (the setup wizard).
            remembered: import.meta.env.VITE_MOCK_REMEMBERED !== "0",
            // A second device for the setup list; connecting to it fails (the mock has one recording).
            otherDevices: [{ address: "F8:4E:17:00:00:01", name: "WF-1000XM5" }],
          });
          // Dev-only console handle: `__engineMock.simulateAlert({message: "...", autoResponse: null})`.
          if (typeof window !== "undefined") (window as Window & { __engineMock?: MockEngineApi }).__engineMock = mock;
          return mock;
        },
      )
    : Promise.resolve(tauriEngineApi);
  return ready;
}
