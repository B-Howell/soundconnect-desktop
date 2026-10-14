import { useState } from "react";

/** True when the page was opened with `?gallery=1`. */
export function isGalleryQuery(search: string): boolean {
  return new URLSearchParams(search).get("gallery") === "1";
}

/**
 * Whether to show the dev-only component gallery. Read once at mount; the
 * query string is never changed in-app. Always false in production builds,
 * which lets the bundler drop the gallery chunk.
 */
export function useGalleryRoute(): boolean {
  const [enabled] = useState(() => import.meta.env.DEV && isGalleryQuery(window.location.search));
  return enabled;
}
