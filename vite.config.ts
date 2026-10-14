import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const host = process.env.TAURI_DEV_HOST;
const root = fileURLToPath(new URL(".", import.meta.url));

/** The app version, read from package.json so the About card never drifts from it. */
function appVersion(): string {
  const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version?: string };
  return pkg.version ?? "0.0.0";
}

/**
 * The upstream engine commit pinned by the submodule gitlink in HEAD (not the
 * submodule's checked-out HEAD, so an uncommitted submodule bump does not show
 * up as if shipped). Falls back to "unknown" without git or outside a
 * checkout, so `pnpm dev:web` and builds from a source archive still work.
 */
function engineCommit(): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD:upstream/SonyHeadphonesClient"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react()],

  // Build-time constants for the About card (declared in src/vite-env.d.ts,
  // read through src/lib/buildInfo.ts, which falls back when they are absent,
  // as under Vitest).
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
    __ENGINE_COMMIT__: JSON.stringify(engineCommit()),
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // expose Tauri's environment variables to the renderer alongside VITE_*
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
