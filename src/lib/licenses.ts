// Inlined at build time by Vite's `?raw` suffix, so the shipped app carries
// the exact upstream licence text with no file read at run time.
import upstreamLicense from "../../upstream/SonyHeadphonesClient/LICENSE?raw";

/**
 * Splits a plain-text licence into paragraphs for display: blank lines
 * separate paragraphs, and the hard line breaks inside one (the file wraps
 * at about 80 columns) become spaces, so a narrow window reflows the text
 * instead of wrapping each short line again. Handles CRLF (a Windows
 * checkout with core.autocrlf).
 */
export function licenseParagraphs(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter((paragraph) => paragraph.length > 0);
}

/** The MIT licence of SonyHeadphonesClient / libmdr, as committed upstream, in paragraphs. */
export const UPSTREAM_LICENSE_PARAGRAPHS: readonly string[] = licenseParagraphs(upstreamLicense);

/** Our own licence line: the repository's `LICENSE` is MIT. */
export const OWN_LICENSE_LINE = "SoundConnect Desktop itself: MIT License (see LICENSE)";
