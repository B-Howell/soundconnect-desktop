/** Where the protocol engine comes from (the submodule's remote, `.gitmodules`). */
export const ENGINE_UPSTREAM_URL = "https://github.com/mos9527/SonyHeadphonesClient";

// `typeof` keeps these safe where the Vite `define` is absent (Vitest uses its
// own config): an undeclared identifier under `typeof` is "undefined", not a
// ReferenceError.
/** The app version from package.json. */
export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0";

/** The full upstream engine commit, or "unknown" when git was unavailable at build time. */
export const ENGINE_COMMIT: string = typeof __ENGINE_COMMIT__ === "string" ? __ENGINE_COMMIT__ : "unknown";

/** Git's 7-character abbreviation; anything that is not a hex hash (such as "unknown") is returned as is. */
export function shortCommit(commit: string): string {
  return /^[0-9a-f]{40}$/i.test(commit) ? commit.slice(0, 7) : commit;
}
