---
title: "SoundConnect Desktop - Renderer"
date: 2026-10-11
tags: [renderer, design]
project: "SoundConnect Desktop"
area: "renderer"
---

# SoundConnect Desktop - Renderer

The React renderer's visual language and the reusable primitives every page is
built from (plan Task 12). Pages in later tasks (Home, Sound, System,
Settings) compose these primitives; they should not restyle them. The app
shell itself (frame, title bar, caption buttons) is described in
[SoundConnect Desktop - Build Toolchain](<../tooling/SoundConnect Desktop - Build Toolchain.md>).

## Visual language

An iOS inset-grouped settings look (since Task 23 inside a desktop frame,
see [Desktop frame](#desktop-frame); Tasks 12 to 21 drew it in a 420 x 760 window),
coloured Sony black and gold since Task 13b (see [Brand](#brand)): a grey
(light) or charcoal (dark) page, white or lighter-charcoal rounded cards 16 px
from the window edge, uppercase section labels above the cards, rows separated by hairlines
that start at the text edge. Colours, sizes and durations all come from
[tokens.css](<../../src/styles/tokens.css>); components never hard-code them.
Literal micro-values that stay in component code on purpose: the 1 px
separator hairline, the
0.02 em letter-spacing on uppercase labels, and glyph stroke widths (2.25 on the 24-unit grid for chevron and
check), which are part of a glyph's drawing rather than layout sizes. Icon
box sizes come from `--row-icon-size` and `--icon-size-sm`.

### Why each token value

| Token(s) | Value (light / dark) | Why |
| --- | --- | --- |
| `--bg` | `#f2f2f7` / `#141414` | Light: iOS `systemGroupedBackground`, the grey that makes white cards read as cards. Dark: the app icon's charcoal (Task 13b). |
| `--surface` / `--surface-2` | `#ffffff` / `#232323`, `#f2f2f7` / `#303030` | Cards and the step above them. The dark values are the icon's touch-panel and cup-shell greys, so the UI and the icon share one ladder. |
| `--gutter` | 16 px (`--space-4`) | iOS inset-grouped side margin; used by the page padding in `AppFrame.css`. |
| `--radius-md` | 20 px | Card radius: larger than iOS 15's 10 pt because the cards hold big controls (segmented, slider) and modern iOS sheets/widgets use ~20. |
| `--radius-sm` | 12 px | Sheet buttons and the list-row focus ring: tighter than cards so a stack of buttons does not read as more cards. |
| `--radius-pill` | 999 px | Segmented track and pill, switch, chips. |
| `--radius-xs` | 4 px | Focus shape of small inline text buttons (the section-header action). |
| `--row-icon-size` / `--icon-size-sm` | 22 px / 16 px | Leading row glyphs; chevrons, checks and segment glyphs. |
| `--opacity-disabled` / `--opacity-pressed` | 0.4 / 0.7 | iOS dims disabled controls to about 40 % and fades pressed text buttons; one value each so every control dims alike. |
| `--opacity-hover` | 0.8 | Text buttons under the pointer (section-header action, Disclosure toggle): lighter than pressed so hover and press stay distinguishable. |
| `--space-half` | 2 px | Half step of the spacing scale for hairline-tight stacks: row title to subtitle, tab glyph to label. |
| `--focus-ring-width` | 2 px | The global `:focus-visible` outline, the inset row ring (negative offset of the same width) and the slider-thumb halo all use it, so every ring is the same weight. |
| `--weight-regular` / `-medium` / `-semibold` | 400 / 500 / 600 | Section labels regular, segments medium, chips, buttons, headings and the wordmark semibold. |
| `--tracking-display` | -0.02 em | Display headings (`h1`-`h3`: page title, device name, state titles): tighter than iOS's -0.01 em for Sony's compact headline feel. Section headers keep their own +0.02 em uppercase tracking. |
| `--text` / `--text-secondary` | `#141414` / `#f4f2ee`, `#6c6c70` / `#a19d97` | Charcoal text in light (the icon's black); warm off-white and warm grey in dark. Secondary: 4.69:1 on `--bg` light, 5.83:1 on `--surface` dark. |
| `--text-tertiary` | iOS `tertiaryLabel` | Chevrons only (decorative), never text. |
| `--fill` | `rgba(118,118,128,.12)` / `rgba(128,120,110,.24)` | iOS `tertiarySystemFill`, warm-tinted in dark: segmented track, slider track, neutral chip. |
| `--fill-text` | `#6c6c70` / `#aeaaa4` | Neutral chip text: 4.55:1 / 5.13:1 on `--fill`. |
| `--switch-off`, `--segmented-pill`, `--knob` | `#e9e9ea` / `#3d3b38`, `#ffffff` / `#57534d`, white | The iOS switch track and selected segment (warm greys in dark; `--text` on the dark pill is 6.83:1). |
| `--switch-on` | `var(--accent)` | Switches are gold when on (Sony), not iOS green; 3.88:1 / 5.15:1 against the off track. |
| `--separator` | `rgba(60,60,67,.18)` / `rgba(120,110,98,.5)` | iOS hairline in light, warm grey in dark. |
| `--shadow-knob` | two-layer `0 3px 8px` + `0 3px 1px` | The iOS lift under switch knobs, slider thumbs and the segment pill. |
| `--accent` | `#9a6a24` / `#d8a85e` | Dark: the icon's gold, exactly as sampled. Light: bronze, because gold on white is 2.17:1; white text on bronze is 4.71:1. Tab tint, leading glyphs, slider fill, checks, focus ring, switches, primary button. |
| `--accent-text` | `#80571c` / `#d8a85e` | Accent as text (section actions, chips, secondary button, wordmark): deeper bronze in light, 6.37:1 on white and 5.48:1 on `--accent-soft`; gold in dark, 5.52:1 on `--accent-soft`. |
| `--on-accent` | `#ffffff` / `#141414` | Text on a filled accent: white on bronze (4.71:1), charcoal on gold (8.49:1). |
| `--accent-soft`, `--selection`, `--accent-edge` | bronze 12 % / gold 14 %; 22 % / 32 %; 22 % / 30 % | Tinted chip and button fill, text selection, and the device header's single gold hairline. The dark tint stays at 14 % so the pulse disc reads as a whisper of gold, not brown. |
| `--success`, `--warning`, `--destructive` | iOS system green / orange / red | Battery, chips and the destructive button (switches moved to `--switch-on`). Dark `--destructive-text` is now `#ff7a72`: `#ff6961` fell to 4.39:1 on the lighter charcoal. `--danger` stays the Windows caption red for the close button. |
| `--*-text` on `--*-soft` | e.g. `#1d7a33` on 15 % green | Every chip and tinted-button pair reaches at least 4.5:1 in both schemes; re-measured for Task 13b in the [Brand](#brand) contrast table. |
| `--row-min-height` | 44 px | iOS minimum hit target; rows holding a 31 px switch stay exactly 44 px. |
| `--switch-*` | 51 x 31, 27 px knob, 2 px inset | iOS `UISwitch` geometry. |
| `--segmented-height` / `--segmented-inset` | 36 px / 2 px | Slightly taller than iOS's 32 pt because segments carry an icon and are clicked with a mouse. |
| `--slider-track-height` / `--slider-thumb-size` | 4 px / 28 px | iOS slider proportions: thin track, large white thumb. |
| `--sheet-button-height` | 50 px | iOS prominent sheet button height. |
| `--pill-height` | 22 px | Fits 11 px semibold text with comfortable padding. |
| Type | 15 px rows, 13 px headers and segments, 17 px buttons | iOS body is 17 pt; 15 px matches Windows density at 420 px wide. Buttons keep 17 for weight. |

Motion: the segment pill moves with the app's one spring
([motion.ts](<../../src/styles/motion.ts>)) supplied by the `MotionConfig` in
[App.tsx](<../../src/App.tsx>) (`reducedMotion="user"`). The switch knob and
fills use CSS transitions on `--duration-base` / `--ease-out`, which the
reduced-motion rule in [global.css](<../../src/styles/global.css>) collapses.

## Brand

Task 13b. The maintainer's direction: "The app should be ios smooth but Sony styling.
The headphones icon should be outlines of the actual xm4, not generic
headphones. Make the attached image the apps icon." So every iOS structure and
behaviour stays (grouped tables, segmented pill, switch geometry, spring
motion) and only colour, type weight and art changed. Dark mode is the hero:
charcoal surfaces with gold used for accents (tab tint, glyphs, wordmark,
switches, slider fill, cup rims, one hairline), never for page-sized fills.
Light mode keeps iOS's cool white with charcoal text and a bronze accent.
All values live in [tokens.css](<../../src/styles/tokens.css>); the token
table above gives the reason for each.

### Sampled colours

Sampled with PIL from the master icon
[app-icon.png](<../../src-tauri/icons/source/app-icon.png>) (1254 x 1254
RGBA; pixels with alpha 1 to 3 outside the square carry stray colour and were
ignored):

| Where | Sample | Used as |
| --- | --- | --- |
| Square background (most common colour) | `#141414` (with `#131313` / `#151515`) | dark `--bg`, light `--text`, dark `--on-accent` |
| Recessed touch panel | `#232323` | dark `--surface` |
| Cup shell | `#303030` | dark `--surface-2` / `--surface-elevated` |
| Square border, row 627 | `#cc994d` to `#d09c51` | (border only) |
| Cup-rim highlight, row 820 | `#f0b466` to `#f4bd72` | (highlight only) |
| Indicator slit | `#ebb76c` | (art only) |
| Median of all 12,731 gold pixels | `#d8a85e` (p75 `#eab571`) | dark `--accent` / `--accent-text` |

The median was chosen over the brighter rim highlight because it is the gold
the eye averages to at UI sizes and already passes on the dark surface
(7.25:1), so no lightness adjustment was needed. Gold fails on white
(2.17:1), so light mode uses bronze of the same hue: `#9a6a24` for fills and
`#80571c` for text.

### Contrast (Task 13b, re-measured)

WCAG 2 ratios computed from the token values, alpha tints composited over
`--surface` (and the tab bar's glass over `--bg`):

| Pair | Light | Dark |
| --- | --- | --- |
| `--text` on `--surface` / on `--bg` | 18.42 / 16.51 | 14.06 / 16.48 |
| `--text-secondary` on `--surface` / on `--bg` | 5.23 / 4.69 | 5.83 / 6.83 |
| `--fill-text` on `--fill` | 4.55 | 5.13 |
| `--accent` on `--surface` (glyphs, checks, slider) | 4.71 | 7.25 |
| `--accent` on `--bg` | 4.22 (glyphs only, 3:1 needed) | 8.49 |
| `--accent-text` on `--surface` / on `--bg` (section action, wordmark) | 6.37 / 5.71 | 7.25 / 8.49 |
| `--accent-text` on `--accent-soft` (accent chip, secondary button) | 5.48 | 5.52 |
| `--on-accent` on `--accent` (primary button) | 4.71 (white on bronze) | 8.49 (charcoal on gold) |
| `--accent` on tab-bar glass (selected tab label) | 4.55 | 7.60 |
| `--text` on `--segmented-pill` | 18.42 | 6.83 |
| `--success-text` / `--warning-text` / `--destructive-text` on their soft tints | 4.80 / 4.68 / 4.57 | 5.48 / 5.36 / 4.89 |
| `--switch-on` against `--switch-off` (non-text) | 3.88 | 5.15 |

The previous open question about white on `#007aff` (4.0:1) is gone: the
primary button now passes in both themes.

### Product images

Every picture of headphones in the app is Sony's own product photo of that
model, never a drawing (Task 26, 2026-10-12: The maintainer rejected all drawn
headphone art, so the traced `HeadphoneArt` line art and the
`headphones-xm4` glyph were removed). Where each photo came from, its terms
note and its size are in
[SoundConnect Desktop - Product Image Sources](<../research/SoundConnect Desktop - Product Image Sources.md>).

- Files: [public/devices](<../../public/devices/>) holds `<MODEL>.png` (cropped to
  the product with a 2 % margin, at most 1200 px on the long side) and
  `<MODEL>-thumb.png` (256 px) for 13 models: WH-1000XM3, WH-1000XM4,
  WH-1000XM5, WH-1000XM6, WH-CH720N, WF-1000XM4, WF-1000XM5, WF-1000XM6,
  WF-C510, WF-C700N, WF-L910 (LinkBuds Open), WF-LC900 (LinkBuds Clip),
  WF-LS900N (LinkBuds S). All are transparent PNGs in black. The only
  processing is the crop and a premultiplied-alpha Lanczos downscale; no
  retouching, recolouring or background removal.
- Lookup: [models.ts](<../../src/lib/devices/models.ts>). `findDeviceModel`
  matches a model or Bluetooth name case-insensitively at its start, longest
  id first (so `WH-1000XM4C` is the XM4), plus the LinkBuds product names.
  `deviceModelImage` returns the photo and thumbnail paths; an unknown `WH-`
  name gets the WH-1000XM5, an unknown `WF-` or LinkBuds name the
  WF-1000XM5, and no name at all the WH-1000XM5 as neutral headphones (the
  user's own XM4 is never guessed). Paths are
  `${import.meta.env.BASE_URL}devices/<file>`; Vite copies `public/` into
  `dist/`, which Tauri serves from its root, so `/devices/WH-1000XM4.png`
  resolves in dev and in the packaged app (checked in `pnpm build` output:
  all 26 files in `dist/devices/`, and the bundle builds `/devices/${file}`).
- Component: [DeviceImage.tsx](<../../src/components/device-art/DeviceImage.tsx>) /
  [DeviceImage.css](<../../src/components/device-art/DeviceImage.css>).
  Props `model?`, `size` (side of a square box in px), `variant?`
  (`full` | `thumb`). An `<img>` with `width` and `height` = `size`,
  `object-fit: contain` (the photo keeps its proportions), `loading="eager"`,
  no CSS filter. Alt text: the model's name (LinkBuds by product name), else
  the name passed in, else "Headphones".
  [ConnectionDeviceImage.tsx](<../../src/components/device-art/ConnectionDeviceImage.tsx>)
  is the 128 px photo the connection screens share.
- Where they show: the Status device header (160 px, full photo), the rail
  device block (72 px thumbnail, centred over the centred name and state
  since 0.1.9 in
  [RailDevice.css](<../../src/components/frame/RailDevice.css>); 40 px centred when
  collapsed), and the searching, connecting and error screens (128 px inside
  [ActivityPulse](<../../src/components/shell/ActivityPulse.tsx>), whose `image`
  variant drops the gold disc and keeps the breathing rings behind the
  photo when animated). The searching screen takes an optional `model`
  prop; connecting and error use `model`, else `deviceName`. The setup
  wizard and the remembered-device card show the same component through
  `ProductImage`. The About header keeps the app icon. The System tab and
  the gallery's Wearing detection row use the generic monochrome
  `headphones` glyph in [Icon.tsx](<../../src/components/icons/Icon.tsx>) (the old
  glyph's band and cups without the XM4 status slit), because nav icons are
  single-colour line glyphs.
- Tests: [models.test.ts](<../../tests/device-art/models.test.ts>) (every model has
  both files and `public/devices/` holds exactly those; name matching;
  fallbacks) and [DeviceImage.test.tsx](<../../tests/device-art/DeviceImage.test.tsx>)
  (src, size, eager, no inline style, thumb variant, fallbacks, and the
  header, rail and connection screens rendering the photo).
- Screenshots (headless Edge over CDP, 1180 x 760 dark, 2x, mock engine):
  (screenshot removed before publication),
  (screenshot removed before publication),
  (screenshot removed before publication).
  Judged: the photos are the real black WH-1000XM4, unstretched (natural
  776 x 1134 drawn 110 x 160; thumbnail 175 x 256 drawn 49 x 72). Fixed after
  looking: the rail thumbnail sat centred in its 72 px box, 11 px right of
  the name, so it is now left-aligned. The black product on the dark card
  has modest contrast; that is the real product colour and was kept.

### App icon pipeline

The master is [app-icon.png](<../../src-tauri/icons/source/app-icon.png>);
everything in [icons](<../../src-tauri/icons/>) is generated from it with
`pnpm tauri icon src-tauri/icons/source/app-icon.png`, which printed
`Appx Creating StoreLogo.png`, `Square30x30Logo.png` ... `Square310x310Logo.png`,
`ICNS Creating icon.icns`, `ICO Creating icon.ico`, `PNG Creating 32x32.png`,
`64x64.png`, `128x128.png`, `128x128@2x.png`, `icon.png`, then iOS
`AppIcon-*` and Android `mipmap-*` files; the `ios/` and `android/` folders
were deleted (Windows-only). PIL: `icon.ico` frames
`[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (256, 256)]`. The dev
browser tab shows [public/icon.png](<../../public/icon.png>) (a copy of the
512 px `icon.png`) through `<link rel="icon">` in
[index.html](<../../index.html>). Cargo does not notice new icons: touch
`src-tauri/build.rs` before `tools/dev.ps1`, or the exe keeps the old one
(seen in this task: the first run finished in 0.46 s with the old icon).

Since 2026-10-12 (round 3) the master is the maintainer's 1048 x 1038 export (the old 1254 px master is [app-icon-v1.png](<../../src-tauri/icons/source/app-icon-v1.png>)); it is the same artwork tightly cropped, so `app-icon-fullbleed.png` and every generated size came out pixel-identical.

Small sizes, checked by eye (8x nearest-neighbour enlargements): at 32 px the
icon reads as headphones but with low contrast, the gold border a faint
beige ring; at 16 px the headband and cups merge into a dark blob and the
border nearly vanishes. Follow-up for the maintainer: a simplified small-size variant
(16 / 24 / 32 px) with a thicker gold band outline and no cushions, placed
into the `.ico` by hand or by a second source file.

### Brand verification (2026-10-11)

- `pnpm typecheck`: exit 0. `pnpm test`: `Test Files  17 passed (17)`,
  `Tests  77 passed (77)` (75 earlier + 2 HeadphoneArt). Drawing the slit
  unconditionally fails `draws the indicator slit and gold rims only with
  accent`.
- Browser pane, 420 x 760, computed styles: selected tab and wordmark
  `rgb(216, 168, 94)`, body `rgb(20, 20, 20)`, tab bar
  `rgba(35, 35, 35, 0.72)` with a `rgba(120, 110, 98, 0.5)` hairline, state
  title letter-spacing -0.34 px at weight 600, page title -0.3 px;
  `/icon.png` served 200 `image/png`. Still captures catch the pulse rings
  mid-breath, so the disc looks deeper than its 14 % tint.
- `tools/dev.ps1` (after touching build.rs): `Finished dev profile ... in
  7.84s`; window `SoundConnect Desktop`; its `WM_GETICON` small icon and the
  exe's associated icon both render the new charcoal-and-gold icon
  ((screenshot removed before publication), window
  icon left, exe icon right, 32 px enlarged). The window is frameless, so the
  icon shows in the taskbar and Alt+Tab, not in a title bar.

Screenshots (840 x 1520 device pixels for 420 x 760 unless noted):
(screenshot removed before publication) and
(screenshot removed before publication) (normal
path, searching state),
(screenshot removed before publication) (buttons,
device header, battery),
(screenshot removed before publication) (device header card crop, mirrored 2 px version),
(screenshot removed before publication) (native window,
543 x 960 at 125 % scaling, `PrintWindow`).

## Primitives

All live in `src/components/primitives/`, each with a CSS file beside it.

### Card

[Card.tsx](<../../src/components/primitives/Card.tsx>) /
[Card.css](<../../src/components/primitives/Card.css>). Props: `inset?`
(16 px padding), `accentEdge?` (the brand's gold hairline; device header
only), `children`. A rounded `--surface` block that clips its
children, so row highlights follow the corners. No semantics of its own.

### SectionHeader

[SectionHeader.tsx](<../../src/components/primitives/SectionHeader.tsx>) /
[SectionHeader.css](<../../src/components/primitives/SectionHeader.css>).
Props: `children` (string), `id?`, `action?`. Renders an `<h2>` (13 px
uppercase secondary) aligned with the card's text edge, plus an optional
trailing slot whose contents inherit accent text colour. Give it an `id` and
point a list's `aria-labelledby` at it. The first header on a page uses a
smaller top gap. Test:
[SectionHeader.test.tsx](<../../tests/primitives/SectionHeader.test.tsx>)
(heading plus id; the action renders and is clickable; no empty action box).

### GroupedList and ListRow

[GroupedList.tsx](<../../src/components/primitives/GroupedList.tsx>) /
[GroupedList.css](<../../src/components/primitives/GroupedList.css>): a `Card`
holding a `<ul>`; props `aria-label?` / `aria-labelledby?`, `children`.

[ListRow.tsx](<../../src/components/primitives/ListRow.tsx>) /
[ListRow.css](<../../src/components/primitives/ListRow.css>): renders its
own `<li>`. Props: `title`, `subtitle?`, `titleId?`, `leading?` (an
`<Icon>`, tinted accent and sized 22 px by the row), `trailing?`,
`disclosure?` (grey chevron), `selected?`, `onPress?`. `selected` marks the
chosen option of a single-choice picker list: it draws an accent check and
sets `aria-current="true"`, so the choice is announced and not only drawn
(use it rather than putting a check icon in `trailing`, which `Icon` hides
from assistive technology). With `onPress` the row's content is
a `<button>` with hover and pressed fills and an inset focus ring (the card
clips overflow, so an outset ring would be cut off); trailing content must
then be non-interactive. Without `onPress` it is plain content and the
trailing slot may hold a control. The separator is an inset box-shadow on the
row's main box, so it starts exactly at the title's left edge and runs to the
card's right edge. Test: [ListRow.test.tsx](<../../tests/primitives/ListRow.test.tsx>)
(an `onPress` row is a button fired by Enter; a `selected` row carries
`aria-current`; a plain row has no button and the list is named).

### ToggleRow

[ToggleRow.tsx](<../../src/components/primitives/ToggleRow.tsx>) (no CSS of its
own). Props: `title`, `subtitle?`, `leading?`, `checked`, `onChange`,
`disabled?`. A `ListRow` with a trailing `Toggle` labelled by the row title
through a `useId` id; it exists because every boolean setting row (Task 16)
would otherwise repeat that id wiring. Covered in the Toggle test.

`ListRow` gained `disabled?` in Tasks 15 / 16: a pressable row's button is
disabled and dimmed to `--opacity-disabled`, with no hover or pressed fill
(a picker row while disconnected, or before the device has listed its
choices).

### SegmentedControl

[SegmentedControl.tsx](<../../src/components/primitives/SegmentedControl.tsx>)
/ [SegmentedControl.css](<../../src/components/primitives/SegmentedControl.css>),
selection logic in [useSegmentedSelection.ts](<../../src/hooks/useSegmentedSelection.ts>).
Props: `label` (group name), `options: {value, label, icon?}[]`, `value`,
`onChange`, `disabled?` (dims the group, sets `aria-disabled` and disables
every segment, so it leaves the tab order; for example while disconnected).
Accessibility: `role="radiogroup"` with `aria-label`; each segment
is a `<button role="radio" aria-checked>`; only the checked segment is in the
tab order; Left/Up, Right/Down, Home and End select and focus the neighbour
of the focused segment (selection follows focus, the WAI-ARIA radio-group
pattern), clamping at the ends like the rest of the app; Space/Enter/click
select. `value` may be confirmed asynchronously (a device echo), so while a
request is pending every choice is sent, and the request is forgotten
whenever `value` changes: clicking Ambient and then Noise cancelling before
the echo sends both, clicking Ambient again after a lost or rejected echo
retries it (the command is idempotent), and keys step from the focused
segment, so two quick presses reach the third segment. Clicking the
confirmed segment with nothing pending sends nothing. If `value` is not
among the options, no segment is checked, no pill is drawn and the first
segment is the tab stop. Segments size to
their content and share the remaining width, so "Noise cancelling" next to
"Off" does not truncate at 380 px. The pill is a `motion.span` with a
per-instance `layoutId` (`useId`).

Why not `useRovingTabIndex`: that hook keeps its own focused index, applied
once from `initialIndex`, deliberately so a selection change does not steal
the keyboard position. In a radio group the tab stop must always be the
selected value (including when the value changes from outside, for example a
device notification), and arrows must change the selection, not only focus.
Reusing the hook would mean two sources of truth for one index. The new hook
reuses the hook file's pure `nextRovingIndex` for the key maths; its only
state is the pending request. Test: [SegmentedControl.test.tsx](<../../tests/primitives/SegmentedControl.test.tsx>)
(single tab stop; arrows and End change selection, focus and call `onChange`;
no call at the end; stepping while `value` lags; clicks while `value` lags
all arrive; a pending option is resent when its echo never arrives; clicking the confirmed segment sends nothing; disabled is inert;
a value outside the options; click selects).

### Toggle

[Toggle.tsx](<../../src/components/primitives/Toggle.tsx>) /
[Toggle.css](<../../src/components/primitives/Toggle.css>). Props: `checked`,
`onChange`, `disabled?`, and exactly one of `labelledBy` (preferred) or
`label`: the props type is a union, so a switch without an accessible name
does not compile. A native
`<button role="switch" aria-checked>`, so Space and Enter toggle it with no
key code of its own. The knob travel is computed in CSS from the switch
tokens. Gold when on (`--switch-on`, Sony) since Task 13b; iOS green before. Test:
[Toggle.test.tsx](<../../tests/primitives/Toggle.test.tsx>) (switch role and
name; click and Space flip `aria-checked`; ToggleRow names its switch).

### Slider

[Slider.tsx](<../../src/components/primitives/Slider.tsx>) /
[Slider.css](<../../src/components/primitives/Slider.css>), commit logic in
[useCommitOnRelease.ts](<../../src/hooks/useCommitOnRelease.ts>). Props:
`label`, `value`, `min`, `max`, `step?`, `onChange`, `onCommit?`,
`onGestureChange?`, `formatValue?`, `leading?`, `disabled?` (`leading`,
added in Task 14, is a decorative glyph before the label in
`--text-secondary`; the header centres label and value since then, because a
label holding a glyph is a flex box whose baseline no longer matches the
value's). A native
`<input type="range">` with a visible `<label>` and an `<output>` showing the
formatted value, also exposed as `aria-valuetext`. `onChange` fires for every value; `onCommit` fires once per
gesture: on pointer release (only the primary button starts a drag; the
input captures the pointer on pointer-down, so the release arrives even
outside it; pointer cancel and blur also end a gesture) and on release of a
value key (arrows, Page Up/Down, Home, End), and not at all if the gesture
ended where it started. A gesture remembers its source, so a key release
cannot end a drag (which would otherwise commit on every later move). A value reported outside
any gesture (assistive technology setting it directly) commits at once. The
gesture's start is read from the controlled `value` when it begins, so a
value that changed from outside while idle (a device notification) is the
baseline. During a gesture the slider shows the user's latest value, not the
`value` prop, so a device echo arriving mid-drag cannot move the thumb under
the pointer, and the commit carries the user's value (even if the parent
clamps or rejects `onChange`). `onGestureChange(true / false)` reports the
gesture; pages should hold device echoes until `onGestureChange(false)`
rather than feeding them into `value` mid-gesture. If the slider becomes
`disabled` during a gesture (a disabled input gets no pointerup, and Chromium
does not reliably blur it), the gesture ends at once, so `onGestureChange`
reports false and the slider shows `value` again. After release the slider
shows `value` again; a page that wants no snap-back until the device confirms
keeps the committed value locally (`useOptimisticValue`). Later device commands (ambient level, volume, EQ bands) should be
sent from `onCommit`. Styling uses Chromium's
`-webkit-slider-*` pseudo-elements only (WebView2 and the dev browser are
both Chromium); the filled part of the track is a gradient between the
`--slider-fill-from` and `--slider-fill-to` custom properties; the focus ring is drawn on the thumb.
Tasks 15 / 16 added `origin?` (the value the fill grows from, default `min`;
signed controls such as EQ bands pass 0, so +3 fills right of the centre and
-3 left of it) and `layout?` (`stacked`, the default, or `inline`: label in a
`--slider-inline-label-width` column, the track, then the value right-aligned
in `--slider-inline-value-width`, on one row whose input is a full
`--row-min-height` 44 px hit target; Chromium centres track and thumb in it). Test:
[Slider.test.tsx](<../../tests/primitives/Slider.test.tsx>) (label and
formatted value; drag reports each value and commits once with the last;
no-op press does not commit; pointer cancel and blur end a gesture; blur
after a finished drag does not commit again; a change outside a gesture,
including right after a finished drag, commits at once; an external value
while idle becomes the next gesture's baseline; an external value mid-drag
neither moves the shown value nor changes the commit, and `onGestureChange`
reports true then false; becoming disabled mid-drag ends the gesture and
shows `value`; a key release cannot end a drag; a right-button
press starts nothing; a held key commits once on key-up).

### SheetButton

[SheetButton.tsx](<../../src/components/primitives/SheetButton.tsx>) /
[SheetButton.css](<../../src/components/primitives/SheetButton.css>). Props:
`children`, `onPress`, `variant?` (`primary` filled accent, `secondary`
tinted accent, `destructive` tinted red), `disabled?`. A full-width 50 px
native button.

### Pill

[Pill.tsx](<../../src/components/primitives/Pill.tsx>) /
[Pill.css](<../../src/components/primitives/Pill.css>). Props: `children`,
`tone?` (`neutral | accent | success | warning`). A read-only `<span>` chip;
when its meaning matters to a screen reader, put the meaning in the text.

### Icons

[Icon.tsx](<../../src/components/icons/Icon.tsx>) keeps one map of glyphs;
Task 12 added `chevron-right`, `check`, `speaker`, `waveform`
and `moon` beside the caption glyphs; Task 13 added `house`,
`sliders-horizontal`, `gear` (tab bar) and `bolt` (charging; drawn to be
rendered filled). Task 13b had replaced the generic headphones glyph with
an XM4-specific `headphones-xm4`; Task 26 renamed it back to the generic
`headphones` (band and cups, no status slit). It is used by the System tab
and the gallery's Wearing detection row; the connection screens show Sony's
product photos instead (see [Product images](#product-images)). Task 14 added
`noise-cancelling` (two sound waves struck through), `ambient` (two sound
waves) and `power` (Off) for the noise-mode segments, and `play`, `pause`,
`skip-back`, `skip-forward` for the transport row; the transport glyphs are
drawn to be rendered filled (`fill="currentColor"`), the round stroke joins
softening their corners.

### Disclosure

[Disclosure.tsx](<../../src/components/primitives/Disclosure.tsx>) /
[Disclosure.css](<../../src/components/primitives/Disclosure.css>), state in
[useDisclosure.ts](<../../src/hooks/useDisclosure.ts>). Props: `summary`
(toggle text), `children`. An accent text button with a chevron that turns
when open; the button carries `aria-expanded` / `aria-controls` and the panel
is `hidden` while closed, so closed content is neither shown nor announced.
`useDisclosure(initiallyOpen?)` returns `open`, `toggle`, `buttonProps` and
`panelProps` for any other show/hide UI. Hover fades the toggle to
`--opacity-hover`. Covered by the ConnectionError test.

### Sheet

[Sheet.tsx](<../../src/components/primitives/Sheet.tsx>) /
[Sheet.css](<../../src/components/primitives/Sheet.css>), focus handling in
[useFocusTrap.ts](<../../src/hooks/useFocusTrap.ts>), open state in
[useSheet.ts](<../../src/hooks/useSheet.ts>) (`useSheet(disabled?)` returns
`{open, show, hide}`; while `disabled` the sheet cannot open and an open one
closes, so a sheet left open across a disconnect cannot send a pick or a
confirmation), page hiding in
[useHideOutside.ts](<../../src/hooks/useHideOutside.ts>). Props: `open`, `onClose`, `title`, `message?`, `initialFocus?`
(a ref), `children`. An iOS bottom sheet rendered with `createPortal` into
`document.body`, as a fixed layer that starts below the title bar
(`--titlebar-height`), so the caption buttons and the drag region keep
working while it is open. The panel is `role="dialog"`, `aria-modal="true"`,
named by its visible title (`aria-labelledby`) and described by `message`
(`aria-describedby`). It has a 36 x 5 px grabber (`--sheet-handle-width` /
`--sheet-handle-height`, `--text-tertiary`), `--radius-lg` (28 px) top
corners, the grouped page colour `--bg` (so `GroupedList` cards inside look
as they do on a page), a `--surface-edge` top hairline and `--shadow-3`, and
grows to `--sheet-max-height` (88 % of the layer) before its body scrolls.
The backdrop is `--backdrop` (black at 30 % light, 60 % dark). Motion:
framer-motion slides the panel from `y: 100%` with the app spring and fades
the backdrop with a `durations.base` tween; under reduced motion
(`useReducedMotionConfig`, which reads the app's `MotionConfig`) both run
with zero duration.

Behaviour: Escape (handled on the panel, so only while focus is inside it)
and a backdrop click call `onClose`; a click inside does not. On open,
`useFocusTrap` remembers the focused element (the opener) and focuses
`initialFocus`, else the chosen option of a picker (`button[aria-current]`),
else the first focusable, else the panel; Tab and Shift+Tab wrap between the
first and last focusable inside; on close or unmount it gives focus back to
the opener if it is still in the document. Focus returns at once, while the
exit animation is still running. While open, `useHideOutside` sets
`aria-hidden="true"` on every other child of `document.body` (restored on
close), so a screen reader's virtual cursor stays in the sheet. It uses
`aria-hidden`, not `inert`, so the title bar still drags and its caption
buttons still work with the pointer; the focus trap keeps the keyboard in.
Caveat: the opener is read from `document.activeElement`, which is right in
WebView2 (Windows, the target) and Chromium, where a clicked button takes
focus; WKWebView does not focus clicked buttons, so a macOS build would need
the opener passed explicitly.

### OptionList and PickerRow

[OptionList.tsx](<../../src/components/primitives/OptionList.tsx>): props
`label`, `options: {value, label}[]` (generic `Option<T>`), `value`,
`onSelect`. A `GroupedList` of pressable `ListRow`s with the chosen one
`selected` (check plus `aria-current`); values are compared with
`Object.is`, so `null` can be an option (auto power off "Never").

[PickerRow.tsx](<../../src/components/primitives/PickerRow.tsx>): props
`title`, `sheetTitle?`, `options`, `value`, `onChange`, `valuePlacement?`
(`trailing`, the iOS value text, or `subtitle` for long values such as a
button's function, so nothing truncates at 380 px), `unknownLabel?`
(default "Unknown", shown when `value` is not an option), `leading?`,
`disabled?`. A disclosure `ListRow` that opens a `Sheet` holding an
`OptionList`; picking calls `onChange` and closes, picking the current value
only closes. It is disabled while `options` is empty, and becoming disabled
closes an open sheet (`useSheet(disabled)`). Option values are primitives
(`OptionValue`: string, number, boolean or null), so `String(value)` is a
unique key. One component serves
every pick-one setting: equalizer preset, auto power off and each
assignable control. `SheetButton` also takes `ref?` since then, so a
confirmation can focus Cancel first.

## Gallery route

[GalleryPage.tsx](<../../src/pages/GalleryPage.tsx>) /
[GalleryPage.css](<../../src/pages/GalleryPage.css>) show every primitive in
realistic combinations with local demo state: status chips with an "Edit"
header action, a Noise control card (3-way segmented control and ambient
slider), a settings list (two toggle rows, two disclosure rows), an Auto
power off picker using `selected`, and the three button variants. A
"Sent ambient" chip shows the last value the slider's `onCommit` delivered,
standing in for a device command.
[useGalleryRoute.ts](<../../src/hooks/useGalleryRoute.ts>) reads `?gallery=1`
once at mount (its parser `isGalleryQuery` is tested in
[galleryRoute.test.ts](<../../tests/renderer/galleryRoute.test.ts>)) and is always false in production; `App.tsx` also imports the
page only when `import.meta.env.DEV`, so a production build emits no gallery
chunk (checked with `pnpm build`: only `index-*.js` / `index-*.css`). Open it
with `pnpm dev:web` and `http://localhost:1420/?gallery=1`.

Task 13 appended a "Shell" part: `ConnectedHome` with demo values (device
header for "WH-1000XM4", 83 %, not charging, LDAC, then its placeholder
section), battery gauges at 100 % (charging), 55, 15 and 5 %, the three
connection-state cards (the error's "Try again" logs `[gallery] retry
pressed`), and a live "Retry cycle": a `ConnectionStatus` whose Try again
switches to connecting and fails again after two seconds, for trying the
announcer and the focus move with a screen reader.

## Desktop frame

Task 23. The maintainer, 2026-10-12: "I do not like that the app opens in the shape of
a phone screen instead of being like a windows app ... the nav bar should be
on the left, not bottom. There are a lot of menus missing". So the frame was
rebuilt Windows 11 Settings style ("iOS smooth, Sony-styled,
desktop-shaped") and the missing menus added ([New menus](#new-menus-task-23)).
Primitives, radii and motion are unchanged; the frame, the page layout and
the new cards are new.

### Window

[tauri.conf.json](<../../src-tauri/tauri.conf.json>): default 1180 x 760,
minimum 960 x 620 (was 420 x 760, minimum 380 x 600), resizable. The
window-state plugin (registered in Rust) restores the last size; a stored
size below the new minimum is raised to it.

### Frame layout

[AppFrame.tsx](<../../src/components/frame/AppFrame.tsx>) /
[AppFrame.css](<../../src/components/frame/AppFrame.css>): with a `nav` it is
a `[rail][content]` grid. The rail spans both rows (the title-bar row
included); the [TitleBar](<../../src/components/frame/TitleBar.tsx>) (drag
region and caption buttons, `wordmark` now optional) and the content share
the second column. The content is a scroll area whose page column is at most
`--content-max-width` (1100 px) wide, centred, with `--page-gutter` (24 px)
padding; the column is a size container (`container: page`) for the card
grid. The new `heading` prop renders at the top of the page column, so the
page title ([PageTitle](<../../src/components/page/PageTitle.tsx>), now 28 px
display semibold) sits at the top of the content, not in the title bar.
`footer` (the bottom tab bar slot) is gone.

### Navigation rail

- [NavRail.tsx](<../../src/components/frame/NavRail.tsx>) /
  [NavRail.css](<../../src/components/frame/NavRail.css>): the `<aside>`:
  a title-bar-height drag strip with the gold wordmark, the device block,
  the page list. 240 px (`--rail-width`) on `--sidebar-bg` (a step off
  `--bg`: `#e8e8ed` light, `#1c1c1c` dark) with a `--sidebar-edge` hairline;
  72 px icon-only (`--rail-width-collapsed`, no wordmark) below a 1000 px
  window (`RAIL_COLLAPSED_QUERY` in [AppShell.tsx](<../../src/components/shell/AppShell.tsx>),
  read with [useMediaQuery](<../../src/hooks/useMediaQuery.ts>), which now
  answers false where `matchMedia` is missing, as in jsdom).
- [RailDevice.tsx](<../../src/components/frame/RailDevice.tsx>) /
  [RailDevice.css](<../../src/components/frame/RailDevice.css>): props
  `name`, `state`, `connected`, `percent?`, `charging?`, `codec?`,
  `collapsed?`. A small card: the model's 72 px product-photo thumbnail
  (`DeviceImage`, see [Product images](#product-images)), the name, a state line with a green or grey dot, and battery
  and codec chips while connected. Collapsed: the 40 px photo alone, name and
  state as tooltip and hidden text. The battery chip is the new
  [BatteryPill.tsx](<../../src/components/shell/BatteryPill.tsx>) (spoken
  "Battery 90%", warning tone below 20 %), not a second `meter`, so the
  Status page keeps the one battery meter. Fed by
  [useRailDeviceProps](<../../src/hooks/engine/useRailDeviceProps.ts>):
  connected, the header's values and "Connected"; otherwise the status's
  device name (else "Headphones") and `connectionStateLabel`: "Off or out of
  range", "Connected to Windows", "Connecting…", "Reconnecting to …" or
  "Couldn't connect". Since 0.1.9 the block is a centred column (photo,
  name, state line, chips), expanded and collapsed, as the maintainer asked:
  ![Rail before, dark](<screenshots/task31-rail-before.png>)
  ![Rail after, dark](<screenshots/task31-rail-after.png>)
  ![Collapsed rail before](<screenshots/task31-rail-collapsed-before.png>)
  ![Collapsed rail after](<screenshots/task31-rail-collapsed-after.png>).
- [SideNav.tsx](<../../src/components/frame/SideNav.tsx>) /
  [SideNav.css](<../../src/components/frame/SideNav.css>) and
  [NavItem.tsx](<../../src/components/frame/NavItem.tsx>) /
  [NavItem.css](<../../src/components/frame/NavItem.css>) (the pattern read
  from Hue Desktop's rail): a `<nav aria-label="Pages">` list of buttons, the
  open page `aria-current="page"`. 40 px rows (`--nav-item-height`), 20 px
  glyph, 15 px label (semibold when selected), hover and pressed fills. The
  selection is one `motion.span` with a shared `layoutId`, so the soft
  `--nav-selected-bg` fill and its gold bar (3 x 16 px, vertically centred,
  Windows 11's indicator) slide between items on the app spring. Keyboard:
  roving tabindex through
  [useRovingTabIndex](<../../src/hooks/useRovingTabIndex.ts>) (now
  tolerating a missing `scrollIntoView`): one tab stop; arrows, Home and End
  move focus without opening (manual activation, as Windows Settings does);
  Enter, Space or a click opens; the tab stop follows the open page. The
  focus ring is drawn inset. Collapsed items keep the label as accessible
  name and `title` tooltip.
- [navPages.ts](<../../src/components/frame/navPages.ts>): the pages, their
  glyphs and, since Task 30, their hierarchy. Six top-level pages: Status
  `house`, Sound `sliders-horizontal`, System `headphones`, Devices `devices`
  (new in [Icon.tsx](<../../src/components/icons/Icon.tsx>): a laptop beside
  a phone; also new: `bluetooth`, `chat`, `info`, `phone`, `plus`), Windows
  audio `speaker`, Settings `gear`. Sound has two sub-pages, each an item
  with `parent: "sound"`: Equalizer `waveform` and Noise control
  `noise-cancelling`. `navTrail(items, page)` returns a page's ancestors,
  outermost first (the breadcrumb).
- [navStore.ts](<../../src/state/navStore.ts>): `page: "status" | "sound" |
  "equalizer" | "noise" | "system" | "devices" | "windowsAudio" |
  "settings"` (default `status`) and `setPage`; in memory only. A sub-page is
  an ordinary page value; the hierarchy lives in `navPages` alone. Test:
  [navStore.test.ts](<../../tests/shell/navStore.test.ts>).

### Sub-pages in the rail (Task 30)

The maintainer, 2026-10-14, on 0.1.7's Sound page (an empty left column, two cards
stranded on the right): "Don't you think equalizer should fall under sound
settings? Get that as a sub menu within sound. Noise control as well. Please
use common sense when making the menus." So the rail is now six top-level
pages, and Equalizer and Noise control are sub-pages of Sound, Windows 11
Settings style:

- [visibleNavTree.ts](<../../src/components/frame/visibleNavTree.ts>) (pure):
  the visible rows for the open page. Every top-level item, each with its
  sub-pages listed only while it or one of them is open; the rest of the
  time they are folded away, so the rail stays six rows.
- [SideNav.tsx](<../../src/components/frame/SideNav.tsx>) /
  [SideNav.css](<../../src/components/frame/SideNav.css>): renders the tree,
  the sub-pages in a nested list named "Sound pages" inside the parent's
  `<li>`. The roving tab stop runs over the flattened visible rows, so Down
  from Sound reaches Equalizer, then Noise control, then System; Enter opens.
  It stays one `aria-current="page"`: only the open page carries it. The
  parent carries no `aria-expanded`: it navigates rather than toggles
  (clicking an open Sound never folds it), so announcing "expanded" would
  promise a toggle that is not there; the labelled nested list is the
  structure assistive tech reads (from the independent review).
- [NavItem.tsx](<../../src/components/frame/NavItem.tsx>) /
  [NavItem.css](<../../src/components/frame/NavItem.css>): `child` rows are
  36 px (`--nav-child-height`) with an 18 px glyph
  (`--nav-child-icon-size`), indented so the glyph sits under the parent's
  label. The open page keeps the sliding fill and gold bar; while a sub-page
  is open its parent is `ancestor` (gold glyph, semibold label, no fill), so
  the group reads at a glance without two highlighted rows.
- Collapsed rail (icon-only, below a 1000 px window): the decision is to keep
  the sub-pages visible as icons, not a flyout. They sit in a faint tinted
  group (`--nav-group-bg`) right under Sound's icon, each with its label as
  tooltip and accessible name. A flyout would hide a one-click destination
  behind hover, and showing only the parent would make Equalizer two clicks
  away at the minimum window size.
- [PageTitle.tsx](<../../src/components/page/PageTitle.tsx>) /
  [PageTitle.css](<../../src/components/page/PageTitle.css>): `trail` (from
  `navTrail` in [AppShell.tsx](<../../src/components/shell/AppShell.tsx>))
  renders "Sound › Equalizer" in the 28 px title type: the ancestors in
  secondary ink as buttons in a "Breadcrumb" navigation (gold on hover,
  tooltip "Back to Sound"), an `aria-hidden` chevron, then the page's `<h1>`,
  which alone names the page region. The "Sound" crumb is the back
  affordance; there is no separate back button.

Tests: [SideNav.test.tsx](<../../tests/shell/SideNav.test.tsx>) (six rows on
Status, children listed and indented once Sound is open, a child alone
`aria-current` with Sound as `ancestor`, arrows reach the children, the
group folds away on leaving with the tab stop on the page opened,
collapsed tooltips; `visibleNavTree` and
`navTrail`), [PageTitle.test.tsx](<../../tests/shell/PageTitle.test.tsx>)
(plain `<h1>`; the crumb is a named link that goes back), and
[AppShell.test.tsx](<../../tests/shell/AppShell.test.tsx>) (the entry cards
open Equalizer and Noise control, the title and rail follow, the crumb
returns to Sound).

The bottom tab bar (`TabBar`, `TabItem`, `appTabs`, the `--tabbar-*`
tokens) and its test `tests/shell/TabBar.test.tsx` were deleted: the rail
replaces it, and [SideNav.test.tsx](<../../tests/shell/SideNav.test.tsx>)
covers the same ground (roles, one tab stop, arrows, Home, End, clamping,
click).

### App shell

[AppShell.tsx](<../../src/components/shell/AppShell.tsx>) /
[AppShell.css](<../../src/components/shell/AppShell.css>) compose the
frame: the rail (device block, `SideNav`), the page's `<h1>` as the frame
`heading` (one id per page, because the leaving page's heading is still in
the document while it fades), and the page in a `role="region"` named by
that heading (it passes the page column's flex through, so a connection
state still fills the height), with the alert banner on top. The
`ConnectionAnnouncer` stays outside the page transition. Not connected, the
rail still renders and every item stays enabled; Status shows
`ConnectionStatus`, the other device pages
[NotConnectedSection](<../../src/components/page/NotConnectedSection.tsx>):
one quiet "Connect your headphones to change these settings." card across
the page, with no section label since Task 30 (the label repeated the page
title, "SOUND" under "Sound").

### Card grid

[CardGrid.tsx](<../../src/components/page/CardGrid.tsx>) /
[CardGrid.css](<../../src/components/page/CardGrid.css>): `CardGrid` holds
`CardStack`s; one column, or two (24 px apart) once the page column is at
least 700 px wide (a container query on `page`; container queries cannot read
custom properties, so 700 is literal there). That gives two 434 px columns at
the default 1180 px window and two 408 px columns at the 960 px minimum with
the rail collapsed, close to the 388 px the cards were drawn for. The brief
asked for two columns only from 1100 px of content width; with an 1100 px
maximum that would never happen at the default size, so the threshold
follows the column width instead (open question 8). Pages put cards that
belong together in one `CardStack` so the columns balance (CSS columns would
let a revealing slider push cards from one column into the other);
`CardStack span="full"` spans both (the Status device card).

Stacks fill left to right, row by row. Since Task 30 a `CardStack` whose
children are all `null` / `false` / `undefined` renders nothing, and
`.card-stack:empty` is `display: none` for one whose children rendered
nothing, so an empty stack never holds a cell. That was the 0.1.7 Sound bug:
the first stack had held the equalizer, which moved to its own page, so the
column stayed empty and the remaining cards sat alone on the right. Now a
lone card always lands in the left column at half width. Test:
[CardGrid.test.tsx](<../../tests/shell/CardGrid.test.tsx>).

### Pages

| Page | First column | Second column |
| --- | --- | --- |
| [StatusPage](<../../src/pages/StatusPage.tsx>) ([StatusSections](<../../src/components/status/StatusSections.tsx>)) | device card across both columns (large art, name, battery, codec, firmware); then the quick noise switch | Now playing |
| [SoundPage](<../../src/pages/SoundPage.tsx>) ([SoundOverview](<../../src/components/sound/SoundOverview.tsx>)) | Equalizer entry card; Bluetooth connection quality | Noise control entry card; Speak-to-Chat |
| Sound › [EqualizerPage](<../../src/pages/EqualizerPage.tsx>) ([EqualizerSections](<../../src/components/equalizer/EqualizerSections.tsx>)) | curve and presets across both columns; then Bands | Sound quality (DSEE) |
| Sound › [NoiseControlPage](<../../src/pages/NoiseControlPage.tsx>) ([NoiseControlSections](<../../src/components/noise/NoiseControlSections.tsx>)) | Ambient sound control (switch, slider, Focus on voice) | Button function (the assignable button, moved here from System); phone-only note (Adaptive Sound Control) |
| [SystemPage](<../../src/pages/SystemPage.tsx>) ([SystemSections](<../../src/components/system/SystemSections.tsx>)) | Device: touch sensor, automatic pause, auto power off | Notification & voice guide, Power off; phone-only note (Software update, Activity and badges) |
| [DevicesPage](<../../src/pages/DevicesPage.tsx>) ([DevicesSections](<../../src/components/devices/DevicesSections.tsx>)) | Multipoint, Paired devices | New device (pairing) |
| [WindowsAudioPage](<../../src/pages/WindowsAudioPage.tsx>) | see [Windows audio page](#windows-audio-page) | |
| [SettingsPage](<../../src/pages/SettingsPage.tsx>) | Appearance, Startup | About |

### Sound overview (Task 30)

[SoundOverview.tsx](<../../src/components/sound/SoundOverview.tsx>) is Sound's
overview: four cells, each its own `CardStack`, so the grid fills left to
right and any missing card closes up instead of leaving a hole. First row,
the two entry cards into the sub-pages; second row, Bluetooth connection
quality beside Speak-to-Chat. DSEE stays on the Equalizer page under "Sound
quality".

- [EntryCard.tsx](<../../src/components/page/EntryCard.tsx>) /
  [EntryCard.css](<../../src/components/page/EntryCard.css>): the shared unit,
  one button the size of a card (`--entry-card-height` 76 px, the card
  surface and radius): a 40 px glyph tile on the accent tint, the current
  state as a 17 px semibold headline over a 13 px summary, an optional
  decorative miniature (up to 120 px), a chevron. Its accessible name is
  "title, value, detail" ("Equalizer, Bright, Clear Bass −1").
- [EqualizerEntryCard.tsx](<../../src/components/equalizer/EqualizerEntryCard.tsx>)
  (+ [EqualizerEntryCard.css](<../../src/components/equalizer/EqualizerEntryCard.css>),
  the curve in the accent): the current preset, "Clear Bass n", and the
  existing `EqSparkline` of the preset's recorded curve. Fed by
  [useEqualizerEntryProps](<../../src/hooks/engine/useEqualizerEntryProps.ts>),
  which takes the curve from
  [usePresetCurves](<../../src/hooks/engine/usePresetCurves.ts>) (extracted
  from `EqualizerPage`, which now uses it too) and falls back to the live
  bands for a listener-edited preset or a model without a fixture.
- [NoiseControlEntryCard.tsx](<../../src/components/noise/NoiseControlEntryCard.tsx>):
  the mode as Sony names it (Noise cancelling, Wind noise reduction, Ambient
  sound, Off), a summary (`noiseSummary`: "Blocks surrounding sound", "Also
  cuts the sound of wind", "Level n of 20" plus "· Focus on voice", "Ambient
  sound control is off") and
  [AmbientLevelMeter](<../../src/components/noise/AmbientLevelMeter.tsx>)
  ([AmbientLevelMeter.css](<../../src/components/noise/AmbientLevelMeter.css>)),
  the ambient slider in miniature at the current stop. Fed by the existing
  `useNoiseControlProps` (the same view the Noise control page uses).
- `SoundPage` adds `onOpen` (`setPage("equalizer")` / `setPage("noise")`).
  The Status page's quick noise switch is unchanged.

`SoundSections` was deleted (the overview replaces it); the gallery's
[SoundDemo](<../../src/pages/gallery/SoundDemo.tsx>) shows the overview and,
under it, the band card and DSEE row. Tests:
[SoundOverview.test.tsx](<../../tests/sound/SoundOverview.test.tsx>) (entry
cards first, named with their state, opening their pages; a lone card takes
the only cell; `noiseSummary`), and
[enginePages.test.tsx](<../../tests/engine/enginePages.test.tsx>) (the
recorded snapshot's "Bright, Clear Bass −1" entry card with its fixture
sparkline).

`HomePage` / `ConnectedHome` became `StatusPage` / `StatusSections`.
[DeviceHeader.tsx](<../../src/components/shell/DeviceHeader.tsx>) /
[DeviceHeader.css](<../../src/components/shell/DeviceHeader.css>) gained
`firmware?` and set art and details side by side from a 720 px window
(160 px art; 28 px name). The phone-only footnote is
[PhoneOnlyNote.tsx](<../../src/components/page/PhoneOnlyNote.tsx>) /
[PhoneOnlyNote.css](<../../src/components/page/PhoneOnlyNote.css>) (a
labelled "Only in the phone app" section holding an `InfoNote`), so a menu
Sony's phone app has and a PC cannot offer reads as a decision.

New primitives: [InfoNote.tsx](<../../src/components/primitives/InfoNote.tsx>) /
[InfoNote.css](<../../src/components/primitives/InfoNote.css>) (a 16 px
glyph and 13 px secondary text inside a card) and
[SheetActions.tsx](<../../src/components/primitives/SheetActions.tsx>) /
[SheetActions.css](<../../src/components/primitives/SheetActions.css>) (a
sheet's column of buttons, 12 px apart; `PowerOffRow` uses it instead of its
own CSS). Sheets keep their old 592 px width (`--sheet-max-width`), centred.

### GUI audit (Task 30, 2026-10-14)

Every page (Status, Sound, Equalizer, Noise control, System, Devices,
Windows audio, Settings), connected to the mock and not connected, dark and
light, at 1180 x 760 and 960 x 620 (rail collapsed), headless Edge over CDP
against `pnpm dev:web`, with a DOM probe per page: grid cell rectangles,
section header and card left edges, ellipsis truncation, horizontal
overflow. Findings and fixes:

1. Sound (0.1.7): an empty left column with two cards stranded on the
   right. Fixed by the overview and by `CardStack` never holding an empty
   cell ([Card grid](#card-grid)).
2. Equalizer and Noise control were top-level rail rows; now Sound's
   sub-pages with a breadcrumb title.
3. The breadcrumb title was 3.5 px taller than a plain title (its parts
   inherited the body's 1.45 leading, the plain `<h1>` the heading 1.2), so
   the content jumped between Sound and Sound › Equalizer. `.page-title` now
   sets `--leading-tight` itself; both forms measure 53.6 px at the same top.
4. Not connected, every device page labelled its one card with a header
   that repeated the title ("SOUND" under "Sound", "EQUALIZER" under "Sound ›
   Equalizer"). `NotConnectedSection` dropped the label (and its `title`
   prop).
5. Found by the independent review: leaving the Sound group (Equalizer, then
   System) left the rail's tab stop on Windows audio. The folded list put
   System at Equalizer's old index, so the "tab stop follows the open page"
   effect did not re-run; it is now keyed on the page as well, and the test
   checks the tab stop after the fold. The review also had `aria-expanded`
   removed from Sound (it navigates, never toggles).

Checked and left as is: every grid starts at the 24 px gutter (264 px at
1180, 96 px at 960) and ends 24 px from the window; two-column cells are 434
px (408 px at 960) with a 24 px gap; no page has an empty column or a cell
alone on the right; no truncated text and no horizontal overflow at 960 px;
section headers sit on the card's 16 px text inset on every page (the iOS
grouped-list rule the app uses throughout), so their text lines up with the
card content beneath; focus rings show on rail rows (sub-pages included),
entry cards and the crumb.

Screenshots (dark unless named):
(screenshot removed before publication),
(screenshot removed before publication),
(screenshot removed before publication) (Noise
control open: the child selected, Sound as its group),
(screenshot removed before publication),
(screenshot removed before publication) (960 x 620, collapsed
rail with the sub-page icons in their group).

### Desktop frame tokens

`--rail-width` 240, `--rail-width-collapsed` 72, `--nav-item-height` 40,
`--nav-icon-size` 20, `--nav-indicator-width` / `-height` 3 / 16,
`--nav-child-height` 36 and `--nav-child-icon-size` 18 (a sub-page row),
`--entry-card-height` 76, `--nav-group-bg` (the collapsed rail's sub-page
group), `--rail-art-size` 72, `--page-gutter` 24, `--content-max-width` 1100 (was
560), `--page-max-width`, `--sheet-max-width` 592, `--page-title-size`
(`--font-size-2xl`), `--sidebar-bg`, `--sidebar-edge`, `--nav-selected-bg`
(accent at 14 % light, 16 % dark: a touch above chips so it reads on the
rail). Removed: `--tabbar-height`,
`--tabbar-icon-size`, `--tabbar-reserve`.

## New menus (Task 23)

What the headphones report, quoted from the recording
[xm4-ready.json](<../../tests/fixtures/snapshots/xm4-ready.json>):
`"speakToChat": {"enabled": false, "sensitivity": "auto", "timeout": "short"}`,
`"connectionMode": {"audioPriority": "stability"}`,
`"pairing": {"enabled": false}`,
`"power": {"autoPowerOffMinutes": 0, "wearingPower": "unavailable", "autoPause": true, ...}`,
`generalSettings[1]` with `"subject": "MULTIPOINT_SETTING"`, `"value": true`,
`"summary": "MULTIPOINT_SETTING_SUMMARY"`, and three `pairedDevices`
`{connected, playbackDevice, macAddress, name}`: Desktop-1
(`00:11:22:33:44:51`, connected and playback), Laptop-1 and Phone-1
(`00:11:22:33:44:52` / `:53`; placeholders, the real names and addresses are scrubbed).
Available: `SPEAK_TO_CHAT`, `PAIRED_DEVICE_MANAGEMENT`, `PAIRING_MODE`,
`CONNECTION_MODE`, `AUTO_PAUSE`, `WEARING_DETECTION`; unavailable:
`ADAPTIVE_AMBIENT_SOUND`, `LISTENING_MODE`, `SAFE_LISTENING`, `HEAD_GESTURE`.

Commands, added to [types.ts](<../../src/lib/engine/types.ts>) and
[applyCommand.ts](<../../src/lib/engine/applyCommand.ts>) (so the mock and
the optimistic layer apply them; the engine side was added in parallel by
another agent with these exact shapes):
`{"type":"setSpeakToChat","enabled","sensitivity":"auto"|"low"|"high","timeout":"short"|"medium"|"long"|"manual"}`,
`{"type":"setConnectionMode","audioPriority":"quality"|"stability"}`,
`{"type":"setPairedDevice","command":"connect"|"disconnect"|"selectPlayback"|"unpair","deviceId":"<macAddress>"}`,
`{"type":"setPairing","enabled"}`, `{"type":"setAutoPause","enabled"}` and
`{"type":"setMultipoint","enabled"}` (applied to the `MULTIPOINT_SETTING`
general setting). Patch slots: `setNoise` and `setAmbientLevel` now share
`NOISE_SLOT` (`"noise"`), because the ambient slider sends either and the
newest must win; `setPairedDevice` has none (not predicted, below).
[useSliderCommand](<../../src/hooks/engine/useEngineCommand.ts>) now takes
the slot and any command rather than one command type.

Each new hook is a pure mapper over the shown snapshot run through
[useSnapshotProps](<../../src/hooks/engine/useSnapshotProps.ts>), null
without its feature.

### Ambient Sound Control

Why there was a "Wind" setting: in Sony's app the ambient slider's leftmost
stops are "Noise canceling" and "Wind Noise Reduction", then levels 1 to 20,
and the engine exposes wind as a `noiseView.mode`. It is now built Sony's
way:

- [AmbientSoundControlCard.tsx](<../../src/components/noise/AmbientSoundControlCard.tsx>) /
  [AmbientSoundControlCard.css](<../../src/components/noise/AmbientSoundControlCard.css>)
  (replaces `NoiseControlCard`): the switch
  [NoiseModeSegment](<../../src/components/noise/NoiseModeSegment.tsx>)
  ("Ambient sound control": Noise cancelling / Ambient sound / Off; the Wind
  segment is gone and wind shows as Noise cancelling, `noiseSegmentFor` in
  [noiseModes.ts](<../../src/components/noise/noiseModes.ts>)); unless Off,
  [AmbientPositionSlider](<../../src/components/noise/AmbientPositionSlider.tsx>)
  ("Ambient sound level", values reading "Noise cancelling", "Wind noise
  reduction", "1" to "20"), an `InfoNote` on the two lowest positions, and
  Focus on voice at the ambient levels.
- [ambientPositions.ts](<../../src/components/noise/ambientPositions.ts>):
  the stops for the device's flags; on the XM4 22 stops: index 0
  cancelling, 1 wind, n = 2..21 ambient level n - 1 (without wind, 21).
  `ambientPositionIndex` maps the reported mode back to its stop.
- [useNoiseControlProps](<../../src/hooks/engine/useNoiseControlProps.ts>):
  `ambientPositionCommand` sends `setNoise {mode: "cancelling"}` for stop 0,
  `setNoise {mode: "wind"}` for stop 1 and `setAmbientLevel {level: n - 1}`
  for stop n, live (throttled) and on commit, echoes held in `NOISE_SLOT`.
  The switch sends `setNoise {mode}`; `quickNoiseProps` feeds the Status
  page's switch.

### Speak-to-Chat

[SpeakToChatCard.tsx](<../../src/components/sound/SpeakToChatCard.tsx>) with
[speakToChatOptions.ts](<../../src/components/sound/speakToChatOptions.ts>):
the "Speak-to-Chat" switch, then "Voice detect sensitivity" (Auto / High
sensitivity / Low sensitivity) and "Time until Speak-to-Chat closes" (Short
(about 5 s) / Standard (about 15 s) / Long (about 30 s) / Does not close
automatically: `short` / `medium` / `long` / `manual`), dimmed while off.
[useSpeakToChatProps](<../../src/hooks/engine/useSpeakToChatProps.ts>) sends
the whole `setSpeakToChat`, the other two fields as reported (an `unknown`
one written as `auto` / `short`).

### Bluetooth connection quality

[ConnectionQualityCard.tsx](<../../src/components/sound/ConnectionQualityCard.tsx>):
two check rows, "Priority on sound quality" and "Priority on stable
connection", and a footer;
[useConnectionModeProps](<../../src/hooks/engine/useConnectionModeProps.ts>)
sends `setConnectionMode {audioPriority}`.

### Devices: multipoint, paired devices, pairing

- [MultipointCard.tsx](<../../src/components/devices/MultipointCard.tsx>):
  "Connect to 2 devices simultaneously" with the device's summary;
  [useMultipointProps](<../../src/hooks/engine/useMultipointProps.ts>) sends
  `setMultipoint`. System no longer lists `MULTIPOINT_SETTING`.
- [PairedDeviceList.tsx](<../../src/components/devices/PairedDeviceList.tsx>),
  [PairedDeviceRow.tsx](<../../src/components/devices/PairedDeviceRow.tsx>) /
  [PairedDeviceRow.css](<../../src/components/devices/PairedDeviceRow.css>)
  (name, "This PC", "Connected" and "Playback device" chips, chevron),
  [PairedDeviceSheet.tsx](<../../src/components/devices/PairedDeviceSheet.tsx>)
  (Connect or Disconnect, Set as playback device, Forget this device; Forget
  asks "Forget {name}?" with focus on Cancel, and focus follows when the
  buttons swap) and [pairedDevices.ts](<../../src/components/devices/pairedDevices.ts>)
  (actions per state, labels). This PC: the renderer cannot read the PC's
  Bluetooth address, but the headphones are connected to this PC, so when
  exactly one paired device is connected it is this PC (`thisPcAddress`);
  with two connected none is marked (open question 9). This PC gets no
  Disconnect or Forget (that would cut the app off; Windows Bluetooth
  settings do it), only Set as playback device when another device plays.
  [usePairedDevicesProps](<../../src/hooks/engine/usePairedDevicesProps.ts>)
  sends `setPairedDevice {command, deviceId: macAddress}`, but only where the
  engine can: Core Services ("Commands added 2026-10-12") records that
  libmdr 4c91fe6 returns `MDR_RESULT_ERROR_NOT_SUPPORTED` on V1 and says
  "The renderer should not offer these actions when `status.protocol ==
  "V1"`". So on the XM4 (`"protocol": "V1"` in the recording) the list is
  read-only (`actionsSupported` false: no chevrons, no sheet) with a footer
  pointing to the device itself or Sony's phone app; the actions appear on
  V2 devices (tested with the recording's protocol set to V2). These take
  seconds and may fail, so nothing is predicted: the row reads
  "Connecting…" (and so on) until the device list reports the action done,
  or for at most 10 s (`PAIRED_DEVICE_PENDING_MS`).
- [PairingCard.tsx](<../../src/components/devices/PairingCard.tsx>): "Pair
  a new device" sends `setPairing {enabled: true}`; while pairing mode is on
  the row reads "Stop pairing mode" and sends false
  ([usePairingProps](<../../src/hooks/engine/usePairingProps.ts>)).

### Automatic pause

[AutoPauseRow.tsx](<../../src/components/system/AutoPauseRow.tsx>):
"Automatic pause when headphones are removed" in System's Device card
([DeviceSettingsCard.tsx](<../../src/components/system/DeviceSettingsCard.tsx>));
[useAutoPauseProps](<../../src/hooks/engine/useAutoPauseProps.ts>) sends
`setAutoPause`. Voice guidance moved to its own "Notification & voice
guide" card, the assignable button to the Noise control page
([useAssignableControlsProps](<../../src/hooks/engine/useAssignableControlsProps.ts>),
split out of [useSystemProps](<../../src/hooks/engine/useSystemProps.ts>)).

### Tests and verification (Task 23, 2026-10-12)

- `pnpm typecheck`: exit 0. `pnpm test`: `Test Files  34 passed (34)`,
  `Tests  214 passed (214)` after the review fixes (192 before; the TabBar,
  ConnectedHome and HomePage tests were removed or folded into the new ones).
- Review (a fresh read-only Claude reviewer; Codex was not run): contract
  match and V1 gating confirmed. Fixed from it: a paired-device sheet could
  reopen by itself when its device came back (the open id is now cleared);
  with two devices connected either may be this PC, so neither offers
  disconnect or forget (`maybeThisPc`); in wind mode a click on the checked
  "Noise cancelling" segment was ignored, so the Status switch could not
  leave wind (`NoiseModeSegment` now sends it; segments carry `data-value`);
  the Forget confirmation no longer flashes back to the actions while the
  sheet closes. Not changed: after Forget, focus returns to a row that then
  leaves the list and falls to the page (follow-up).
- New or rewritten: [SideNav.test.tsx](<../../tests/shell/SideNav.test.tsx>),
  [AppShell.test.tsx](<../../tests/shell/AppShell.test.tsx>) (the rail
  renders while disconnected with every item enabled; choosing Devices
  changes the `<h1>`, `aria-current` and the named page region; the rail's
  device block from the mock engine),
  [AmbientSoundControlCard.test.tsx](<../../tests/noise/AmbientSoundControlCard.test.tsx>),
  [menuHooks.test.tsx](<../../tests/engine/menuHooks.test.tsx>) (each new
  hook against the recording),
  [enginePages.test.tsx](<../../tests/engine/enginePages.test.tsx>) (the
  slider sends `setNoise wind`, `setAmbientLevel 12`, then 15 once; quality
  pick; Speak-to-Chat; auto pause; Devices: three read-only devices on V1,
  and on V2 connect with its pending line cleared by the confirming snapshot, forget only after the
  confirmation, this PC's sheet, pairing and multipoint),
  [applyCommand.test.ts](<../../tests/engine/applyCommand.test.ts>) (the six
  commands and the slots),
  [engineHooks.test.tsx](<../../tests/engine/engineHooks.test.tsx>) (the 22
  stops map consistently both ways; System without multipoint; assignable
  controls).
- Broken lines, each run and restored: wind sending `setNoise cancelling`
  fails 2 tests (the stop mapping and the page slider test); `thisPcAddress`
  taking the first connected device fails "cannot tell this PC when two
  devices are connected"; dropping the list's `onKeyDown` fails the SideNav
  keyboard test.
- Screenshots, headless Edge over CDP against the dev server (mock engine
  from the recording), 2x:
  (screenshot removed before publication),
  (screenshot removed before publication) (Ambient sound chosen,
  Focus on voice revealed),
  (screenshot removed before publication),
  (screenshot removed before publication) (1180 x 760 dark),
  (screenshot removed before publication) (960 x 620, rail
  collapsed, keyboard focus moved to Devices with Tab and Down: the inset
  ring shows), (screenshot removed before publication). The
  scroll width equals the client width at both sizes (940 / 888). Judged:
  the rail's labels, device block and wordmark share one left edge; the gold
  bar is centred on the selected row; both columns start on the same header
  line; nothing is clipped at 960 px. Fixed after looking: the phone-only
  copy, a Speak-to-Chat subtitle that left one word on a line, and an
  "NC/AMB button" header over a row named "Custom button" (now "Button
  function"; the XM4's button is labelled CUSTOM). The Browser pane showed
  the same layout at 1180 x 760, but its screenshots timed out while the
  window was behind others, hence the CDP captures.

### Follow-ups (Task 23)

- Native window (2026-10-12, after the engine commit `61fc754` landed):
  `cargo build --manifest-path src-tauri/Cargo.toml` finished in 6.30 s;
  the debug exe against the dev server opened `SoundConnect Desktop` at
  1493 x 960 device pixels (1180 x 760 plus the frame at 125 % scaling) with
  the rail, caption buttons and "Looking for your headphones"
  ((screenshot removed before publication), DPI-aware
  `PrintWindow`). The XM4 was not connected to Windows then (stderr: `[BT]
  GetDevicesList returning 0 device(s)`), so the new menus are not yet
  verified against the live headphones.
- The Status page has room below its cards (open question 10).
- `error` from `engine_send` is still not shown; a rejected
  `setPairedDevice` only clears its pending line after 10 s.

## Shell

Plan Task 13: the running app's device header and not-connected screens.
The Task 13 navigation store, app shell and bottom tab bar were replaced by
the [Desktop frame](#desktop-frame) in Task 23. The header and the state
screens take plain props.

### Device header

[DeviceHeader.tsx](<../../src/components/shell/DeviceHeader.tsx>) /
[DeviceHeader.css](<../../src/components/shell/DeviceHeader.css>). Props:
`name`, `percent`, `charging`, `codec` (plain values, no engine types). A
`Card` with `accentEdge` (the one gold hairline, `--accent-edge`, drawn as an
inset box-shadow so it adds no size) at the top of Home (not in the title bar), a `<section>` labelled by
the name: product photo, name (22 px), then battery and codec centred on one
line.

- The picture is [DeviceImage](<../../src/components/device-art/DeviceImage.tsx>)
  at 160 px for `name` (see [Product images](#product-images)); until Task 26 it
  was the traced `HeadphoneArt` line art, now deleted.
- [BatteryGauge.tsx](<../../src/components/shell/BatteryGauge.tsx>) /
  [BatteryGauge.css](<../../src/components/shell/BatteryGauge.css>). Props:
  `percent`, `charging`, `label?` ("Battery"; for left/right/case later). A
  `role="meter"` with `aria-valuenow` (clamped and rounded to 0-100),
  `aria-valuetext` "83%" or "83%, charging", and `data-tone`
  `normal | low | critical` (below 20 / below 10, from the exported
  `batteryTone`, applied to the rounded value, so 9.6 % shows "10%" and
  reads as low, consistent with what is displayed). Visual: a 34 x 16 capsule (`--battery-width` /
  `-height`, 2 px `--battery-inset`) whose fill is green, then `--warning`,
  then `--destructive`, the percentage (13 px semibold, tabular; tinted with
  the matching `*-text` colour when low), and a filled green `bolt` only
  while charging. The fill follows the level down to a 6 px stub (about
  20 %); below that the colour, not the length, carries the warning. The
  brief said `--danger` for the red; `--destructive` (iOS red) is used
  instead, because `--danger` is deliberately the Windows caption-button red.
- [CodecBadge.tsx](<../../src/components/shell/CodecBadge.tsx>). Prop:
  `codec`. A neutral `Pill` with a visually hidden "Codec " prefix so it is
  announced as "Codec LDAC"; no CSS of its own (all styling is the Pill's).

Test: [BatteryGauge.test.tsx](<../../tests/shell/BatteryGauge.test.tsx>)
(meter with value, range and text; bolt and "charging" only while charging;
tone at 100, 20, 15, 10 and 5; clamping and rounding).

### Connection states

[ConnectionStatus.tsx](<../../src/components/shell/ConnectionStatus.tsx>) is
what pages render: prop `view`, a [ConnectionView](<../../src/components/shell/connectionCopy.ts>)
(`{kind: "searching"}`, `{kind: "connecting", deviceName}` or
`{kind: "error", deviceName?, message, onRetry}`), a UI state that Task 11
maps the engine's connection status onto. It renders the matching card and
one persistent [ConnectionAnnouncer](<../../src/components/shell/ConnectionAnnouncer.tsx>):
two visually hidden live regions, a `role="status"` holding "title.
description" for searching and connecting, and a `role="alert"` that is
empty except while an error shows (one-shot: each new error is read once).
The regions stay mounted while only their text changes, because screen
readers announce a text change in a region they know but often ignore a
region inserted already filled, which is what swapping whole cards would be.
The cards themselves carry no live role. Titles and sentences come from
`connectionCopy(view)` in [connectionCopy.ts](<../../src/components/shell/connectionCopy.ts>),
shared by the cards and the announcer so they cannot disagree.

Focus: pressing "Try again" unmounts the focused button when the state moves
to connecting, which would drop focus on `<body>`.
[useFocusAfterAction.ts](<../../src/hooks/useFocusAfterAction.ts>) returns a
`target` ref and `markAction`; `ConnectionStatus` calls `markAction` from
Try again, and when `view.kind` next changes, focus moves to the new card's
heading (`tabIndex={-1}`, a soft `--radius-xs` ring). State changes nobody
asked for leave focus alone. Test:
[ConnectionStatus.test.tsx](<../../tests/shell/ConnectionStatus.test.tsx>)
(searching to connecting keeps the same status node with new text; the
alert node is empty until an error, then holds the title but not the
buttons, and the status empties; after Try again focus is on the
"Connecting to ..." heading, not body; a change without an action does not
move focus).

[ConnectionState.tsx](<../../src/components/shell/ConnectionState.tsx>) /
[ConnectionState.css](<../../src/components/shell/ConnectionState.css>) is
the shared card layout. Props: `visual`, `title`, `description?`,
`titleRef?`, `children?` (actions). It takes the page's remaining
height (`flex: 1`) and centres one card (content at most
`--state-card-max-width`, 320 px) holding the visual, a 17 px title, a
secondary sentence and the actions. Because the page reserves the tab bar,
the card centres in the visible area above the bar; measured at 420 x 760 it
sits 12 px above the exact centre (the page's bottom padding is 32 px of
breathing room against 8 px at the top), which reads as optical centre and
was kept.

- [ActivityPulse.tsx](<../../src/components/shell/ActivityPulse.tsx>) /
  [ActivityPulse.css](<../../src/components/shell/ActivityPulse.css>). Props:
  `icon` or `image`, `tone?` (`accent | warning`), `animated?`. With `icon`, an
  88 px tinted disc with a 44 px glyph (`--state-visual-size` /
  `--state-glyph-size`); with `image` (a product photo), the picture alone
  with no disc. When animated, two rings breathe out of it, half a `--duration-pulse` (1.8 s)
  apart. Under reduced motion the rings are not drawn at all.
- [ConnectionSearching.tsx](<../../src/components/shell/ConnectionSearching.tsx>):
  `model?`, `titleRef?`; "Looking for your headphones", "Connect them to Windows
  Bluetooth first.", the device's product photo (the neutral WH-1000XM5
  without a model) with breathing rings.
- [ConnectionConnecting.tsx](<../../src/components/shell/ConnectionConnecting.tsx>):
  `deviceName`, `model?`, `titleRef?`, `reconnecting?`; "Connecting to {name}", "This
  usually takes a few seconds.", the device's product photo with breathing
  rings. With `reconnecting` (the engine status `connecting` with reason
  `reconnectingAfterSettingChange`, mapped by `toConnectionView`):
  "Reconnecting to {name}", "They restarted their Bluetooth connection to
  apply your setting. This takes a few seconds." The headphones drop the link
  to apply a connection-quality change and the engine reconnects by itself
  ([toggle-dropouts-debug.md](<../core/evidence/toggle-dropouts-debug.md>)).
  `failureReasonOf` in
  [connectFailureText.ts](<../../src/lib/devices/connectFailureText.ts>) keeps
  that reason out of the failure texts and connect attempts. Test:
  [settingChangeReconnect.test.tsx](<../../tests/shell/settingChangeReconnect.test.tsx>).
- [ConnectionError.tsx](<../../src/components/shell/ConnectionError.tsx>) /
  [ConnectionError.css](<../../src/components/shell/ConnectionError.css>):
  `deviceName?`, `model?`, `message`, `onRetry`, `titleRef?`. Friendly title
  ("Couldn't connect to {name}" or "to your headphones") and advice, a
  primary "Try again" `SheetButton`, and the raw `message` in a selectable
  monospace block (`--font-mono`) under a collapsed "Details" `Disclosure`;
  the device's product photo, static. Test:
  [ConnectionError.test.tsx](<../../tests/shell/ConnectionError.test.tsx>)
  (friendly text visible, raw message hidden until Details opens and hidden
  again when it closes; generic title without a name; Try again fires
  `onRetry` once).

The three cards are presentational and usable alone (the gallery shows
each); anything that changes state at runtime should go through
`ConnectionStatus` so announcements and focus work.

### Pages

`HomePage.tsx` (removed in Task 23) is Home's thin container:
since Task 11 it reads the engine store and chooses between `ConnectedHome`
and `ConnectionStatus` (see [Engine wiring](#engine-wiring)).
`ConnectedHome.tsx` (removed in Task 23) is the
presentational connected content: prop `device` (`DeviceHeaderProps`),
rendering the `DeviceHeader` and a "Quick controls" placeholder section; the
gallery renders it directly with demo values. Test:
`HomePage.test.tsx` (removed in Task 23) (HomePage shows
the searching heading and no meter; ConnectedHome renders the name, a
charging battery meter and the codec from its props).
[SoundPage.tsx](<../../src/pages/SoundPage.tsx>)
("Noise control"), [SystemPage.tsx](<../../src/pages/SystemPage.tsx>)
("Headphones") fall back to one
[PlaceholderSection](<../../src/components/page/PlaceholderSection.tsx>) when
they have no device data: a
`SectionHeader` and an empty `Card` with "Coming in a later task" (pure
composition, so no CSS). Pages need no CSS of their own yet.
[SettingsPage.tsx](<../../src/pages/SettingsPage.tsx>) was a placeholder
("App") until Task 17 (see [Settings page](#settings-page)).

### Shell tokens

Added to [tokens.css](<../../src/styles/tokens.css>): `--font-size-2xs`
(10 px), `--font-mono`, `--tabbar-height` (50), `--tabbar-icon-size` (24),
`--tabbar-reserve`, `--device-art-size` (112), `--battery-width` /
`-height` / `-inset` (34 / 16 / 2), `--state-visual-size` (88),
`--state-glyph-size` (44), `--state-card-max-width` (320),
`--duration-pulse` (1800 ms, CSS-only so not mirrored in motion.ts),
`--glass-blur`, `--art-ink` / `--art-ink-soft`; after review, `--space-half`
(2 px, also replacing ListRow's literal subtitle gap) and `--opacity-hover`
(0.8). [motion.ts](<../../src/styles/motion.ts>) gained `pageSlide` (8 px)
and `easeOut` (the `--ease-out` bezier). The doc comment of
[useSegmentedSelection](<../../src/hooks/useSegmentedSelection.ts>) now says
it serves any single-select roving group (radio groups and tabs) and that
Up/Down step too.

### Shell verification (2026-10-11)

- `pnpm view zustand version`: `5.0.15`; installed exact.
- `pnpm typecheck`: exit 0, no diagnostics. `pnpm test`: `Test Files  14
  passed (14)`, `Tests  69 passed (69)` (50 earlier + 19 new). Each new
  test file was checked against a broken variant: a panel that is never
  `hidden` fails the Details test, dropping the below-10 rule fails the
  tone-at-5 test, removing the tab list's key handler fails the arrow-key
  test, removing `inert` / `aria-hidden` from the leaving page fails the
  AppShell test.
- Follow-up commit (Opus review of `8e1b6f4`): `Test Files  16 passed (16)`,
  `Tests  75 passed (75)` (two ConnectionError alert assertions moved to
  the new ConnectionStatus test; the structural bolt check dropped). Broken
  lines, each run and restored: keying the announcer by `view.kind` fails
  both node-identity tests; deleting `target.current?.focus()` fails the
  Try again focus test; deleting the `pending` guard fails the
  no-action test; filling the status during an error fails the alert test;
  a HomePage that renders `ConnectedHome` with fixed values fails the
  no-meter test; a ConnectedHome that hard-codes `codec="LDAC"` fails the
  props test. In the Browser pane, Enter on the gallery's live Try again
  left focus on `H2: Connecting to WH-1000XM4` with a visible ring, the
  status text changed and the alert emptied.
- Browser pane at 420 x 760: tab bar 50 px plus a 1 px hairline, glyphs
  24 px, each label centred under its glyph (centres equal to 0.1 px in all
  four tabs), selected tab `rgb(0, 122, 255)`, others `rgb(108, 108, 112)`;
  backdrop filter `blur(24px) saturate(1.4)`. Header card x = 16,
  width 388. At 380 px, scroll width equals client width on all four pages
  and in the gallery. Tab then Right arrow: focus ring on Sound, Sound
  selected, page and title switched.
- The Browser pane's document reports `visibilityState: hidden` and runs no
  animation frames, so there framer-motion cannot finish removing leaving
  pages (they sit at opacity 0, inert); the jsdom test, where frames run,
  shows them removed. One pane screenshot showed a stale tint mid-switch;
  computed styles were correct and a re-capture matched.
- `tools/dev.ps1`: `Finished dev profile ... in 17.10s`, `Running
  target\debug\soundconnect-desktop.exe`; `Get-Process` found
  `soundconnect-desktop` with `MainWindowTitle 'SoundConnect Desktop'`;
  a `PrintWindow` capture shows the searching state, the tab bar and the
  caption buttons. Stopped afterwards.

Review: the Codex CLI still rejects `service_tier = "priority"` in its
config, so a fresh read-only Claude reviewer reviewed the staged change and
returned GO. Fixed from it: the live region narrowed to the message, the tab
panel made focusable, an unused `data-charging` attribute removed, a test
that the leaving page is inert (fails when `inert` / `aria-hidden` are
removed), and the rounding note above. The Build Toolchain doc was
refreshed in its own commit. An Opus review of `8e1b6f4` approved with
follow-ups, done in the next commit: the persistent announcer and focus
move above, `HomePage.demo` replaced by `ConnectedHome`, and the minor
token, easing and doc-comment items.

### Shell follow-ups (deferred)

- Battery thresholds (below 20 low, below 10 critical): decided in Task 11 to
  keep them. Both live XM4 sessions reported `levelPercent` 90 with
  `updateThresholdPercent` 255, so the step size is still unobserved; a
  device reporting in 10 % steps shows amber at 10 % and red only at 0 %.
  Revisit if a real low-battery report looks wrong.
- Focus on programmatic tab changes: when the tab changes without a click
  (deep links), focus stays where it was; still open, no programmatic tab
  change exists yet.
- Done in Task 11: the `ConnectionAnnouncer` now lives in `AppShell`, outside
  the page transition, so it survives tab switches.

Screenshots (840 x 1520 device pixels for 420 x 760, from the Browser pane):
(screenshot removed before publication),
(screenshot removed before publication),
(screenshot removed before publication) (keyboard focus on
the Sound tab), (screenshot removed before publication)
(demo header, battery tones); native window (OS dark):
(screenshot removed before publication).

## Home cards

Plan Task 14, presentational layer: the Noise control and Now playing cards
on the connected Home. The engine is not wired yet, so every component takes
plain props and reports intentions through callbacks; the hooks that bind
them to engine state come in Task 11. No engine types or fixtures are
invented here; the value domains come from the upstream C API
(`upstream/SonyHeadphonesClient/libmdr/include/mdr-c/Headphones.h`):
`MDR_NOISE_MODE_OFF` / `_CANCELLING` / `_AMBIENT`, `MDRNoiseControl`'s
`uint8_t ambient_level` and `MDRBoolean focus_on_voice`, `MDRPlayback`'s
`MDRPlaybackStatus status` (`MDR_PLAYBACK_UNKNOWN` / `_STOPPED` / `_PLAYING`
/ `_PAUSED`) and `uint8_t volume`, the `MDR_PLAYBACK_PLAY` / `_PAUSE` /
`_NEXT` / `_PREVIOUS` actions, `MDR_TEXT_TRACK_TITLE` / `_ALBUM` /
`_ARTIST`, and the `MDR_AUDIO_CODEC_*` enum. The upstream client
(`client/Client.cpp`) uses `ImGui::SliderInt("##Volume", &volume, 0, 30)` for
volume and `ImGui::SliderInt("##AmbStrength", &ambientLevel, 1, 20)` for the
ambient level, the ranges these cards use.

### Noise control card

Superseded in Task 23 by the [Ambient Sound Control](#ambient-sound-control)
card (no Wind segment; one 22-stop slider). The history below is kept for
the V1 mapping.

`NoiseControlCard.tsx` (removed in Task 23) /
`NoiseControlCard.css` (removed in Task 23).
Props: `mode` (`"off" | "cancelling" | "ambient"`), `ambientLevel`,
`focusOnVoice`, `canCancel`, `canAmbient`, `canFocusOnVoice`, `disabled?`,
`onModeChange`, `onAmbientLevelChange` (live, while dragging),
`onAmbientLevelCommit` (once per gesture), `onFocusOnVoiceChange`. A
non-inset `Card` (so the switch row can run edge to edge like any list row)
composed of:

- [NoiseModeSegment.tsx](<../../src/components/noise/NoiseModeSegment.tsx>):
  the `SegmentedControl` named "Noise control", with options from
  `availableNoiseModes` in
  [noiseModes.ts](<../../src/components/noise/noiseModes.ts>) (the
  `NoiseMode` type, the 1..20 level bounds, and the filter: Noise
  cancelling / Ambient / Off in the Sony app's order, a mode left out when
  its `can*` flag is false, Off always offered).
- `AmbientLevelSlider.tsx` (removed in Task 23):
  `Slider` "Ambient sound level", 1..20; `formatAmbientLevel` clamps and
  rounds what is shown, so a device that reports 0 outside Ambient (upstream
  bumps 0 to 20 on entering Ambient) never reads "0" under a thumb at 1.
- [FocusOnVoiceRow.tsx](<../../src/components/noise/FocusOnVoiceRow.tsx>):
  a `ToggleRow` "Focus on voice", inside a `<ul>` with a hairline from the
  text edge, only when `canFocusOnVoice`.
- The slider and the row exist only in Ambient, inside
  [Reveal.tsx](<../../src/components/primitives/Reveal.tsx>) /
  [Reveal.css](<../../src/components/primitives/Reveal.css>), a reusable
  primitive that mounts and unmounts a block with a height and opacity
  tween (`durations.base`, `easeOut`, not the spring: a bouncing height
  would overshoot into the next card). `MotionConfig reducedMotion="user"`
  only drops transform and layout animation, so Reveal reads
  `useReducedMotionConfig()` and uses a zero duration under reduced motion
  (framer-motion's reader also copes with jsdom's missing `matchMedia`,
  which the app's own `usePrefersReducedMotion` does not). The first mount
  does not animate; padding lives on the children so the box collapses
  fully.

Task 11 mapping depends on the protocol version (`client/Client.cpp`
1594-1630, and `MDR_NOISE_MODE_V1_ON` equals `MDR_NOISE_MODE_CANCELLING`,
both 1, in `Headphones.h`):

- `MDR_PROTOCOL_V2`: `mode` from `MDRNoiseControl.mode`, `ambientLevel` from
  `ambient_level`, `focusOnVoice` from `focus_on_voice`.
- `MDR_PROTOCOL_V1` (the XM3 / XM4 family): `mode` is only `V1_ON` / `OFF`;
  NC versus Ambient lives in `ambient_level` read as `int8_t`: -1 is noise
  cancelling, 0 wind-noise reduction, 1..20 Ambient at that level. So `OFF`
  maps to "off", `V1_ON` with -1 to "cancelling", `V1_ON` with 1..20 to
  "ambient" (`ambientLevel` = the level), and writes reverse it. Upstream
  enables Focus on voice only at level 1 or above, which matches the row
  existing only in Ambient. Wind-noise reduction (level 0) has no renderer
  mode yet: Task 11 must either add one or show it as "cancelling" and say
  so; it must never pass the raw byte (255 for -1) as `ambientLevel`.

`canCancel` / `canAmbient` / `canFocusOnVoice` come from the device's
support flags; commits become `MDRNoiseControl` writes.

### Now playing card

[NowPlayingCard.tsx](<../../src/components/playback/NowPlayingCard.tsx>) /
[NowPlayingCard.css](<../../src/components/playback/NowPlayingCard.css>).
Props: `title?`, `artist?`, `album?`, `status` (the
[PlaybackStatus](<../../src/components/playback/playbackStatus.ts>) union
`"unknown" | "stopped" | "playing" | "paused"`), `volume`, `maxVolume`,
`codec?`, `disabled?`, `onPlayPause`, `onNext`, `onPrevious`,
`onVolumeChange` (live), `onVolumeCommit`. An inset `Card` stacking:

- [TrackInfo.tsx](<../../src/components/playback/TrackInfo.tsx>) /
  [TrackInfo.css](<../../src/components/playback/TrackInfo.css>): title
  (17 px semibold) over "artist · album" (13 px secondary), one line each
  with an ellipsis and the full text as a tooltip; a blank title reads
  "Nothing playing". `codec`, when passed, shows as a `CodecBadge` on the
  right; Home leaves it out because the device header already shows the
  codec.
- [TransportControls.tsx](<../../src/components/playback/TransportControls.tsx>) /
  [TransportControls.css](<../../src/components/playback/TransportControls.css>):
  a `group` "Playback" of three
  [TransportButton](<../../src/components/playback/TransportButton.tsx>)s
  ([TransportButton.css](<../../src/components/playback/TransportButton.css>)):
  "Previous track", "Play" or "Pause" (Pause and the pause glyph only while
  `status` is playing), "Next track". Previous and next are 44 px circles
  (`--transport-button-size`, the iOS hit target) with 24 px glyphs; play /
  pause is a 56 px `--fill` disc (`--transport-primary-size`) with a 28 px
  glyph. Neutral, not gold: gold marks state (slider fill, switches) and
  these are actions.
- [VolumeSlider.tsx](<../../src/components/playback/VolumeSlider.tsx>):
  `Slider` "Volume", 0..`maxVolume`, with the `speaker` glyph in its
  `leading` slot.

Task 11 mapping: `status` and `volume` from `MDRPlayback`; texts from
`MDR_TEXT_TRACK_TITLE` / `_ARTIST` / `_ALBUM`; `maxVolume` 30; play / pause
sends `MDR_PLAYBACK_PAUSE` when playing, else `MDR_PLAYBACK_PLAY`, next and
previous `MDR_PLAYBACK_NEXT` / `_PREVIOUS`; volume commits become an
`MDRPlayback` write.

### ConnectedHome and the throttle hook

`ConnectedHome.tsx` (removed in Task 23) takes
`device` plus optional `noise` (`NoiseControlCardProps`) and `playback`
(`NowPlayingCardProps`) and renders each card under a "Noise control" /
"Now playing" section through
[LabelledSection.tsx](<../../src/components/page/LabelledSection.tsx>) (a
`<section>` named by its `SectionHeader`, now also used by
[PlaceholderSection.tsx](<../../src/components/page/PlaceholderSection.tsx>)).
With neither group it keeps the "Quick controls" placeholder.

[useThrottledCallback.ts](<../../src/hooks/useThrottledCallback.ts>):
`useThrottledCallback(fn, intervalMs)` returns a stable function that calls
the latest `fn` at once, then at most once per interval, and always delivers
the last arguments of a burst when the interval ends (trailing); `.cancel()`
drops a pending call and unmount does the same. Task 11 puts it between a
slider's live `onChange` and the Bluetooth command, with the commit sending
the final value.

### Gallery and verification

The gallery's "Home: connected" demo composes `ConnectedHome` with both cards
on local state (modes switch, the slider reveals, transport toggles and steps
two demo tracks, commits log `[gallery] ... commit`), followed by the same
demo with `disabled`. The gallery's primitive noise card now takes its
options from `availableNoiseModes`.

Tests: `NoiseControlCard.test.tsx` (removed in Task 23)
(segments follow the availability flags; choosing Ambient reveals the slider
and the Focus on voice switch; no switch without `canFocusOnVoice`; a drag
reports live values and commits once; the switch reports; `disabled`
disables everything), [NowPlayingCard.test.tsx](<../../tests/home/NowPlayingCard.test.tsx>)
(track text; "Nothing playing"; Pause and its glyph only while playing;
transport callbacks; live volume and one commit in 0..30; `disabled`),
`ConnectedHome.test.tsx` (removed in Task 23)
(named sections with the cards; placeholder without them),
[useThrottledCallback.test.tsx](<../../tests/home/useThrottledCallback.test.tsx>)
(fake timers: leading call, trailing last value at the interval edge, a
50-call stream gives 6 calls, latest `fn`, cancel and unmount).

Verification (2026-10-11): `pnpm typecheck` exit 0; `pnpm test`
`Test Files  21 passed (21)`, `Tests  96 passed (96)` (77 earlier + 19).
Broken lines, each run and restored: Pause shown whenever not stopped fails
the play / pause test (and the ConnectedHome one); offering every mode
regardless of flags fails the availability test; dropping the trailing call
fails three throttle tests; always revealing the ambient block fails the
reveal test. Browser pane at 420 x 760: at 380 px the three icon + label
segments fit without truncation (each label's scroll width equals its
width; the control is 316 px) and the page does not scroll sideways;
transport targets measure 44, 56 and 44 px. The reveal was sampled with a
MutationObserver during a real click: its height rose 0, 4, 11, 16, 27 ...
px frame by frame while the next section's top moved with it (434 to 504
px), so the card grows rather than jumps. Fixed after looking: the Volume
label and value were misaligned (the header now centres), and a second LDAC
badge duplicated the device header's (Home omits `codec`).

Screenshots (840 x 1520 device pixels for 420 x 760):
(screenshot removed before publication),
(screenshot removed before publication).

## Sound page

> Since Task 27 the equalizer and DSEE live on their own page; see
> [Equalizer page](#equalizer-page). The components below are unchanged.

Plan Task 15, presentational layer. Like the Home cards, every component
takes plain props and reports intentions through callbacks; Task 11 binds
them to engine state. Value domains come from upstream libmdr
`include/mdr-c/Headphones.h` and the ImGui client `client/Client.cpp`:

- `MDREqualizer` holds `MDREqualizerPreset preset;`, `int8_t clear_bass;`,
  `uint32_t band_count;`, `MDRBoolean dsee_enabled;`,
  `MDRDSEEType dsee_type;`, `MDRBoolean available;` and
  `MDRBoolean dsee_available;`.
- Preset ids run from `MDR_EQ_OFF ((MDREqualizerPreset)0u)` to
  `MDR_EQ_USER_5 ((MDREqualizerPreset)29u)`, plus
  `MDR_EQ_UNKNOWN ((MDREqualizerPreset)255u)`. Names come from the device:
  `mdrHeadphonesGetEqualizerPresets` is documented as "The equalizer presets
  the device advertised, in its order. Names are @ref
  MDR_TEXT_EQUALIZER_PRESET_NAME." (`MDR_TEXT_EQUALIZER_PRESET_NAME
  ((MDRText)17u)`), and "An empty list means the device has not reported one".
- Bands: `mdrHeadphonesGetEqualizerBands(MDRHeadphones* headphones, int8_t*
  bands, uint32_t* inout_count)`. The client's `ImEqualizer` uses
  `kBand5[] = {"400", "1k", "2.5k", "6.3k", "16k"}` and `kBand10[] = {"31",
  "63", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"}` with
  `if (numBands == 10) kBands = kBand10, mn = -6, mx = 6;` and
  `if (numBands == 5) kBands = kBand5, mn = -10, mx = 10;`. Clear Bass is
  shown only `if (gState.mEqualizerBands.size() == 5)`, with
  `ImGui::SliderInt("##", &clearBass, -10, 10)`.
- DSEE types: `MDR_DSEE_UNKNOWN` 0, `MDR_DSEE_STANDARD` 1, `MDR_DSEE_HX` 2,
  `MDR_DSEE_HX_AI` 3, `MDR_DSEE_ULTIMATE` 4. `FormatDseeType` maps them to
  i18n ids whose English strings (`client/I18N/Default.cpp`) are
  `_Def(Dsee, "DSEE")`, `_Def(DseeHx, "DSEE HX")`, `_Def(DseeHxAi, "DSEE HX
  AI")` and `_Def(DseeUltimate, "DSEE ULTIMATE")`.
- Unavailable text: `_Def(ListeningEqUnavailable, "Unavailable while a
  listening mode other than Standard is active.")`.

v1 caveats (upstream `docs/device-support/WH-1000XM3.md`): the XM3 table
marks "Equalizer (preset)" and "DSEE HX (Upscaling)" as verified; band
editing is not listed. Changing the preset "made the device raise
`ALERT_NTFY_PARAM` `DISCONNECT_CAUSED_BY_CONNECTION_MODE_CHANGE` with a
yes/no choice". Task 11 must answer that (`mdrHeadphonesRequestRespondToAlert`)
rather than surface it raw.

Components:

- [EqualizerCard.tsx](<../../src/components/equalizer/EqualizerCard.tsx>) /
  [EqualizerCard.css](<../../src/components/equalizer/EqualizerCard.css>).
  Props: `presets: {id, name}[]`, `presetId`, `bands: number[]`,
  `bandLabels?`, `bandRange?`, `clearBass?` (omit when the device has none),
  `clearBassRange?`, `available`, `disabled?`, `onPresetChange`,
  `onBandsChange` (live, full array), `onBandsCommit` (once per band
  gesture, full array), `onClearBassChange`, `onClearBassCommit`. A
  non-inset `Card`: the preset row edge to edge, then the bands block and
  the Clear Bass block, each under a hairline from the text edge. When
  `available` is false every control is disabled and the upstream reason is
  shown under the preset row.
- [PresetPicker.tsx](<../../src/components/equalizer/PresetPicker.tsx>): a
  `PickerRow` titled "Preset" whose sheet is "Equalizer preset"; disabled
  until the device lists presets.
- [BandSliders.tsx](<../../src/components/equalizer/BandSliders.tsx>) /
  [BandSliders.css](<../../src/components/equalizer/BandSliders.css>): a
  `group` "Equalizer bands" of inline `Slider`s with `origin={0}`, one 44 px
  row per band. Horizontal, not iOS-style vertical faders: native range
  inputs keep keyboard and screen-reader support and fit the 420 px window.
  Each commit sends the whole array with that band replaced, which is what
  `mdrHeadphonesSetEqualizerBands` takes.
- [ClearBassSlider.tsx](<../../src/components/equalizer/ClearBassSlider.tsx>):
  stacked `Slider` "Clear Bass", centre origin.
- [equalizerBands.ts](<../../src/components/equalizer/equalizerBands.ts>):
  `defaultBandRange(count)` (5 bands -10..10, 10 bands -6..6, any other
  count `null`: upstream shows "EQ Unavailable (bands={0})" and draws no
  sliders, so `EqualizerCard` then shows "Band editing is not available for
  n bands." instead of guessing a range a device write could exceed; an
  explicit `bandRange` overrides this),
  `defaultBandLabels(count)` ("400 Hz" ... for 5, "31 Hz" ... for 10, else
  "Band n"), `CLEAR_BASS_RANGE`, and `formatSignedStep` ("+3", "0", "−2" with
  a true minus sign). No unit is shown: upstream shows bare steps, not dB.
- [DseeRow.tsx](<../../src/components/sound/DseeRow.tsx>) with
  [dseeTypes.ts](<../../src/components/sound/dseeTypes.ts>): a `ToggleRow`
  "Upscaling" with the type name as subtitle ("DSEE", "DSEE HX", "DSEE HX
  AI", "DSEE Ultimate" in Sony's casing; unknown reads "DSEE"); renders
  nothing when `available` is false, as the brief asks. This departs from
  upstream, which keeps the DSEE radio buttons visible but disabled with the
  "Unavailable while a listening mode other than Standard is active." line;
  the cost is that the Sound quality section appears and disappears when the
  listening mode changes.
- [SoundPage.tsx](<../../src/pages/SoundPage.tsx>): optional `equalizer`
  (`EqualizerCardProps`) and `dsee` (`DseeRowProps`), under "Equalizer" and
  "Sound quality" sections. With neither (or DSEE unavailable and no
  equalizer) it keeps the placeholder, now titled "Equalizer".

Task 11 mapping: `presets` from `mdrHeadphonesGetEqualizerPresets` plus
`MDR_TEXT_EQUALIZER_PRESET_NAME` per index; `presetId` = `preset`; `bands`
from `mdrHeadphonesGetEqualizerBands` (length `band_count`); `clearBass` =
`clear_bass`, only with 5 bands; `available` = `available`;
`dsee.available` = `dsee_available` (and `MDR_FEATURE_DSEE`), `enabled` =
`dsee_enabled`, `type` = `dsee_type`. Preset, Clear Bass and DSEE commits
become `mdrHeadphonesSetEqualizer`; band commits become
`mdrHeadphonesSetEqualizerBands`.

Screenshots (Browser pane gallery, 420 x 760, 840 x 1520 device pixels):
(screenshot removed before publication),
(screenshot removed before publication)
(preset sheet opened with the keyboard, focus ring on the current preset).

## Equalizer page

> Since Task 30 Equalizer is a sub-page of Sound (rail child, title "Sound ›
> Equalizer"); see [Sub-pages in the rail](#sub-pages-in-the-rail-task-30).
> The layout below is unchanged.

Task 27 (2026-10-13). The maintainer: the equalizer should be its own menu, with a
graph of what each preset does, as Sony's app shows. The rail now has seven
pages: "Equalizer" (icon `waveform`) sits after Sound
([navPages.ts](<../../src/components/frame/navPages.ts>),
[navStore.ts](<../../src/state/navStore.ts>), registered in
[AppShell.tsx](<../../src/components/shell/AppShell.tsx>)). The Sound page
([SoundPage.tsx](<../../src/pages/SoundPage.tsx>)) no longer passes the
equalizer or DSEE to `SoundSections`; it keeps Bluetooth connection quality
and Speak-to-Chat.

Layout ([EqualizerPage.tsx](<../../src/pages/EqualizerPage.tsx>) feeds
[EqualizerSections.tsx](<../../src/components/equalizer/EqualizerSections.tsx>)):

- **Curve** (full width, titled with the current preset): the current bands
  as one smooth line ([EqCurveChart.tsx](<../../src/components/equalizer/EqCurveChart.tsx>),
  [EqCurveChart.css](<../../src/components/equalizer/EqCurveChart.css>)).
  Clear Bass is the leftmost point, then 400 Hz .. 16 kHz, as Sony's app draws
  its equalizer; without it the XM4's Bass preset (flat bands, Clear Bass +7)
  would draw as a flat line. Fixed -10..+10 axis with ticks every 5, the 0 line
  one step stronger than the hairline grid, a 2 px accent line, a 12 % accent
  area wash down to the 0 line, 8 px dots in a 2 px surface ring; hover shows
  a band's label and value. The plot is a 100 x 100 SVG stretched with
  `preserveAspectRatio="none"` and non-scaling strokes; dots, ticks, labels and
  the tooltip are HTML positioned by percentage, so nothing distorts at any
  width. The chart is `role="img"` with the curve spelled out in its name
  ("Equalizer curve: Clear Bass −1, 400 Hz 0, 1 kHz +5, ..."); the sliders
  remain the control. Single series, so no legend (dataviz skill).
- **Presets**: a grid of small cards ([PresetGrid.tsx](<../../src/components/equalizer/PresetGrid.tsx>),
  [PresetGrid.css](<../../src/components/equalizer/PresetGrid.css>)), each a
  button with `aria-pressed`, the preset name and a sparkline
  ([EqSparkline.tsx](<../../src/components/equalizer/EqSparkline.tsx>),
  [EqSparkline.css](<../../src/components/equalizer/EqSparkline.css>)) of its
  recorded curve (Clear Bass first). Sparklines are muted ink; the selected
  card takes the accent tint, hairline and an accent curve. Listener-edited
  presets (Custom, User Setting n) show a flat line captioned "Custom" (no
  caption when the name is already "Custom"), because their bands are whatever
  was saved. A pick sends `setEqualizerPreset`.
- **Bands**: the existing `EqualizerCard` with `showPresetPicker={false}`
  ([EqualizerCard.tsx](<../../src/components/equalizer/EqualizerCard.tsx>)):
  the five band sliders and Clear Bass, unchanged.
- **Sound quality**: the DSEE row, moved here from Sound.

Curve geometry is pure ([eqCurve.ts](<../../src/components/equalizer/eqCurve.ts>)):
`valueToY`, `bandPoints`, `monotonePath` (Fritsch-Carlson monotone cubic, the
curve d3 calls `curveMonotoneX`: flat at extrema, never overshooting a band, so
the line never shows a boost the device does not apply), `areaPath`,
`curveSeries` and `describeCurve`.

Preset curves are real recordings, never invented.
[eqPresets.ts](<../../src/lib/devices/eqPresets.ts>) bundles every
`tests/fixtures/eq-presets/*.json` with `import.meta.glob`, validates each
(`parseEqPresetTable`; a malformed file contributes nothing), and picks the
table for the connected model (same firmware first). A model with no fixture
shows its presets without sparklines; there is no generic Sony table. The XM4
table, [WH-1000XM4-2.9.0.json](<../../tests/fixtures/eq-presets/WH-1000XM4-2.9.0.json>),
was recorded on 2026-10-13 from the maintainer's XM4 (firmware 2.9.0) by
[eq_presets.rs](<../../src-tauri/crates/mdr/examples/eq_presets.rs>): connect
over `WindowsTransport` (V2 UUID, then V1), init and sync as the engine service
does, then for each advertised preset `set_equalizer{preset}` + `commit`, poll
until the equalizer reports that preset, read `bands` and `clear_bass`, wait
1 s; finally the original preset (Bright) was restored and verified. The
`DISCONNECT_CAUSED_BY_CONNECTION_MODE_CHANGE` alert is answered NEGATIVE.
Recorded values (Clear Bass; 400 Hz, 1 kHz, 2.5 kHz, 6.3 kHz, 16 kHz):

| Preset | Clear Bass | Bands |
|---|---|---|
| Off | 0 | 0, 0, 0, 0, 0 |
| Bright | −1 | 0, 5, 7, 7, 9 |
| Excited | 8 | −1, 1, 0, 3, 5 |
| Mellow | −3 | −1, −2, −3, −4, −6 |
| Relaxed | −9 | −3, −1, −3, −5, −8 |
| Vocal | 0 | 6, 4, 2, 3, −1 |
| Treble | 0 | 0, 0, 2, 6, 10 |
| Bass | 7 | 0, 0, 0, 0, 0 |
| Speech | −10 | 4, 3, 1, 2, −10 |

Custom and User Setting 1/2 read 0 everywhere on this device; the page does
not draw them from the fixture.

Re-record: stop the app (it holds the RFCOMM channel), then from `src-tauri/`
`cargo run -p mdr --example eq_presets -- <MAC> ../tests/fixtures/eq-presets/<model>-<firmware>.json`.
The first V1 connect right after the app exits can fail with WSA 10048
("only one usage of each socket address"); retrying a minute later succeeded.

Tests: [eqCurve.test.ts](<../../tests/equalizer/eqCurve.test.ts>) (scale,
points, monotone path never overshooting the recorded Bright curve, flat Off,
area, Clear Bass first, summary), [eqPresets.test.ts](<../../tests/equalizer/eqPresets.test.ts>)
(lookup, custom marker, malformed fixture rejected),
[PresetGrid.test.tsx](<../../tests/equalizer/PresetGrid.test.tsx>) (names and
sparklines from the fixture, no sparklines without one, pick reported,
unavailable state), and in [enginePages.test.tsx](<../../tests/engine/enginePages.test.tsx>)
the Equalizer page against the recorded snapshot (curve name, twelve presets
with sparklines, `setEqualizerPreset` on a card) and the Sound page without the
equalizer.

Screenshots (headless Edge over CDP against the dev server with the mock,
1180 x 760): (screenshot removed before publication),
(screenshot removed before publication).

## System page

Plan Task 16, presentational layer. Upstream contracts:

- `MDRPower` holds `uint32_t auto_power_off_minutes;`,
  `MDRWearingPowerMode wearing_power;`, `MDRBoolean auto_pause;`,
  `MDRBoolean head_gesture;` and `MDRBoolean shutdown_requested;`. The
  client's Shutdown menu item sets `power.shutdown_requested = MDR_TRUE;`
  and calls `mdrHeadphonesSetPower`. Its auto power off combo offers
  `kSelections[] = {0, 5, 15, 30, 60, 180}`; `FormatAutoPowerOff` maps 0 to
  `PowerOffNever` ("Do not turn off").
- `MDRVoiceGuidance` holds `MDRBoolean enabled;` and `int8_t volume;`. The
  volume slider is drawn only with `MDR_FEATURE_VOICE_GUIDANCE_VOLUME`, as
  `ImGui::SliderInt("##Volume", &volume, -2, 2)`.
- `MDRGeneralSettingInfo` holds `uint32_t index;`,
  `MDRGeneralSettingType type;` and `MDRBoolean writable;`;
  `MDRGeneralSetting` holds `uint32_t index;` and
  `MDRBoolean boolean_value;`. The client skips
  `if (info.type != MDR_GENERAL_SETTING_BOOLEAN)`, reads names with
  `GetText(MDR_TEXT_GENERAL_SETTING_SUBJECT, info.index)` and
  `MDR_TEXT_GENERAL_SETTING_SUMMARY`, and disables a row with
  `ImGui::BeginDisabled(subjectKey.empty() || !info.writable)`. The subject
  key `TOUCH_PANEL_SETTING` reads `_Def(TouchControl, "Touch sensor control
  panel")`.
- `MDRAssignableControl` holds `MDRAssignableActionKeyLocation location;`,
  `MDRAssignableActionKeyType type;` and `MDRAssignableAction action;`.
  Locations: `MDR_ASSIGNABLE_ACTION_KEY_LEFT` 1, `_RIGHT` 2, `_CUSTOM` 3,
  `_C` 4, `_NC_AMB` 5, `_NC_AMBIENT` 6. Types: `_TYPE_TOUCH_SENSOR` 1,
  `_TYPE_BUTTON` 2, `_TYPE_FACE_TAP` 3. Actions: `MDR_ASSIGNABLE_NONE` 0
  through `MDR_ASSIGNABLE_CUSTOM2` 26 (`_UNKNOWN` 27). Available actions are
  asked per location with `mdrHeadphonesGetAssignableControlActions(...,
  MDRAssignableActionKeyLocation key, ...)`; the client removes
  `MDR_ASSIGNABLE_GOOGLE_ASSISTANT` from each list.
- `MDRConnectionMode` holds `MDRAudioPriority audio_priority;`
  (`MDR_AUDIO_PRIORITY_QUALITY` 1, `_STABILITY` 2). No control is built for
  it yet: the XM3 doc says `CONNECTION_MODE` is advertised but "the client
  has no control for either".

v1 caveats (upstream `docs/device-support/WH-1000XM3.md`): "V1 has no
15-minute element (`AutoPowerOffElementId` knows 5/30/60/180 minutes and
off)", so the client's 15-minute entry is rejected by libmdr; the device
"acknowledges every value but sends no notification", so Task 11 must keep
the chosen value optimistically. Voice guidance on/off is confirmed by a
notification, and "The device has no voice guidance volume". General
settings: "`GENERAL_SETTING2` is `TOUCH_PANEL_SETTING` (boolean)", while
"`GENERAL_SETTING1` is `ASSIGNABLE_KEY_SETTING`, a list (NC/AMB, Google
Assistant, Amazon Alexa)" that the client does not offer yet (status "~",
pending implementation). "Pause When Headphones Are Removed" is unsupported
on the XM3.

Components (`src/components/system/`):

- [GeneralSettingRow.tsx](<../../src/components/system/GeneralSettingRow.tsx>):
  props `index`, `subject`, `summary?`, `value`, `writable`, `disabled?`,
  `onChange(index, value)`; a `ToggleRow`, disabled when not writable.
- [VoiceGuidanceRow.tsx](<../../src/components/system/VoiceGuidanceRow.tsx>) /
  [VoiceGuidanceRow.css](<../../src/components/system/VoiceGuidanceRow.css>):
  props `enabled`, `onEnabledChange`, `volume?`, `onVolumeChange?`,
  `onVolumeCommit?`, `disabled?`. The "Voice guidance" switch, plus a
  -2..2 centre-origin slider row only when `volume` is passed (never on v1).
  The slider is disabled while guidance is off, a departure from upstream
  (which leaves it live): adjusting the volume of muted prompts has no
  audible effect, so it reads as broken.
- [AutoPowerOffPicker.tsx](<../../src/components/system/AutoPowerOffPicker.tsx>)
  with [autoPowerOff.ts](<../../src/components/system/autoPowerOff.ts>):
  props `options: {value: minutes | null, label}[]`, `value`, `onChange`,
  `disabled?`; a `PickerRow` "Auto power off". `null` means never (upstream
  0 minutes). `V1_AUTO_POWER_OFF_OPTIONS` is 5 minutes, 30 minutes, 1 hour,
  3 hours and Never: no 15 minutes.
- [AssignableControlsCard.tsx](<../../src/components/system/AssignableControlsCard.tsx>)
  with [assignableLabels.ts](<../../src/components/system/assignableLabels.ts>):
  props `controls: {location, type, action, actionLabel, actions?}[]`,
  `actions: {action, label}[]` (shared, unless a control carries its own,
  since upstream lists actions per location), `onChange(location, action)`
  and `disabled?`. One `PickerRow` per control with its function as the
  subtitle; the current assignment stays listed even if the device left it
  out. `assignableKeyLabel(location, type)` and `assignableActionLabel(action)`
  follow upstream's `FormatAssignableActionKeyLocation` and
  `FormatAssignableAction` and their English strings, in sentence case
  ("[NC/AMB] Button" reads "NC/AMB button", "Left Touch" reads "Left touch
  sensor", "Ambient Sound Control" reads "Ambient sound control").
- [PowerOffRow.tsx](<../../src/components/system/PowerOffRow.tsx>) /
  `PowerOffRow.css` (removed in Task 23): props
  `deviceName`, `onConfirm`, `disabled?`. A destructive `SheetButton`
  "Power off" that opens a confirmation sheet ("Power off WH-1000XM4?", a
  one-line explanation, destructive Power off and secondary Cancel) with
  focus on Cancel, so an Enter right after opening is harmless. `onConfirm`
  runs only from the sheet's Power off; becoming `disabled` drops an open
  confirmation. It stands on the page without a card around it (see
  verification below).
- [DeviceSettingsCard.tsx](<../../src/components/system/DeviceSettingsCard.tsx>):
  the "Device" grouped list of general settings, voice guidance and auto
  power off.
- [SystemPage.tsx](<../../src/pages/SystemPage.tsx>): optional `device`,
  `controls` and `power`, composed under "Device", "Controls" and "Power";
  without them the "Headphones" placeholder stays.

Task 11 mapping: general settings from `mdrHeadphonesGetGeneralSettingInfo`
and `mdrHeadphonesGetGeneralSetting` (booleans only), written with
`mdrHeadphonesSetGeneralSetting`; voice guidance from and to
`MDRVoiceGuidance` (`volume` only with `MDR_FEATURE_VOICE_GUIDANCE_VOLUME`);
auto power off `null` is `auto_power_off_minutes = 0`, written as an
`MDRPower` read-modify-write; assignable controls from
`mdrHeadphonesGetAssignableControls` and the per-location
`mdrHeadphonesGetAssignableControlActions`, written as the whole list with
`mdrHeadphonesSetAssignableControls`; power off sets `shutdown_requested`
(only with `MDR_FEATURE_SHUTDOWN`).

Screenshots: (screenshot removed before publication),
(screenshot removed before publication).

### Gallery, tests and verification (Tasks 15 / 16)

The gallery gained "Sound" (preset sheet, five bands, Clear Bass and DSEE on
local state), "Sound: disabled", "Sound: equalizer unavailable" and
"System" (the touch panel at index 2, voice guidance without volume, v1 auto
power off, the NC/AMB button with NC/AMB, Google Assistant and Amazon Alexa,
and the power off confirmation); commits and writes log `[gallery] ...`.
The demos live in [SoundDemo.tsx](<../../src/pages/gallery/SoundDemo.tsx>)
and [SystemDemo.tsx](<../../src/pages/gallery/SystemDemo.tsx>).

Tests: [Sheet.test.tsx](<../../tests/primitives/Sheet.test.tsx>) (named modal
dialog with focus inside; Tab and Shift+Tab wrap; Escape and a backdrop
click close and return focus to the opener; the page is `aria-hidden` while
open and restored after; an inside click does not close), the Slider test's
origin case (fill 50-75 % for +5 and 25-50 % for -5 around 0, 0-75 % from
`min`), [EqualizerCard.test.tsx](<../../tests/sound/EqualizerCard.test.tsx>)
(the preset row shows the current name, the sheet opens on it, picking calls
`onPresetChange` once, closes and refocuses the row; becoming disabled
closes an open sheet with no pick; disabled without presets; frequency
labels and signed values; one commit per band gesture with the full array;
no sliders for a band count with no known range, "Band n" with an explicit
range, -6..6 for ten bands; unavailable disables everything and
says why; Clear Bass only when reported),
[SoundOverview.test.tsx](<../../tests/sound/SoundOverview.test.tsx>) (then
`SoundSections.test.tsx`: DSEE type subtitle and switch; nothing when
unavailable; placeholder; named sections; since Task 30 the overview),
[SystemControls.test.tsx](<../../tests/system/SystemControls.test.tsx>)
(auto power off lists exactly the v1 options and reports `null` for Never;
re-picking only closes; assignable rows named from ids and reporting
`(location, action)`; label mapping; the power off confirmation focuses
Cancel and calls `onConfirm` once, becoming disabled drops an open
confirmation, Cancel calls nothing and refocuses the button; a general setting by index, read-only when not writable; voice
volume only when present; System sections with the one destructive button
under Power).

Verification (2026-10-12): `pnpm typecheck` exit 0; `pnpm test`
`Test Files  25 passed (25)`, `Tests  129 passed (129)` (96 earlier + 33).
Broken lines, each run and restored: making the Tab handler return at once
fails the Tab-trap test; dropping the focus restore fails four tests (both
Sheet close tests, the preset pick and the power off Cancel); committing only
the moved band's value fails the band commit test; always rendering DseeRow
fails its unavailable test; making Cancel confirm fails the Cancel test;
letting `useSheet` ignore `disabled` fails both disabled-while-open tests;
returning -10..10 for unknown band counts fails the no-sliders test; never
hiding the page fails the `aria-hidden` test.

Review: Codex could not run (its CLI rejects `service_tier = "priority"` in
its config), so a fresh read-only Claude reviewer reviewed the change: GO
for the presentational layer with concerns. Fixed from it: sheets left open
across a disable (picker and power off), guessed ranges for unknown band
counts, the page behind a sheet reachable by a screen reader, primitive-only
option values, the Sheet test moved to `tests/primitives/`, and the
departures from upstream (DSEE hidden, voice volume disabled while off) now
documented. The macOS focus caveat is documented rather than fixed
(Windows is the target).

Browser pane: at 380 px nothing truncates (row titles, subtitles, trailing
values, slider labels and values, buttons) and the page scroll width equals
the client width; band rows and their inputs are 44 px; picker rows 44 px
(48 with a subtitle); the sheet's top radius is 28 px, its grabber 36 x 5,
the backdrop `rgba(0, 0, 0, 0.6)` in dark, the layer starts at 40 px (below
the title bar), and the check sits 16 px from the card edge, in line with
the rows' chevrons; the focus ring shows on the sheet's current option when
opened from the keyboard, and focus is back on the opener after Escape.
Fixed after looking: EQ fills grew from the left end (a +3 band read as
mostly full); they now grow from the centre through `origin`. The Power off
button sat inside a padded card (a box in a box); it now stands alone under
its header and is the page's only destructive control. Caveat: the Browser
pane only draws frames while it is visible, so exit animations finish only
when it is on screen (a screenshot pumps frames); this is not a renderer bug.

## Engine wiring

Plan Task 11: the renderer consumes the engine. Contract sources, quoted from
[Core Services](<../core/SoundConnect Desktop - Core Services.md>): events
`engine:status` `{state: "disconnected"|"discovering"|"connecting"|"initialising"|"ready", deviceName?, address?, protocol?: "V1"|"V2", lastError?}`,
`engine:snapshot` `{snapshot: Snapshot, noiseView: NoiseView | null}` and
`engine:alert` `{message, autoResponse: "negative" | null}`; commands as
`{"type": "<camelCase name>", ...camelCase fields}` through `engine_send`;
Tauri commands `engine_status`, `engine_snapshot`, `engine_send(command)`,
`engine_devices`, `engine_connect(address)`, `engine_disconnect`. Note the
state names are lowercase (`#[serde(rename_all = "lowercase")] pub enum
ConnState` in `engine_service.rs`), so Ready is `"ready"`.

### Types, API and mock

- [types.ts](<../../src/lib/engine/types.ts>) mirrors the Rust serde shapes
  field for field: `Snapshot` and its nested structs from
  `src-tauri/crates/mdr/src/snapshot.rs` / `types.rs`, every reader nullable;
  libmdr enums as `Enum<"name"> = name | number`, because `enums.rs`
  serializes an unknown value as its raw number; `NoiseView`, `EngineStatus`,
  `AlertEvent`, `DeviceInfo`, and `EngineCommand` as a union tagged by
  `type`. [types.test.ts](<../../tests/engine/types.test.ts>) checks the
  recorded payload [xm4-ready.json](<../../tests/fixtures/snapshots/xm4-ready.json>)
  key for key against `Record<keyof T, true>` lists (they stop compiling
  when a type gains or loses a field) and asserts real values: model
  WH-1000XM4, firmware 2.9.0, battery 90, twenty available features, preset
  `bright`, bands `[0, 5, 7, 7, 9]`, `noiseView` cancelling with `canWind`.
- [ids.ts](<../../src/lib/engine/ids.ts>) converts between the engine's
  camelCase names and the `MDR_*` numbers the Tasks 14-16 components take
  (`presetIds`, `dseeIds`, `keyLocationIds`, `keyTypeIds`,
  `assignableActionIds`, from `Headphones.h`), names presets the way upstream
  does when the device sends none (`FormatEqualizerPreset` and
  `client/I18N/Default.cpp`; the XM4 sends empty names), and formats codecs.
- [api.ts](<../../src/lib/engine/api.ts>) is the `EngineApi` interface;
  [tauriApi.ts](<../../src/lib/engine/tauriApi.ts>) implements it with
  `invoke` and `listen` (an unsubscribe before `listen` resolves is
  remembered, the Hue Desktop pattern).
- [mockApi.ts](<../../src/lib/engine/mockApi.ts>): `createMockEngineApi(fixture)`
  walks Disconnected, Discovering, Connecting, Initialising, Ready on a
  timer (starting on the first subscription, so an unbootstrapped test runs
  no timers), serves the fixture, applies device commands to a local copy
  and echoes an `engine:snapshot` 120 ms later; `powerOff` and `disconnect`
  go to Disconnected, `reconnect` and `connect` walk to Ready again.
  `simulateAlert` and `simulateLinkLoss` exist for tests and the console
  (`window.__engineMock` in mock mode).
- [index.ts](<../../src/lib/engine/index.ts>): `getEngineApi()` chooses the
  mock when `VITE_MOCK_ENGINE=1` ([dev-web.ps1](<../../tools/dev-web.ps1>))
  or when not inside Tauri, but only where `import.meta.env.DEV` or the flag
  is set, so a release bundle never contains the mock or the recording.
- [applyCommand.ts](<../../src/lib/engine/applyCommand.ts>): what a command
  does to a payload (shared by the mock and the optimistic layer), its patch
  slot (`commandKey`), and `reflects` (the payload already shows it). Noise
  writes follow `noise_view.rs` `noise_request`: V1 cancelling is mode ON
  with level 255, wind ON with 0, ambient ON with 1..20.

### Store, optimistic layer, throttle and echo hold

[engineStore.ts](<../../src/state/engineStore.ts>) (zustand vanilla store,
`createEngineStore(api)`; the app's instance is `engineStore`) holds
`status`, `confirmed` (the device's snapshot), `payload` (confirmed plus
pending patches: what the UI shows), `patches`, `held`, `alert` and `error`.
Hooks read it through [engineContext.ts](<../../src/state/engineContext.ts>)
(`useEngine(selector)`, `EngineStoreProvider` for tests), and
[useEngineBootstrap.ts](<../../src/state/useEngineBootstrap.ts>), called once
in [App.tsx](<../../src/App.tsx>), subscribes to the three events and then
loads status and snapshot.

Rules:

1. `send(command)` puts a patch in the command's slot (a newer command in the
   same slot replaces it), so the control moves at once, then calls the api.
2. A snapshot that already shows the patch clears it.
3. A snapshot that disagrees clears it only after `settleMs` (1.5 s): a
   throttled slider's earlier echoes arrive after newer values were sent.
   With no snapshot at all the patch stays, which keeps a value the device
   acknowledges silently (the v1 auto power off) on screen.
4. While a slider's gesture is active (`holdEcho(key, true)` from
   `onGestureChange`), its patch is never cleared.
5. A send the engine's queue rejects drops its patch and sets `error` (a
   command the device refuses later is reverted by rule 3); losing the link
   (`disconnected`, `discovering`, `connecting`) clears snapshot, patches,
   holds and a pending alert, as the engine clears its snapshot.
6. `load()` reads status and snapshot with two awaits; a status or snapshot
   event that arrives meanwhile is newer, so per-event counters stop the read
   from overwriting it (otherwise an older `initialising` read could replace
   a `ready` event and leave Home on "Connecting").
7. A slider that unmounts mid-gesture releases its hold.

`useOptimisticValue` was not reused: one store-level patch list covers every
control, and its 2 s timeout would revert silent acknowledgements.

[useEngineCommand.ts](<../../src/hooks/engine/useEngineCommand.ts>):
`useEngineSend()`, and `useSliderCommand(type, toCommand)`, which binds a
slider: live `onChange` through `useThrottledCallback` (150 ms), the final
value on commit (a pending live send is dropped; the commit is skipped when
it equals the last value sent, so one key press sends one command), and
`onGestureChange` holding echoes. The cards gained optional
`onAmbientLevelGestureChange`, `onVolumeGestureChange`,
`onBandsGestureChange` and `onClearBassGestureChange` props that reach the
`Slider`.

### Hooks: snapshot fields to props

All in `src/hooks/engine/`; each returns null (or `{}`) without a snapshot.

| Hook | Snapshot fields | Props and commands |
| --- | --- | --- |
| [useConnectionView](<../../src/hooks/engine/useConnectionView.ts>) | `status.state`, `deviceName`, `lastError` | disconnected + `lastError` -> error (Try again sends `reconnect`); disconnected / discovering -> searching; connecting / initialising / ready without snapshot -> connecting. `useEngineConnected()` = ready with a snapshot |
| [useDeviceHeaderProps](<../../src/hooks/engine/useDeviceHeaderProps.ts>) | `texts.modelName`, `batteries` (main, else first present), `model.audioCodec` | `name`, `percent`, `charging` (`"yes"`), `codec` (left out when unknown; `DeviceHeader` now takes optional `percent` / `codec`) |
| [useNoiseControlProps](<../../src/hooks/engine/useNoiseControlProps.ts>) | `noiseView` | mode (incl. `wind` when `canWind`), `ambientLevel` 1..20, flags; switch `setNoise {mode}`; slider stops `setNoise cancelling` / `setNoise wind` / `setAmbientLevel {level}` (Task 23); `setFocusOnVoice {enabled}` |
| [useNowPlayingProps](<../../src/hooks/engine/useNowPlayingProps.ts>) | `playback`, `texts.track*` | status, volume 0..30, title / artist / album (blank -> absent); `playback {action}`, `setVolume` (slider) |
| [useEqualizerProps](<../../src/hooks/engine/useEqualizerProps.ts>) | `equalizer`, `equalizerPresets`, features `EQUALIZER` / `DSEE` | presets with ids and names, preset id, bands, Clear Bass with 5 bands, `available`, DSEE row; `setEqualizerPreset` (camelCase id), `setEqualizerBands`, `setClearBass` (sliders), `setDsee` |
| [useSystemProps](<../../src/hooks/engine/useSystemProps.ts>) | `generalSettings`, `voiceGuidance`, `power`, `assignableControls`, `texts.modelName`, features | general settings named by [generalSettingLabels.ts](<../../src/components/system/generalSettingLabels.ts>) (upstream `kGSSubjectStrings`), read-only when unnamed or not writable; voice guidance (volume only with `VOICE_GUIDANCE_VOLUME`); auto power off (0 = Never; V1 list on V1, upstream's full list with 15 minutes otherwise); controls with their own options minus Google Assistant (as upstream); power off with `SHUTDOWN`. `setGeneralSetting`, `setVoiceGuidance`, `setPower {autoPowerOffMinutes}`, `setAssignableControls` (whole list), `powerOff` |
| [useAlertBannerProps](<../../src/hooks/engine/useAlertBannerProps.ts>) | `alert` | question: OK -> `respondToAlert {positive: true}`, Not now -> false; `autoResponse` set: information, OK dismisses, hides after 5 s |
| [useConnectionAnnouncement](<../../src/hooks/engine/useConnectionAnnouncement.ts>) | status, model name | the shell announcer's text, plus "Connected to {name}." |

Tests: [engineHooks.test.tsx](<../../tests/engine/engineHooks.test.tsx>)
runs each hook against the fixture.

### Pages, noise modes and alerts

- `HomePage.tsx` (removed in Task 23): `ConnectedHome` when Ready
  with a snapshot, else `ConnectionStatus`.
- [SoundPage.tsx](<../../src/pages/SoundPage.tsx>) /
  [SystemPage.tsx](<../../src/pages/SystemPage.tsx>) are now thin containers;
  their former bodies are the presentational
  `SoundSections.tsx` (replaced in Task 30 by
  [SoundOverview.tsx](<../../src/components/sound/SoundOverview.tsx>)) and
  [SystemSections.tsx](<../../src/components/system/SystemSections.tsx>),
  which the gallery demos use. Not connected, they show
  [NotConnectedSection.tsx](<../../src/components/page/NotConnectedSection.tsx>)
  ("Connect your headphones to change these settings."). `PlaceholderSection`'s
  default line is now "Not available on these headphones." (the old "Coming
  in a later task" would have shipped).
- [noiseModes.ts](<../../src/components/noise/noiseModes.ts>) gained `wind`
  ("Wind", new `wind` glyph in [Icon.tsx](<../../src/components/icons/Icon.tsx>)),
  offered only with `canWind`, after Noise cancelling. At 420 px the four
  segments fill the 356 px control exactly; at 380 px nothing truncates
  (Noise cancelling's text 96 px in a 115 px segment) and the page does not
  scroll sideways.
- [AlertBanner.tsx](<../../src/components/shell/AlertBanner.tsx>) /
  [AlertBanner.css](<../../src/components/shell/AlertBanner.css>): an inset
  card at the top of the tab panel with a title, a sentence and trailing
  text buttons (OK, and Not now for questions), `role="alert"` for a
  question and `status` for information. Copy from
  [alertCopy.ts](<../../src/components/shell/alertCopy.ts>): the documented
  v1 alert `DISCONNECT_CAUSED_BY_CONNECTION_MODE_CHANGE` reads "Setting
  changed" when the engine answered it, other keys are humanized. The engine's
  own `CONFIRM_CONNECTION_MODE_CHANGE` (sent before a connection-quality
  change, `requiresChoice: true`) asks "Change connection quality?" / "Your
  headphones disconnect and reconnect to apply it, so audio stops for a few
  seconds. SoundConnect reconnects to them by itself."; OK sends the change,
  Not now keeps the current setting.
- [AppShell.tsx](<../../src/components/shell/AppShell.tsx>) renders the
  `ConnectionAnnouncer` (fed by `connectionAnnouncement` in
  [connectionCopy.ts](<../../src/components/shell/connectionCopy.ts>)) outside
  the page transition, and the banner inside the panel;
  `ConnectionStatus` now renders only the card and the focus move.

### Tests and verification (2026-10-12)

New tests in `tests/engine/`: [types.test.ts](<../../tests/engine/types.test.ts>),
[applyCommand.test.ts](<../../tests/engine/applyCommand.test.ts>),
[engineStore.test.ts](<../../tests/engine/engineStore.test.ts>) (patch at
once, cleared by a confirming snapshot; a disagreeing echo held inside the
settle time; gesture hold; slot replacement; rejection; link loss; alert
answer), [mockApi.test.ts](<../../tests/engine/mockApi.test.ts>) (status
walk to Ready; a store driven to Ready, DSEE echo, power off, reconnect),
[engineHooks.test.tsx](<../../tests/engine/engineHooks.test.tsx>),
[enginePages.test.tsx](<../../tests/engine/enginePages.test.tsx>) (searching
from Disconnected; connected cards from the fixture; Noise cancelling sends
`setNoise {mode: "cancelling"}`; the ambient slider sends 12 live and 15
once on commit, nothing late; Pause shows Play at once and stays after the
confirming snapshot; preset pick sends `setEqualizerPreset {preset:
"bass"}`; power off only after the confirmation), shared kit
[engineTestKit.tsx](<../../tests/engine/engineTestKit.tsx>).
[AppShell.test.tsx](<../../tests/shell/AppShell.test.tsx>) gained the
announcer tests moved from ConnectionStatus (same status node across states
and a tab switch, alert only during an error), the mock engine driving the
shell to the recorded device, and the banner (OK answers yes; an
auto-answered alert hides itself without sending).

- `pnpm typecheck`: exit 0. `pnpm test`: `Test Files  34 passed (34)`,
  `Tests  185 passed (185)` (after the review fixes below;
  [engineStoreRace.test.ts](<../../tests/engine/engineStoreRace.test.ts>)
  covers the load race and the alert clear).
- Broken lines, each run and restored: writing 255 for V1 wind fails the
  noise encoding test; ignoring `held` fails the gesture hold test; dropping
  `throttled.cancel()` on commit fails the ambient slider test (a late
  second 15); mapping a `lastError` to searching fails the connection view
  test.
- `cargo test`: not run, no Rust changed.
- Review: Codex could not run (its CLI still rejects `service_tier =
  "priority"`), so a fresh read-only Claude reviewer reviewed the staged
  change: GO, PASS on all four axes with concerns. Fixed from it: the
  `load()` / event race (rule 6; the test fails when the status guard is
  removed), the hold left set by a slider unmounted mid-gesture (rule 7;
  its test fails without the cleanup), the alert kept after a link drop,
  and the store header's wording on rejected sends. Not changed: `error` is
  still not shown (out of scope), and `lastSent` persists across gestures
  (a commit equal to the last sent value is skipped even if the device
  moved since; edge case).

Screenshots (headless Edge over CDP against `pnpm dev:web`, 420 x 760 at 2x,
dark, mock engine from the recording):
(screenshot removed before publication),
(screenshot removed before publication),
(screenshot removed before publication). Judged: header, cards
and sections align on the 16 px gutters; the Wind glyph reads at 16 px; the
alert banner (checked in the Browser pane) sits above the header with its
buttons at the trailing edge. Not changed: the XM4 reports the touch panel
setting `false`, so its switch shows off; that is the device's report.

Live (2026-10-12, `tools/dev.ps1` with the XM4 connected to Windows,
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9334` so the
WebView could be driven over CDP): stderr showed `engine: status Ready
device=WH-1000XM4 address=AA:BB:CC:12:34:56 protocol=V1` after the usual
first-session drop and a reconnect. The window showed the real header
(WH-1000XM4, 90 %, AAC), the device's track and volume, and on Sound the
real preset Bright with bands 0 / +5 / +7 / +7 / +9; PrintWindow capture
(per-monitor DPI aware):
(screenshot removed before publication). The Upscaling
switch was clicked off and on through the UI: stderr logged `command:
engine_send SetDsee { enabled: false }` / `engine: applied SetDsee ...` and
the same for true; the engine's own `engine:snapshot` events carried
`dseeEnabled` false then true, and `engine_snapshot` agreed. (The snapshot
log line does not include DSEE, so stderr shows the commands, not the
echo.) The maintainer used the window during the run: noise mode, a throttled volume
drag, preset Bass and auto power off 30 minutes all reached the engine
(`engine_send` lines). The app was stopped afterwards.

### Engine wiring follow-ups (deferred)

- ~~A window wider than 420 px stretches the cards to its width (seen live at
  1129 px).~~ Fixed in Task 21, see [Wide windows](#wide-windows).
- ~~Auto pause, speak-to-chat, connection mode and paired devices have no
  controls yet.~~ Done in Task 23, see [New menus](#new-menus-task-23).
- Errors from `engine_send` are stored (`error`) but not shown.

## Settings page

Plan Task 17. The app's own preferences and About, under the Settings tab.
Unlike Sound and System these are not device state, so the components read
and write the settings store directly; there is no presentational/container
split to keep, and the gallery renders the real
[SettingsPage.tsx](<../../src/pages/SettingsPage.tsx>) (changes there persist
and switch the theme).

### Settings store and persistence

[settingsStore.ts](<../../src/state/settingsStore.ts>) is a zustand store
with `persist`, all four values in one `localStorage` key,
`soundconnect.settings` (`{"state": {...}, "version": 1}`):

| Field | Default | Meaning |
| --- | --- | --- |
| `theme` | `"system"` | System, Light or Dark; applied by `useApplyTheme`. |
| `startWithWindows` | `false` | The switch also registers or removes the autostart entry (Task 21). |
| `startMinimized` | `false` | Open to the tray at autostart; only meaningful with `startWithWindows`. |
| `keepRunningInTray` | `true` | Closing the window hides it to the tray (read by Rust, Task 18). |

`createSettingsStore(storage)` builds the store over any zustand
`StateStorage` (tests pass a fake); the app's `useSettingsStore` uses
[safeStorage.ts](<../../src/state/safeStorage.ts>), which wraps the storage
accessor and every `getItem` / `setItem` / `removeItem` in try/catch, so a
blocked `localStorage` (the accessor throws in some sandboxed modes), a quota
error or a missing storage means "nothing stored" and the settings live in
memory for the session instead of breaking rendering. On load, `merge` passes
the stored object through `sanitizeSettings`, keeping only known fields of
the right type, so corrupt JSON, an unknown theme such as `"sepia"` or a
string where a boolean belongs fall back to the defaults. Storage is
synchronous, so the store is hydrated when it is created.

These values live in the WebView's `localStorage`, which Rust cannot read,
but the tray close behaviour and "start minimized" (decided before the
window is shown) are Rust's. Tasks 18 and 21 added a mirror file written
from the store; see [Settings sync and autostart](#settings-sync-and-autostart).
Rust checks `startWithWindows && startMinimized`, because `startMinimized`
stays stored while autostart is off.

### Theme application

[useApplyTheme.ts](<../../src/hooks/useApplyTheme.ts>): `applyTheme(theme)`
sets `data-theme="light"` or `"dark"` on `<html>`, or removes the attribute
for `"system"`; [tokens.css](<../../src/styles/tokens.css>) maps
`:root[data-theme]` to `color-scheme`, which every `light-dark()` token
follows, so one attribute recolours the whole app with no per-component
work. Two call sites, both needed:

- [main.tsx](<../../src/main.tsx>) calls `applyTheme` with the hydrated
  store value before `createRoot(...).render`, so a saved Light or Dark is on
  `<html>` before the first paint (no flash of the system scheme at launch).
- `useApplyTheme()` is mounted once in [App.tsx](<../../src/App.tsx>) and
  keeps the attribute in step in a layout effect.

Measured in the Browser pane with the system scheme emulated as dark: right
after the Light option's `click()` the attribute was still `dark`; after the
click's microtasks it was `light` (body `rgb(242, 242, 247)`, row label
"Light"). That is React's discrete-event flush, before the browser's next
rendering step, so the new colours and the picker's label land in the same
frame. After a reload with Light stored, `data-theme` was `light` before
navigating anywhere.

### Components

All in `src/components/settings/`:

- [ThemePicker.tsx](<../../src/components/settings/ThemePicker.tsx>): a
  `PickerRow` titled "Theme" with System / Light / Dark (the section is
  "Appearance"; a row also named "Appearance" read twice).
- [StartupRows.tsx](<../../src/components/settings/StartupRows.tsx>): three
  `ToggleRow`s with one-line summaries, "Start with Windows", "Start
  minimized" (disabled while start-with-Windows is off; its stored value is
  kept for when autostart comes back) and "Keep running in the tray"; rows
  only, so the page wraps them in a `GroupedList`.
- [AboutCard.tsx](<../../src/components/settings/AboutCard.tsx>):
  [AboutHeader.tsx](<../../src/components/settings/AboutHeader.tsx>) (the
  72 px app icon `public/icon.png`, "SoundConnect Desktop" at 22 px display
  semibold with display tracking, "Version 0.1.0" at 13 px secondary), then a
  grouped list ("Engine commit" with the 7-character hash in `--font-mono`
  and the full hash as its tooltip, "Engine source" with the upstream URL,
  "View licenses"), then a `SectionFooter` with the credits line "Protocol
  engine: libmdr by mos9527 and contributors; original SonyHeadphonesClient
  by Plutoberth (MIT)" and "Not affiliated with, endorsed by, or supported by
  Sony." Version and commit are props defaulting to the build constants.
- [BreakableUrl.tsx](<../../src/components/settings/BreakableUrl.tsx>): a
  selectable URL with a `<wbr>` after each `/`, so if it has to wrap it
  breaks at a slash, not mid-name (the first version split
  "SonyHeadphonesClie / nt").
- [LicensesRow.tsx](<../../src/components/settings/LicensesRow.tsx>): the
  "View licenses" row opening a `Sheet` titled "Licenses" with
  [LicenseText.tsx](<../../src/components/settings/LicenseText.tsx>) (one
  licence in a card: a focusable `section` named by its heading, so arrow
  keys scroll a long licence and focusing it keeps the heading in view) and
  our own line, "SoundConnect Desktop itself: MIT License (see LICENSE)" (it read "licence
  to be decided" until the repository took the MIT licence).
- New primitive [SectionFooter.tsx](<../../src/components/primitives/SectionFooter.tsx>):
  the iOS group footer (13 px secondary text, same inset as `SectionHeader`).

New token: `--about-icon-size` 72 px. The icon has no radius or shadow of its
own: the PNG carries its rounded square and gold border, and a box shadow
drew a halo around its transparent margin.

### Build-time constants: version, engine commit, licence

[vite.config.ts](<../../vite.config.ts>) adds

```ts
define: {
  __APP_VERSION__: JSON.stringify(appVersion()),
  __ENGINE_COMMIT__: JSON.stringify(engineCommit()),
},
```

`appVersion()` reads `package.json`'s `version`. `engineCommit()` runs
`git rev-parse HEAD:upstream/SonyHeadphonesClient` (the submodule gitlink in
the committed tree, `4c91fe69711ce638a34e066d9bdcfaff504bbec8` today, not the
submodule's checked-out HEAD, so an uncommitted bump is not shown as shipped)
with `execFileSync` in the config directory, and returns `"unknown"` if git
is missing or the tree is not a checkout, so `pnpm dev:web` and archive
builds keep working. The constants are declared in
[vite-env.d.ts](<../../src/vite-env.d.ts>) and read only through
[buildInfo.ts](<../../src/lib/buildInfo.ts>), which guards them with
`typeof` (Vitest uses its own config without the `define`, so tests see
`"0.0.0"` / `"unknown"` and pass explicit props) and holds
`ENGINE_UPSTREAM_URL` (the submodule remote from `.gitmodules`) and
`shortCommit`. `tauri build` runs `pnpm build`, so the native app gets the
same values; `src-tauri/build.rs` needed no change. Vite evaluates the
config at start, so a submodule bump shows after the dev server restarts.

[licenses.ts](<../../src/lib/licenses.ts>) imports
`upstream/SonyHeadphonesClient/LICENSE?raw`, so the licence text is inlined at
build time (its first line is `MIT License`; the production bundle contains
both the full hash and "Permission is hereby granted"). `licenseParagraphs`
normalises CRLF (a Windows checkout gives CRLF), splits on blank lines and
joins the file's 80-column hard wraps with spaces: shown raw with
`pre-wrap`, each short line wrapped again at 420 px and the text read
ragged.

### Settings sync and autostart

Tasks 18 and 21. The store stays the source of truth; Rust gets a copy.

- [settingsBridge.ts](<../../src/lib/settingsBridge.ts>): `SettingsBridge`
  with `write(values)` (`invoke("settings_write", { settings })`) and
  `setAutostart(enabled)` (`enable()` / `disable()` from
  `@tauri-apps/plugin-autostart`), the Tauri implementation, a no-op one for
  a plain browser and tests, `defaultSettingsBridge` (picked by `isTauri()`)
  and `pickSettings`, which keeps only the four values in a fixed order.
  `isAutostartEnabled()` is the plugin's `isEnabled()`, or `null` outside
  Tauri.
- [settingsBridgeContext.ts](<../../src/state/settingsBridgeContext.ts>):
  `SettingsBridgeProvider` / `useSettingsBridge`, like the engine store's
  context, so tests can hand components a spy bridge.
- [useSettingsSync.ts](<../../src/state/useSettingsSync.ts>), called once in
  [App.tsx](<../../src/App.tsx>): writes the four values on mount, then on
  every store change whose four values differ from the last successful
  write (theme, switches; never the setters). A failed write is logged and
  forgotten, so the next store update retries even with the same values.
  Once on mount it also asks `isAutostartEnabled()` and, when the real entry
  disagrees with the stored switch, corrects the store (without calling the
  plugin again), so the switch shows what Windows will do. Rust reads the file at its next launch; see
  [Core Services](<../core/SoundConnect Desktop - Core Services.md#settings-bridge>)
  for the file and its rule.
- [useStartWithWindowsToggle.ts](<../../src/hooks/useStartWithWindowsToggle.ts>):
  the Start with Windows switch's handler in
  [StartupRows.tsx](<../../src/components/settings/StartupRows.tsx>). It
  stores the value at once (the switch moves immediately), then calls
  `setAutostart`; if the plugin rejects, the stored value is put back, so the
  switch never claims an entry that does not exist.

Tests: [settingsBridge.test.tsx](<../../tests/settings/settingsBridge.test.tsx>)
(dom). `useSettingsSync` writes the four defaults on mount, once more after
`setKeepRunningInTray(false)`, not for a no-op set, and not after unmount;
a failed write is retried on the next store update; an autostart entry that
exists turns the stored switch on at mount without calling `setAutostart`;
the Tauri bridge calls `settings_write` with `{ settings }` (mocked
`invoke`) and the autostart plugin's `enable` / `disable` / `isEnabled`
(mocked module);
the switch stores the value and calls `setAutostart(true)` then `(false)`;
a rejecting plugin puts the switch back to off and logs.

Verification (2026-10-12): `pnpm typecheck` exit 0; `pnpm test`
`Test Files  35 passed (35)`, `Tests  192 passed (192)` (185 before + 7).
Also broken after the review fixes: dropping the reset in the write's
`catch` fails the retry test.
Broken lines, each run and restored: deleting the revert in
`useStartWithWindowsToggle` fails "puts the switch back when the plugin
fails"; deleting the unchanged-values guard in `useSettingsSync` fails
"writes the four values on mount and again only when one changes". Live, in
the installed build driven over CDP: the switch created and then removed the
`HKCU\...\Run` value, and `settings.json` followed the store.

### Wide windows

Superseded by the [Desktop frame](#desktop-frame) in Task 23 (the column is
now 1100 px and sheets keep 592 px through `--sheet-max-width`). Task 21. The window is resizable, and at 1129 px the cards had stretched to
the full width. Two tokens in [tokens.css](<../../src/styles/tokens.css>):
`--content-max-width: 560px` (the content column) and `--page-max-width`
(that plus the two gutters, 592 px). The page (`.app-frame__page` in
[AppFrame.css](<../../src/components/frame/AppFrame.css>)), the tab list
(`.tab-bar__list` in `TabBar.css` (removed in Task 23))
and sheets (`.sheet` in [Sheet.css](<../../src/components/primitives/Sheet.css>))
take `max-width: var(--page-max-width)` and centre with
`margin-inline: auto` (sheets: `align-self: center`). The scroll area, and
so its scrollbar, the tab bar's frosted background and hairline, the sheet
backdrop and the title bar still span the window.

Measured over CDP (headless Edge, mock engine, dark): page and tab list at
1129 px wide `left 269, width 592`; at 760 px `left 84, width 592`; at
420 px `left 0, width 420`; document scroll width equal to the viewport in
all three. In the Browser pane at 1129 px the Theme sheet measured
`left 269, width 592`. Screenshots (1x):
(screenshot removed before publication) (1129 x 760),
(screenshot removed before publication) (760 x 760),
(screenshot removed before publication) (420 x 760). Judged:
the column and the four tab items share one centre line, gutters are
unchanged at 420 px, nothing overflows. Note: Edge's `--screenshot` flag
crops a 420 px window (headless keeps a wider minimum), so the shots use
`Emulation.setDeviceMetricsOverride` instead.

The installed build (Task 21) at its default size, captured with a
DPI-aware `PrintWindow`:
(screenshot removed before publication), showing
"Looking for your headphones" (the XM4 was not connected to Windows then).

### Tests and verification (Task 17)

[settingsStore.test.ts](<../../tests/settings/settingsStore.test.ts>)
(node): defaults; a round trip through one key into a second store; a
storage whose every call throws and a throwing accessor both leave a working
in-memory store; corrupt and ill-typed stored values fall back;
`sanitizeSettings`; `shortCommit`; `licenseParagraphs` with CRLF and LF.
[SettingsPage.test.tsx](<../../tests/settings/SettingsPage.test.tsx>) (dom):
`useApplyTheme` sets dark and light and removes the attribute for system;
picking Light then System in the Theme sheet updates the store, the
attribute and the row; Start minimized is disabled until Start with Windows
is on; AboutCard shows the version, `4c91fe6` with the full hash as title,
the URL, credits and the Sony disclaimer; the licences sheet opens with
focus on the licence region, whose first paragraph equals the real file's
first line; the page has Appearance, Startup and About regions.

- `pnpm typecheck`: exit 0. `pnpm test`: `Test Files  27 passed (27)`,
  `Tests  143 passed (143)` (129 before + 14). `pnpm build` and
  `cargo check --manifest-path src-tauri/Cargo.toml` succeed.
- Broken lines: `disabled={false}` on Start minimized fails "disables Start
  minimized until Start with Windows is on"; returning early for `"system"`
  instead of removing the attribute fails "sets data-theme for light and dark
  and removes it for system" and "updates the store and html data-theme
  when a theme is picked" (3 failed, 10 passed in `tests/settings`).
- Browser pane, 420 x 760: commit and version come through the define in
  dev; at 380 px the document scroll width is 380, no element overflows, no
  ellipsis is active, and the URL fits on one line (304 px).

Screenshots (840 x 1520 device pixels for 420 x 760):
(screenshot removed before publication) (top of
the page), (screenshot removed before publication)
(Light forced while the system scheme is dark, scrolled to the footer),
(screenshot removed before publication) (dark).

## Test setup

[vitest.config.ts](<../../vitest.config.ts>) defines two projects: `node`
runs `tests/**/*.test.ts`, `dom` runs `tests/**/*.test.tsx` in `jsdom` with
[dom.ts](<../../tests/setup/dom.ts>) (jest-dom matchers and Testing Library
cleanup). Vitest 5 no longer has `environmentMatchGlobs`; its config type
documents `projects?: TestProjectConfiguration[]` as "Options for projects".
Dev dependencies: `@testing-library/react 16.3.3`, `@testing-library/dom
10.4.2` (its peer), `@testing-library/user-event 14.6.7`,
`@testing-library/jest-dom 7.0.1`, `jsdom 30.1.2`.

## Verification (2026-10-11)

- `pnpm typecheck`: exit 0, no diagnostics.
- `pnpm test`: `Test Files  9 passed (9)`, `Tests  50 passed (50)` (18
  existing node tests, 1 new node test, 31 new dom tests).
- Each regression test was checked against a deliberately broken variant
  (one line changed, run, restored): dropping `gesture.current = null` in
  `end()` fails the blur-after-drag and change-after-drag tests; showing
  `value` instead of the held value fails the mid-drag test; guarding clicks
  against `selectedIndex` fails the async-click test; dropping the gesture
  source check fails the key-release test; dropping the primary-button guard
  fails the right-button test; restoring the old segment guard (pending
  request blocks a repeat) fails the retry test; removing the
  end-on-disable effect fails the disable-mid-drag test.
- Browser pane at 420 x 760, measured: cards x = 16, width 388 (16 px gutters
  both sides); separators start at x = 66, the title's x; the selected
  segment pill matches its segment exactly (199.1 / 119.4 x 32 for both);
  switch knob 2 px from the track on every side; rows 44 px (47.6 px with a
  subtitle); slider thumb centred on the track. At 380 px: page scroll width
  380 = client width (no horizontal scroll) and no segment label truncated.
  Keyboard: Tab reaches the segmented control, slider, switches and rows in
  order; arrows move the segment pill; arrows step the slider; focus rings
  visible on the segment, the slider thumb and the inset row ring.
  Real pointer drag in the Browser pane (Chromium): thumb dragged from 14
  and released 150 px below the slider; the input logged `pointerdown:14`,
  `pointerup:7`, `change:7`, `lostpointercapture:7` and the "Sent ambient"
  chip read 7, so the release outside the input was delivered and committed
  once. Three Left-arrow presses from 7 committed 4. Not yet checked inside
  the WebView2 window itself (same Chromium engine).

Screenshots (Browser pane, 840 x 1520 device pixels for 420 x 760):
(screenshot removed before publication),
(screenshot removed before publication),
(screenshot removed before publication) (keyboard
focus on the Equalizer row).

## Review

An independent read-only review of the first commit returned GO with
concerns (Codex was unavailable: its CLI rejected `service_tier = "priority"`
in its config, so a fresh Claude reviewer was used). Fixed in the follow-up
commit: pointer capture on the slider; commit-on-release no longer writes
refs during render, reads the gesture baseline from the controlled value and
commits out-of-gesture changes at once; segmented keys step from the focused
segment; `ListRow.selected` with `aria-current`; icon sizes and the header
action radius moved to tokens; tests for each of these.

A second (Opus) code-quality review found more, fixed in a third commit:
segment clicks were guarded against the lagging `value`, so a quick second
click was dropped (now compared with the last request); the slider now shows
the user's value during a gesture and reports `onGestureChange`; gesture
source tracking; primary button only; `SegmentedControl.disabled`; Toggle's
name is required by type; state, focus-ring and weight tokens replace the
remaining literals; tests proven against broken variants. Deferred for later
by the coordinator: review items 7, 8, 10 and 12 to 14. Its re-review found
two regressions, fixed in a fourth commit: a pending segment request blocked
retrying the same segment after a lost echo, and a slider disabled mid-drag
could stay stuck in its gesture.

### Integration review (2026-10-12)

An Opus review of the combined engine and renderer diff (`b2465ae..eeccc6c`)
against the maintainer's feedback found the spec met: the left-rail desktop frame,
Ambient Sound Control as one slider (Noise cancelling, Wind noise reduction,
1..20) under a three-way switch with no wind segment, Speak-to-Chat,
connection quality, the device list (actions hidden on protocol V1, where
libmdr refuses `setPairedDevice`), automatic pause and the two-device switch;
optimistic patches go through `commandKey`/`applyCommand` with
`setNoise`/`setAmbientLevel` sharing one slot; presentational components take
view props. No Important findings. Minor follow-ups:

- `applyCommand`'s `setPairedDevice` branch is never applied, because
  `commandKey` returns null for it (actions are shown as pending instead):
  delete it, or use it if paired-device actions are ever predicted.
- `components/shell/alertCopy.ts` still imports `AlertEvent` from
  `lib/engine/types`, the one engine type in `components/`; map it in a hook.
- `toSpeakToChatProps` writes a reported `unknown` sensitivity or timeout as
  `auto` / `short` when only the switch changes.
- On the XM4, multipoint and "Priority on sound quality" (LDAC) interact on
  the device; the UI does not explain it, and this was not verified live
  (the headphones were not connected during the 0.1.1 verification window).
- Errors from `engine_send` are still not shown.

## Open design questions for the maintainer

1. Switch "on" colour: answered in Task 13b, gold (`--switch-on`), Sony.
2. Leading row icons: plain accent glyphs (current, now gold / bronze) or
   iOS-style coloured rounded tiles behind white glyphs?
3. Row text at 15 px (Windows density) or iOS's 17 px?
4. Sheet buttons: 12 px radius (current) or capsules like the segmented
   control?
5. The primary button is the one large gold fill (charcoal on gold in dark,
   white on bronze in light; both pass AA). Keep it filled, or make the
   primary a gold-tinted button so gold never fills a full-width area?
6. Segments size to their content; prefer iOS's equal widths (would need
   shorter labels such as "Cancel noise")?
7. App icon at 16 px: approve a simplified small-size variant (see App icon
   pipeline)?
8. Task 23: two card columns from a 700 px page column (every desktop size)
   rather than only at 1100 px of content; keep, or one wide column on
   smaller windows?
9. Task 23: this PC is guessed as the only connected device. Should the
   engine report the PC's own Bluetooth address, so it is exact with two
   devices connected?
10. Task 23: Status has room below its cards. Add quick Speak-to-Chat and
    connection-quality switches there, as Sony's main screen does?

## Setup flow

Task 25. The maintainer, 2026-10-12: "when I open the app it just automatically is
searching for headphones instead of allowing ME to prompt connecting them",
and "the app is going to need to feature the same setup process as the mobile
app like if you got new headphones". The engine now starts idle (round 2 of
the core contract) and the renderer adds a first-run wizard.

Contract, quoted from [Core Services](<../core/SoundConnect Desktop - Core Services.md#contract-changes-2026-10-12-round-2>):
`remembered: Profile | null; // always present`, `reason?: FailureReason; // only after a failed connection attempt`,
`type FailureReason = "notConnectedToWindows" | "busy" | "timeout" | "refused";`,
`type Profile = { address: string; name: string; modelName: string; firmware: string; protocol: "V1" | "V2"; lastSeen: number };`
and `type DevicesEvent = { devices: { address: string; name: string; remembered: boolean }[] };`.
The renderer types are in [types.ts](<../../src/lib/engine/types.ts>)
(`RememberedDevice`, `ConnectFailureReason`, `ScannedDevice`,
`DevicesEvent`, and the commands `scan`, `forgetDevice`, `setAutoConnect`,
`openBluetoothSettings`); [api.ts](<../../src/lib/engine/api.ts>) gained
`onDevices` and [tauriApi.ts](<../../src/lib/engine/tauriApi.ts>) listens to
`engine:devices`. The expected shapes in the task brief matched the
published contract; the only adaptation was typing `modelName` and
`firmware` as strings that may be empty (not null) and `lastSeen` as Unix
milliseconds.

### When the wizard shows

[AppRoot.tsx](<../../src/components/shell/AppRoot.tsx>) (mounted by
[App.tsx](<../../src/App.tsx>) instead of `AppShell`) chooses the window's
content: the wizard while the setup store is open, the empty frame until the
engine's first status (`statusLoaded`, so a first run never flashes the app
before the wizard), else the app. [useSetupGate](<../../src/hooks/setup/useSetupGate.ts>)
opens the wizard, in a layout effect so it lands before the first paint,
when the engine has sent a status (`hasStatus`; a failed read shows the
pages, not a wizard with no way out), nothing is remembered and nothing is
connected. It clears a settled connect attempt first, so an old "connected"
cannot skip the new setup to "All set". It opens
at Welcome on a first run, at "Pair with Windows" when the persisted
`onboardingDone` is already true (after "Forget these headphones").
[setupStore.ts](<../../src/state/setupStore.ts>) holds `open` and `step`
(`welcome`, `pair`, `choose`, `done`) in memory only.

### Steps

[SetupScreen.tsx](<../../src/components/setup/SetupScreen.tsx>) renders the
`AppFrame` without the navigation rail (nothing else is usable yet), keyed by
step so steps cross-fade. [SetupWizard.tsx](<../../src/components/setup/SetupWizard.tsx>)
is the container and takes `step` as a prop, because the card fading out is
a live element: reading the step from the store there made both layers show
the new step (a test caught it). Navigation is
[useSetupWizard](<../../src/hooks/setup/useSetupWizard.ts>): `next` and
`back` read the current step when called, a successful connect on "Choose"
moves to "All set" by itself, going back or cancelling clears a settled
attempt, and `finish` sets `onboardingDone`, closes the wizard and opens
Status. "Cancel setup" is offered only while headphones are remembered.

- [SetupCard.tsx](<../../src/components/setup/SetupCard.tsx>) /
  [SetupCard.css](<../../src/components/setup/SetupCard.css>): one centred
  card at most `--setup-card-width` (560 px): progress dots, optional
  picture, a 28 px `<h1>` that takes focus on mount (so each step is
  announced and focus never drops to the body), lead, content, a full-width
  primary `SheetButton`, and quiet text actions. Lists inside the card use
  `--surface-2` so they read as a group.
- [ProgressDots.tsx](<../../src/components/setup/ProgressDots.tsx>) /
  [ProgressDots.css](<../../src/components/setup/ProgressDots.css>): 8 px
  dots, the current one a 24 px accent pill, finished ones the accent at
  45 %; decorative, with "Step 2 of 4" as hidden text.
- [StepNavigation.tsx](<../../src/components/setup/StepNavigation.tsx>):
  Back and "Cancel setup" as the new
  [TextButton](<../../src/components/primitives/TextButton.tsx>) primitive
  ([TextButton.css](<../../src/components/primitives/TextButton.css>)).
- [WelcomeStep.tsx](<../../src/components/setup/WelcomeStep.tsx>) /
  [WelcomeStep.css](<../../src/components/setup/WelcomeStep.css>): the app
  icon, what the app does, and the Sony disclaimer (`SONY_DISCLAIMER` from
  About); "Get started".
- [PairStep.tsx](<../../src/components/setup/PairStep.tsx>) with
  [PairingSteps.tsx](<../../src/components/setup/PairingSteps.tsx>) /
  [PairingSteps.css](<../../src/components/setup/PairingSteps.css>): an
  Over-ear / Earbuds segmented choice (default from the remembered model,
  [usePairingFamily](<../../src/hooks/setup/usePairingFamily.ts>)) and its
  numbered steps from
  [pairingInstructions.ts](<../../src/lib/devices/pairingInstructions.ts>):
  over-ear, hold the power button about 7 s until "Bluetooth pairing";
  earbuds, both touch sensors about 5 s; then add the device in Windows. The
  app cannot pair, so "Open Windows Bluetooth settings" sends
  `openBluetoothSettings`
  ([useOpenBluetoothSettings](<../../src/hooks/setup/useOpenBluetoothSettings.ts>)).
  `familyForModel` there (`WH-` over-ear, `WF-` and `LinkBuds` earbuds) is
  also used by the image agent's `models.ts`.
- [ChooseStep.tsx](<../../src/components/setup/ChooseStep.tsx>) /
  [ChooseStep.css](<../../src/components/setup/ChooseStep.css>): Scan sends
  `scan` ([useDeviceScan](<../../src/hooks/setup/useDeviceScan.ts>)); a
  polite status line says what is happening (the idle hint, "Looking for
  Bluetooth devices…", nothing found, the scan failed, or "2 devices found").
  [DeviceChoiceList.tsx](<../../src/components/setup/DeviceChoiceList.tsx>)
  ([DeviceChoiceList.css](<../../src/components/setup/DeviceChoiceList.css>))
  lists the answer through
  [scannedDevices.ts](<../../src/lib/devices/scannedDevices.ts>): `engine:devices`
  lists every connected Bluetooth device, so remembered headphones come
  first, then Sony names, then the rest ("Other Bluetooth device"). Nothing
  is hidden: a renamed pair must stay choosable. Selecting sends
  `connect {address}` ([useConnectAttempt](<../../src/hooks/setup/useConnectAttempt.ts>));
  the row says "Connecting…". Rows and Scan stay enabled while busy
  (disabling the pressed control dropped focus to the page); the store
  ignores a second pick or scan instead. A failure shows
  [ConnectFailureNote.tsx](<../../src/components/setup/ConnectFailureNote.tsx>)
  ([ConnectFailureNote.css](<../../src/components/setup/ConnectFailureNote.css>),
  `role="alert"`; Try again connects to the same address) with the text from
  [connectFailureText.ts](<../../src/lib/devices/connectFailureText.ts>);
  `notConnectedToWindows` and "nothing found" also offer the Bluetooth
  settings button.
- [DoneStep.tsx](<../../src/components/setup/DoneStep.tsx>): the image
  agent's `DeviceImage` (160 px), "All set", model and firmware rows (from
  the snapshot, else the remembered profile), Done.

Failure texts: `notConnectedToWindows` "Windows is not connected to these
headphones yet. Connect them in Bluetooth settings, then try again."; `busy`
"Another app is controlling the headphones (for example the Sony app on your
phone). Close it and try again."; `timeout` "The headphones did not answer in
time. Make sure they are switched on and nearby, then try again."; `refused`
"The headphones refused the connection. Switch them off and on again, then
try again."

### Store: scan and connect attempts

[engineStore.ts](<../../src/state/engineStore.ts>) gained `statusLoaded`
(also set when `load()` fails, so the window is never left blank),
`hasStatus` (a status the engine really sent), `remembered`, `scan` (`idle`,
`scanning`, `done` or `failed`; the last list is kept during a rescan; an
`engine:devices` event outside a scan is ignored; no answer within 20 s ends
it as failed), `attempt`, `startScan`, `connectTo`, `receiveDevices`,
`clearAttempt` and `forgetDevice` (sends `forgetDevice` and drops the
attempt).
[connectAttempt.ts](<../../src/lib/engine/connectAttempt.ts>) follows one
connect: `ready` with a snapshot for its own address is connected;
`disconnected` with a `reason` or `lastError` is failed; a bare
`disconnected` is ignored, because the engine drops any link before
connecting, and so is any status naming another address (with headphones A
connected, A's statuses and snapshots keep arriving while B is chosen).

The engine's `remembered` is per address: `remembered_for` in
`engine_service.rs` returns the profile of the address the status names, else
the latest. While connecting to, or failing on, a device that is not
remembered yet, the status therefore says `remembered: null` although another
pair is remembered. `nextRemembered` keeps the store's profile then and clears
it only when a status naming no device, or naming that very address, reports
none (after "Forget"). Every hook reads the store's `remembered`, so "Cancel
setup", the Status card and the gate do not flicker on a failed new device.

### Settings rows and persistence

[settingsStore.ts](<../../src/state/settingsStore.ts>) gained
`onboardingDone` and `autoConnect` (both default false, sanitised like the
rest). The Rust mirror still gets only its four fields (`BridgedSettings` in
[settingsBridge.ts](<../../src/lib/settingsBridge.ts>); the core's
`settings_write` keeps the stored `autoConnect` when the field is absent).
`autoConnect` reaches the engine as the `setAutoConnect` command, which the
core also stores, sent once at start and on every change by
[useAutoConnectSync](<../../src/hooks/setup/useAutoConnectSync.ts>), so the
renderer's stored choice wins. The Settings page's new first section,
"Headphones" ([HeadphonesRows.tsx](<../../src/components/settings/HeadphonesRows.tsx>)):
[AutoConnectRow.tsx](<../../src/components/settings/AutoConnectRow.tsx>)
("Connect automatically when the headphones appear", off by default),
[SetUpHeadphonesRow.tsx](<../../src/components/settings/SetUpHeadphonesRow.tsx>)
(reopens the wizard at "Pair with Windows", clearing an old attempt) and,
while something is remembered,
[ForgetHeadphonesRow.tsx](<../../src/components/settings/ForgetHeadphonesRow.tsx>)
([ForgetHeadphonesRow.css](<../../src/components/settings/ForgetHeadphonesRow.css>)):
a red row whose confirmation sheet opens on Cancel and sends
`forgetDevice {address}`; the engine re-publishes `remembered: null` and the
gate reopens setup.

### Mock

[mockApi.ts](<../../src/lib/engine/mockApi.ts>) now behaves like the round-2
engine: it starts `disconnected` with the recorded XM4 remembered and walks
to Ready only on `connect`, `reconnect` or `setAutoConnect {enabled: true}`
(options `remembered`, `autoConnect`, `scanMs`, `otherDevices`). `scan`
answers with `engine:devices`; connecting to an address it has no recording
for fails at once with `notConnectedToWindows` (no `connecting`, as the
engine opens no socket), and statuses carry the profile per address like
`remembered_for`; `failNextConnect(reason)` forces the
next failure; `forgetDevice` drops the profile; `openBluetoothSettings` only
logs. In [index.ts](<../../src/lib/engine/index.ts>), `VITE_MOCK_REMEMBERED=0`
starts a first run, and the dev mock lists a second device (WF-1000XM5) that
fails, so the failure path can be seen. Tests that relied on the old
automatic walk pass `autoConnect: true`.

## Connection flow (remembered device)

With headphones remembered and auto-connect off, launch shows the app, not
the wizard, and nothing is scanned or connected.
[StatusPage.tsx](<../../src/pages/StatusPage.tsx>) renders
[RememberedDeviceCard.tsx](<../../src/components/status/RememberedDeviceCard.tsx>)
([RememberedDeviceCard.css](<../../src/components/status/RememberedDeviceCard.css>))
while not connected: the shared `ConnectionState` layout with the product
image (160 px), the name, a state line with a dot ("Not connected",
"Connecting…", or "Couldn't connect" in amber), the advice sentence, a
primary button (Connect; "Connect now" while the engine searches with
auto-connect on; a disabled "Connecting…"; or Try again) sending
`connect {address}`, and "Open Bluetooth settings". After Connect, focus
moves to the name, because the pressed button turns disabled
(`useFocusAfterAction`). Without anything remembered the old
`ConnectionStatus` cards remain.

Remembered-device titles come from
[deviceTitle.ts](<../../src/lib/devices/deviceTitle.ts>):
`rememberedTitle(profile)` is `modelName`, else Windows' `name`, else "Sony
headphones", and a Bluetooth address is never a title (`displayableName`
drops address-shaped names, which 0.1.3 profiles could hold). The Status
card, the rail, the connection views, the Settings "Forget" row and the
wizard's "All set" step all use it; a status `deviceName` that is an address
is skipped the same way. Tests:
[deviceTitle.test.ts](<../../tests/devices/deviceTitle.test.ts>) (fallback
order, connection views, rail) and the 0.1.3-profile case in
[RememberedDevice.test.tsx](<../../tests/onboarding/RememberedDevice.test.tsx>).

[connectionCopy.ts](<../../src/components/shell/connectionCopy.ts>): the
`ConnectionView` gained `idle {deviceName}` ("{name} isn't connected" /
"Switch them on and connect them in Windows Bluetooth settings, then select
Connect."), an optional `deviceName` on `searching` ("Looking for {name}"),
and `reason` on `error` (the advice comes from `failureText`).
`connectionStateLabel(view)` is shared by the card and the rail.
[useConnectionView](<../../src/hooks/engine/useConnectionView.ts>) maps
`disconnected` with `reason` or `lastError` to error, `disconnected` with a
remembered device to idle, `discovering` to searching (named), and Try again
now connects to the failed or remembered address (`reconnect` only when
neither is known). [useRailDeviceProps](<../../src/hooks/engine/useRailDeviceProps.ts>)
shows the remembered name with "Not connected" or "Connecting…" (the image
agent's `RailDevice` shows that model's photo from the name).
[ConnectionStatus.tsx](<../../src/components/shell/ConnectionStatus.tsx>)
renders a plain idle card for completeness;
its searching, connecting and error cards take an optional `model` (else
`view.deviceName`) for the product photo, so a named device shows its own
photo instead of the neutral WH-1000XM5;
[useRememberedDevice](<../../src/hooks/setup/useRememberedDevice.ts>) reads
`status.remembered`.

### Real states from Windows (0.1.9)

The maintainer saw "Couldn't connect" while the headphones were simply
switched off. The engine now publishes `windowsConnected`
([Core Services](<../core/SoundConnect Desktop - Core Services.md#contract-changes-019-windowsconnected>)),
re-checked every 3 s while idle, and
[useConnectionView](<../../src/hooks/engine/useConnectionView.ts>) maps
remembered headphones onto five states, shown by the rail and the Status
card through `connectionStateLabel` in
[connectionCopy.ts](<../../src/components/shell/connectionCopy.ts>):

| State line | When | Card advice |
|---|---|---|
| Off or out of range (`offline`) | `windowsConnected` false, including a `notConnectedToWindows` failure, a link lost because they switched off, and auto-connect waiting (`discovering`) | "{name} is off or out of range": switch them on, SoundConnect notices within seconds |
| Connected to Windows (`idle`) | listed, not connected to the app (auto-connect off, or a link lost while still listed) | Connect is the call to action |
| Connecting… / Reconnecting to {name} | `connecting`, `initialising`, `ready` before the snapshot; the second with `reconnectingAfterSettingChange` | |
| Couldn't connect (`error`) | only `busy`, `timeout` or `refused` while listed; the reason's sentence (`failureText`) underneath, Try again | |
| Connected | Ready with a snapshot | |

A failure clears as soon as Windows' state changes, because the engine drops
`reason` / `lastError` then. A status without `windowsConnected` (an older
engine) is treated as listed. With nothing remembered, failures still show as
errors (the setup wizard's own mapping). The wizard's `notConnectedToWindows`
sentence ([connectFailureText.ts](<../../src/lib/devices/connectFailureText.ts>))
now reads "They are off, out of range, or not connected to Windows. Switch
them on and connect them in Bluetooth settings, then try again." The mock
engine ([mockApi.ts](<../../src/lib/engine/mockApi.ts>)) reports
`windowsConnected: true` except on its `notConnectedToWindows` failure.
`RememberedDeviceCard` and `ConnectionStatus` treat `offline` like `idle`
(Connect, plain card). The tray tooltip still says "Not connected" for both.

Tests: [connectionStateLabels.test.ts](<../../tests/shell/connectionStateLabels.test.ts>)
(the five texts and when each applies, including a timeout that turns into
"Off or out of range" once Windows drops the device); the onboarding tests'
expectations moved to "Connected to Windows" and the new failure sentence,
and [deviceTitle.test.ts](<../../tests/devices/deviceTitle.test.ts>) uses a
`busy` failure for its error case.

### Tests and verification (Task 25, 2026-10-12)

New: [connectFlow.test.ts](<../../tests/onboarding/connectFlow.test.ts>)
(attempt rules, failure texts, pairing families, device order, the store's
scan, scan timeout and connect, the mock's first run, scan, connect, forced
failures, forget and auto-connect),
[SetupWizard.test.tsx](<../../tests/onboarding/SetupWizard.test.tsx>)
(first run without the rail and each step's command, the four failure texts
with Try again, the flow end to end on the mock, the start step after
"Forget", the empty frame before the first status) and
[RememberedDevice.test.tsx](<../../tests/onboarding/RememberedDevice.test.tsx>)
(Not connected with no scan, Connect, Connecting, the busy text, Try again,
the rail, no wizard; Settings: auto-connect sends `setAutoConnect`, "Set up
new headphones" and Cancel, Forget only after the confirmation, then setup).
[AppShell.test.tsx](<../../tests/shell/AppShell.test.tsx>),
[mockApi.test.ts](<../../tests/engine/mockApi.test.ts>) and
[settingsStore.test.ts](<../../tests/settings/settingsStore.test.ts>) were
adjusted.

- `pnpm typecheck`: exit 0. `pnpm test`: `Test Files  38 passed (38)`,
  `Tests  254 passed (254)` (after the review fixes below).
- Broken lines, each run and restored: failing an attempt on any
  `disconnected` fails 2 tests; mapping a remembered device to searching
  fails the "Not connected" test; a gate that ignores `remembered` fails 5;
  a wrong `busy` text fails 3; a wizard that does not advance on connect
  fails 2; dropping the attempt's address check fails 2; taking the status's
  `remembered` as is fails 2; a gate keyed on `statusLoaded` fails the
  failed-read test. (The stale-attempt test is guarded twice, by the gate and
  by `forgetDevice`; removing one alone keeps it green.)
- Review: a read-only Claude reviewer returned NO-GO with three high
  findings, all fixed with tests: a settled "connected" attempt surviving
  Forget (the wizard skipped to "All set"), attempts ignoring their address,
  and the per-address `remembered` treated as global. Also fixed: the
  failed-read wizard, focus lost on disabled rows and Scan, unsolicited
  `engine:devices`, a stale scan rejection overwriting a newer scan, the
  mock walking through `connecting` for an unlisted address, and the
  auto-connect sync comment. Not changed: the scan timer is not cleared when
  the store is discarded (the app's store lives for the whole session).
- Screenshots (headless Edge over CDP against the dev server with the mock,
  1180 x 760, dark, and `-light`): (screenshot removed before publication),
  (screenshot removed before publication),
  (screenshot removed before publication),
  (screenshot removed before publication),
  (screenshot removed before publication),
  (screenshot removed before publication),
  (screenshot removed before publication),
  (screenshot removed before publication),
  (screenshot removed before publication),
  (screenshot removed before publication),
  (screenshot removed before publication),
  (screenshot removed before publication).
  Measured: the card is 560 px wide at x = 310 in a 1180 px window (centred),
  with no horizontal or vertical scroll on any step. Judged and fixed: the
  finished progress dots (`--accent-soft`) almost vanished in dark, now the
  accent at 45 %; the device and model lists blended into the card, now
  `--surface-2` like the pairing steps. A first capture caught the step
  cross-fade midway; captures now wait 1.6 s.
- Not verified: the real Tauri window against the round-2 engine with the
  XM4 (the opener plugin's Bluetooth page, a real `busy` from the phone).

### Updates (0.1.9)

The renderer side of in-app updates ([Core Services, Updates](<../core/SoundConnect Desktop - Core Services.md#updates-019>)):

- [api.ts](<../../src/lib/updater/api.ts>): `UpdaterApi` (`check`,
  `relaunch`) and `AvailableUpdate` (`version`, `notes`, `install(onProgress)`
  with the fraction done), `tauriUpdaterApi` over the plugins (loaded by
  dynamic import), `noUpdaterApi` in the browser, `updateErrorText` (offline
  and signature failures in plain words) and `releasePageUrl`.
- [updaterStore.ts](<../../src/state/updaterStore.ts>): `createUpdaterStore(api)`,
  phases `idle`, `checking`, `upToDate`, `available`, `downloading`
  (`progress`), `installing`, `error`; `dismissed` is "Later".
- [useAutoUpdateCheck](<../../src/hooks/updates/useAutoUpdateCheck.ts>)
  (in `AppShell`): 5 s after launch, when `checkForUpdates` is on and
  `lastUpdateCheck` is a day old, records the time and checks. Both settings
  are new in [settingsStore.ts](<../../src/state/settingsStore.ts>)
  (`checkForUpdates` default on, `lastUpdateCheck` 0).
- [UpdateBanner](<../../src/components/updates/UpdateBanner.tsx>)
  ([UpdateBanner.css](<../../src/components/updates/UpdateBanner.css>), the
  progress bar; the rest reuses `AlertBanner.css` so it reads as the same
  banner): "Version X is available" with Release notes / Later / Install now;
  "Downloading version X…" with a percentage and a `progress` bar;
  "Installing version X…"; "Update failed" with the sentence, Dismiss and Try
  again (an alert). Fed by
  [useUpdateBannerProps](<../../src/hooks/updates/useUpdateBannerProps.ts>)
  inside [UpdateBannerHost](<../../src/components/updates/UpdateBannerHost.tsx>),
  which also owns [UpdateNotesSheet](<../../src/components/updates/UpdateNotesSheet.tsx>)
  ([UpdateNotesSheet.css](<../../src/components/updates/UpdateNotesSheet.css>);
  the notes from `latest.json` and the release page address). The host sits
  at the top of every page, above the headphones' alert banner.
- Settings gains an "Updates" section above About
  ([UpdateRows.tsx](<../../src/components/settings/UpdateRows.tsx>)):
  "Check for updates automatically" and "Check for updates" with the state
  line and Check now (Install now once one is found).

Tests: [UpdateBanner.test.tsx](<../../tests/updates/UpdateBanner.test.tsx>)
(no banner when up to date; available with the notes sheet and Later; the
progress bar at 50 % then installing and relaunch; a signature failure as an
alert with Try again re-installing; offline wording; `updateErrorText`; the
Settings rows; the daily automatic check and its switch) and
[settingsStore.test.ts](<../../tests/settings/settingsStore.test.ts>) (the two
new settings round-trip).

## Windows audio page

Task 28 built it; Task 31 (0.1.9) redesigned it. A rail page, "Windows
audio" (`speaker` icon, after Devices), over the `winaudio` crate
([Windows Audio](<../core/SoundConnect Desktop - Windows Audio.md>)).

Why the redesign: the maintainer, 2026-10-14, plays video games mainly and
wants stereo then, so the page should offer a choice between stereo audio
and mono audio with mic rather than "calls vs music", and found the old
layout ugly even though every setting was there. So the old "Calls vs
music" card and the "Fix for music" / "Fix for calls" buttons became one
mode choice, and the rest regrouped into three plain cards.

Layout, top to bottom:

1. **Mode tiles** across both columns: two equal-height
   [ChoiceTile](<../../src/components/primitives/ChoiceTile.tsx>)s
   ([ChoiceTile.css](<../../src/components/primitives/ChoiceTile.css>)),
   "Stereo audio" (headphones glyph: "Games, music and video. Full quality,
   headphone mic off.") and "Mono audio with mic" (chat glyph: "Voice chat
   and calls through the headphone mic. Windows drops to mono call
   quality."). The current one has the 2 px gold edge and a filled gold
   check disc; the other an empty ring. Each tile is a button with
   `aria-pressed`, not a radio, because pressing the other one opens the
   preview instead of switching at once; pressing the current one does
   nothing. Under them a status line: "Currently: Stereo audio" (or "Mono
   audio with mic"), and with drift a warning pill "Needs attention (n)" plus
   "Review", which previews the current mode's plan.
2. The last apply's outcome and the not-connected notice, also full width.
3. **Processing** (Audio enhancements, Spatial sound with "Open", Mono mix
   (accessibility), renamed from "Mono audio" so it is not mistaken for the
   mode) and **Format and volume** (Default format, Exclusive mode, Lower
   other sounds during calls, Absolute volume) in the left column;
   **Connection** (Codec reported by headphones, Adapter power saving with
   the adapter's name in its sentence, Bluetooth service, 2.4 GHz Wi-Fi) and
   **Advanced** in the right.
4. **Advanced**: a section-header-sized disclosure, closed by default, with
   "Restore previous settings" (opens the confirm sheet; without a restore
   point the row is plain text saying nothing is saved yet), "Forget restore
   point" (only with one) and "Open Windows Sound settings".

Every row is title (admin rows keep the shield), one plain sentence, then on
the right the live state as secondary text and its control (switch, picker
chevron, "Open", or the value alone). "Recommended: Off" appears as a small
warning caption under the sentence only when the live state differs, instead
of the old always-on "Now / Recommended" line. The old per-row Hands-Free,
default playback, playback for calls and microphone for calls rows are gone:
the mode tiles and the preview own them, and their drift counts toward
"Needs attention". The Windows volume and Bluetooth adapter (name only) rows
were dropped as facts nobody acts on here.

Data and pure logic ([src/lib/winaudio](<../../src/lib/winaudio>)):

- [types.ts](<../../src/lib/winaudio/types.ts>) mirrors the crate's serde
  model (`WinAudioSnapshot`, `Change`, `ChangeResult`, `Plan`, `FixKind` =
  `"stereo" | "monoMic"`) and `needsAdmin`, the same three admin kinds as
  `Change::needs_admin`.
- [api.ts](<../../src/lib/winaudio/api.ts>): `WinAudioApi`, one method per
  `winaudio_*` command, and `tauriWinAudioApi`. `fixPreset("stereo" |
  "monoMic")` goes straight to the renamed crate kinds.
- [mockApi.ts](<../../src/lib/winaudio/mockApi.ts>): serves the snapshot
  recorded on the maintainer's PC and the crate's plans for it
  ([test-pc.json](<../../src-tauri/fixtures/winaudio/test-pc.json>),
  [plan-stereo.json](<../../src-tauri/fixtures/winaudio/plan-stereo.json>),
  [plan-mono-mic.json](<../../src-tauri/fixtures/winaudio/plan-mono-mic.json>),
  regenerated with the crate's `fix_plan` example), applies changes to a
  copy, reports a change the recording cannot express (hands-free endpoints)
  as failed like the crate, keeps the restore point in memory and records
  every batch.
- [index.ts](<../../src/lib/winaudio/index.ts>): `getWinAudioApi`, the mock
  whenever the engine is mocked (`isMockEngine`), loaded by dynamic import.
- [rows.ts](<../../src/lib/winaudio/rows.ts>): `audioMode(snapshot)` (the
  hands-free profile on means "Mono audio with mic"), `MODE_LABELS`,
  `modeDrift(snapshot, mode)` (plain lines for what the mode's plan would put
  right: in stereo, the headphones not the default or calls playback while
  connected, or a headphone mic as a default; in mono with mic, voice chat
  not on the hands-free endpoints once Windows lists them),
  `winAudioCards(snapshot)` (the three cards; each row has title, sentence,
  `current`, `recommended`, `ok`, `counts`, `admin` and a control that
  yields the `Change`), and `attentionCount(cards, drift)`.

Hooks ([src/hooks/winaudio](<../../src/hooks/winaudio>)), each one job:
[useWinAudioTarget](<../../src/hooks/winaudio/useWinAudioTarget.ts>) (address
from the status, else the remembered headphones; codec from the engine
snapshot), [useWinAudioApi](<../../src/hooks/winaudio/useWinAudioApi.ts>),
[useWinAudioSnapshot](<../../src/hooks/winaudio/useWinAudioSnapshot.ts>)
(read on mount, on window focus and every 10 s; newest read wins),
[useApplyChanges](<../../src/hooks/winaudio/useApplyChanges.ts>) (admin
changes first, then user ones, then refresh; keeps the results),
[usePlanPreview](<../../src/hooks/winaudio/usePlanPreview.ts>) (fetch a
mode's plan, preview, apply exactly it),
[useRestorePoint](<../../src/hooks/winaudio/useRestorePoint.ts>), and
[useWindowsAudioPage](<../../src/hooks/winaudio/useWindowsAudioPage.ts>),
which wires them into the page's view (`noDevice`, `loading`, `ready` with
`mode`, `cards`, `advanced`, the sheets and the outcome).

Components ([src/components/winaudio](<../../src/components/winaudio>)):
[WinAudioSections](<../../src/components/winaudio/WinAudioSections.tsx>)
(composition and the column split),
[AudioModeSwitch](<../../src/components/winaudio/AudioModeSwitch.tsx>)
([AudioModeSwitch.css](<../../src/components/winaudio/AudioModeSwitch.css>);
the two tiles, the status line, Review),
[WinAudioCard](<../../src/components/winaudio/WinAudioCard.tsx>),
[WinAudioSettingRow](<../../src/components/winaudio/WinAudioSettingRow.tsx>)
(value plus switch, "Open", or value alone),
[WinAudioPickerRow](<../../src/components/winaudio/WinAudioPickerRow.tsx>)
(value plus chevron; the row opens an `OptionList` sheet),
[RowText](<../../src/components/winaudio/RowText.tsx>) /
[RowText.css](<../../src/components/winaudio/RowText.css>) (title with
shield, sentence, the trailing value),
[RecommendedNote](<../../src/components/winaudio/RecommendedNote.tsx>)
([RecommendedNote.css](<../../src/components/winaudio/RecommendedNote.css>);
the warning dot and "Recommended: …", text so colour is not the only cue),
[AdminShield](<../../src/components/winaudio/AdminShield.tsx>) (drawn
locally, spoken "needs a Windows permission prompt"),
[WinAudioAdvanced](<../../src/components/winaudio/WinAudioAdvanced.tsx>)
([WinAudioAdvanced.css](<../../src/components/winaudio/WinAudioAdvanced.css>);
the disclosure over the shared `useDisclosure`),
[PlanPreviewSheet](<../../src/components/winaudio/PlanPreviewSheet.tsx>)
("Switch to Stereo audio" / "Switch to Mono audio with mic": exactly the
plan's sentences, a shield on admin items, "Windows will ask for permission
once for the items marked with a shield", the plan's notes; Cancel focused;
"Nothing to change." with only Close),
[RestoreSheet](<../../src/components/winaudio/RestoreSheet.tsx>) and
[ApplyResultNote](<../../src/components/winaudio/ApplyResultNote.tsx>)
(one line per change that did not take, with Windows' reason, else "n changes
applied and checked."). `WinAudioSummary` and `RowStatus` were deleted. The
page is [WindowsAudioPage.tsx](<../../src/pages/WindowsAudioPage.tsx>); with
no remembered headphones it shows a placeholder, and with the headphones not
connected to Windows it still works and says so under the tiles. The rail
entry is in [navPages.ts](<../../src/components/frame/navPages.ts>),
[navStore.ts](<../../src/state/navStore.ts>) and
[AppShell.tsx](<../../src/components/shell/AppShell.tsx>).

Tests: [rows.test.ts](<../../tests/winaudio/rows.test.ts>) (the three cards
and renamed rows in order, live states on the recording, stereo mode with
attention 0, mono with mic when hands-free is on, drift once connected and
attention 4 with enhancements and ducking, a headphone mic as default in
stereo, voice chat off the hands-free endpoints in mono with mic, controls'
changes, the mock's apply) and
[WindowsAudioPage.test.tsx](<../../tests/winaudio/WindowsAudioPage.test.tsx>)
(the current tile is pressed and named in the status line, for both modes;
renamed rows with "Recommended" only where the state differs; shields only
on admin rows; a switch applies its one change and the status line turns to
"Needs attention (1)"; choosing "Mono audio with mic" calls
`fixPreset("monoMic")`, previews the two recorded changes with the prompt
note, applies admin first then user, and the mono tile becomes current;
pressing the current tile does nothing while Review previews the stereo plan;
Restore lives in the closed Advanced disclosure and appears once a restore
point exists; an empty plan offers only Close). The crate's
`fix_kinds_are_stereo_and_mono_mic_and_accept_the_old_names` covers the
renamed kinds.

Screenshots (headless Edge over CDP against the dev server with the mock,
reduced motion so switches are not caught mid-slide):
![Windows audio, dark, 1180 x 760](<screenshots/task31-winaudio-dark.png>),
![Windows audio, light, 1180 x 760](<screenshots/task31-winaudio-light.png>),
![Windows audio, 960 x 620 with the rail collapsed](<screenshots/task31-winaudio-narrow.png>),
![The preview sheet for Mono audio with mic](<screenshots/task31-winaudio-preview-sheet.png>).
Judged: the tiles are equal height and share the card grid's 24 px gutter;
the gold edge and check read in both themes; section labels, row text and
the status line sit on the cards' 16 px text edge; values and controls align
on the right; "Recommended" shows only on adapter power saving (the
recording's one difference). Not verified: the page inside the real Tauri
window against live Windows.
