import type { SVGProps } from "react";

/**
 * Inline icon set drawn on a 24-unit grid with 1.75 px strokes: the Windows 11
 * caption glyphs (10 px square, single line, thin X) used by the frameless
 * title bar, then the app glyphs, added as primitives and pages need them.
 */
const paths = {
  minimize: <path d="M7 12h10" />,
  maximize: <rect x="7" y="7" width="10" height="10" rx="1" />,
  restore: (
    <>
      <rect x="7" y="9" width="8" height="8" rx="1" />
      <path d="M9.5 7H16a1 1 0 0 1 1 1v6.5" />
    </>
  ),
  close: <path d="M7 7l10 10M17 7 7 17" />,
  "chevron-right": <path d="m9.5 6 6 6-6 6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  /* Generic monochrome headphones for nav and list rows (not a specific
     model; product pictures are Sony's photos, see DeviceImage): a band
     over two oval cups. */
  headphones: (
    <>
      <path d="M2.8 14.9C3.3 13.8 3.2 12.4 3.2 11.4a8.8 8.8 0 0 1 17.6 0c0 1-.1 2.4.4 3.5" />
      <ellipse cx="5.8" cy="17" rx="3.5" ry="4.2" />
      <ellipse cx="18.2" cy="17" rx="3.5" ry="4.2" />
    </>
  ),
  speaker: (
    <>
      <path d="M11 5 6.5 9H4v6h2.5l4.5 4z" />
      <path d="M15 9.5a3.5 3.5 0 0 1 0 5M17.8 7a7 7 0 0 1 0 10" />
    </>
  ),
  waveform: <path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" />,
  moon: <path d="M19.5 14.5A7.5 7.5 0 1 1 9.5 4.5a6 6 0 0 0 10 10z" />,
  house: (
    <>
      <path d="M3.5 10.2 12 3.5l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z" />
      <path d="M9.5 20.5v-6h5v6" />
    </>
  ),
  "sliders-horizontal": (
    <>
      <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
      <path d="M15 4v4M9 10v4M17 16v4" />
    </>
  ),
  gear: (
    <>
      <path d="M10.3 3.5h3.4l.5 2.4 1.6.9 2.3-.8 1.7 2.9-1.8 1.6v1.9l1.8 1.6-1.7 2.9-2.3-.8-1.6.9-.5 2.4h-3.4l-.5-2.4-1.6-.9-2.3.8-1.7-2.9 1.8-1.6v-1.9L4.2 8.9l1.7-2.9 2.3.8 1.6-.9z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  /* Drawn to be rendered filled (`fill="currentColor"`) at small sizes. */
  bolt: <path d="M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6z" />,
  /* Noise control (Task 14): two sound waves for Ambient; the same waves
     struck through for Noise cancelling; the power symbol for Off. */
  ambient: <path d="M3 9c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0M3 15c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0" />,
  "noise-cancelling": (
    <>
      <path d="M3 9c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0M3 15c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0" />
      <path d="M5 3.5 19 20.5" />
    </>
  ),
  /* Wind-noise reduction (Task 11): three gusts, two curling back at their ends. */
  wind: <path d="M3 8.5h10.5a2.75 2.75 0 1 0-2.6-3.6M3 12.5h15a3 3 0 1 1-2.8 4M3 16.5h7" />,
  power: (
    <>
      <path d="M12 3.5v8" />
      <path d="M7.4 6.4a7.5 7.5 0 1 0 9.2 0" />
    </>
  ),
  /* Desktop frame and new menus (Task 23). Devices: a laptop beside a phone. */
  devices: (
    <>
      <rect x="3" y="5" width="12.5" height="9" rx="1" />
      <path d="M1.5 17.5h15" />
      <rect x="17.5" y="8.5" width="5" height="11" rx="1.25" />
    </>
  ),
  bluetooth: <path d="m7 7.5 10 9-5 4.5V3l5 4.5-10 9" />,
  /* Speak-to-Chat: a speech bubble with two lines of text. */
  chat: (
    <>
      <path d="M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-8l-4.5 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 15V6A1.5 1.5 0 0 1 5 4.5z" />
      <path d="M8 9h8M8 12h5" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.75v.5" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M11 18h2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  /* Transport (Task 14): drawn to be rendered filled; the round stroke joins
     soften the triangle corners. */
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  pause: (
    <>
      <rect x="6.5" y="5.5" width="3.5" height="13" rx="1" />
      <rect x="14" y="5.5" width="3.5" height="13" rx="1" />
    </>
  ),
  "skip-back": (
    <>
      <path d="M6.5 6v12" />
      <path d="M18.5 6.5v11L10 12z" />
    </>
  ),
  "skip-forward": (
    <>
      <path d="M17.5 6v12" />
      <path d="M5.5 6.5v11L14 12z" />
    </>
  ),
};

export type IconName = keyof typeof paths;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  /** Rendered size in px; the grid is 24 so 20 is the usual UI size. */
  size?: number;
}

export function Icon({ name, size = 20, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
