/**
 * In-app updates over `tauri-plugin-updater` (Rust) and its JS bindings. The
 * plugin reads `latest.json` from the newest GitHub release (the endpoint in
 * `tauri.conf.json`), checks the installer's minisign signature against the
 * public key there, runs the NSIS installer in passive mode, and the process
 * plugin restarts the app. See Core Services, Updates.
 *
 * `UpdaterApi` is the seam tests mock; outside the Tauri webview (the browser
 * dev server) `noUpdaterApi` never finds an update.
 */
import { isTauri } from "@tauri-apps/api/core";

/** An update the server announced, ready to download and install. */
export interface AvailableUpdate {
  /** The new version ("0.1.10"). */
  version: string;
  /** Release notes from `latest.json` (`notes`), when present. */
  notes?: string;
  /**
   * Downloads and installs it. `onProgress` gets the fraction done (0..1), or
   * null while the size is unknown. On Windows the installer closes the app;
   * the caller then restarts it (`UpdaterApi.relaunch`) in case it did not.
   */
  install: (onProgress: (fraction: number | null) => void) => Promise<void>;
}

export interface UpdaterApi {
  /** The update the endpoint announces, or null when this version is current. Rejects when offline or the manifest is bad. */
  check: () => Promise<AvailableUpdate | null>;
  /** Restarts the app (after an install). */
  relaunch: () => Promise<void>;
}

export const noUpdaterApi: UpdaterApi = {
  check: async () => null,
  relaunch: async () => undefined,
};

export const tauriUpdaterApi: UpdaterApi = {
  check: async () => {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) return null;
    return {
      version: update.version,
      notes: update.body,
      install: async (onProgress) => {
        let total: number | undefined;
        let done = 0;
        await update.downloadAndInstall((event) => {
          if (event.event === "Started") {
            total = event.data.contentLength;
            onProgress(total ? 0 : null);
          } else if (event.event === "Progress") {
            done += event.data.chunkLength;
            onProgress(total ? Math.min(1, done / total) : null);
          } else {
            onProgress(1);
          }
        });
      },
    };
  },
  relaunch: async () => {
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  },
};

/** The api for this page: the plugins inside Tauri, else the no-op. */
export const defaultUpdaterApi: UpdaterApi = isTauri() ? tauriUpdaterApi : noUpdaterApi;

/**
 * The reason line under "Update failed": offline, a signature that does not
 * match the public key, or anything else (the plugin's own message).
 */
export function updateErrorText(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/signature/i.test(raw)) {
    return "Signature check failed.";
  }
  if (/network|connect|dns|timed? ?out|offline|request|reqwest|404|status code/i.test(raw)) {
    return "Can't reach the update server.";
  }
  return raw;
}

/** The GitHub release page of `version`. */
export const releasePageUrl = (version: string): string =>
  `https://github.com/B-Howell/soundconnect-desktop/releases/tag/v${version}`;
