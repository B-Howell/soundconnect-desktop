# SoundConnect Desktop - Taskbar Icon Measurement (0.1.3)

Date: 2026-10-12. Question: The maintainer installed 0.1.3 himself and the taskbar icon
still looks smaller than Xbox's. Is it drawn smaller, or does it only read
smaller because the dark square blends into the taskbar?

## What is running

- `soundconnect-desktop` PID 57880, started 16:48:46, path
  `%LOCALAPPDATA%\SoundConnect Desktop\soundconnect-desktop.exe`.
- The `FileVersion` string read from the process's mapped image
  (`ReadProcessMemory`) is **0.1.3**: The maintainer's real install. Inside Claude the
  same path reads 0.1.2 on disk, because Claude's MSIX merged view shows the
  older LocalCache copy (see
  [Build Toolchain](<SoundConnect Desktop - Build Toolchain.md>)).
- The window's icon (`WM_GETICON` small/small2, 32 px; no big icon and no
  class icon set) has an alpha bounding box of (0,0)-(31,31): opaque edge to
  edge. So does `ExtractAssociatedIcon` of both the 0.1.3 build and the
  LocalCache 0.1.2 exe.
- [icon.ico](<../../../src-tauri/icons/icon.ico>) frames 16/24/32/48/64 have
  alpha bbox = full frame; 256 is (0,1)-(255,254). Only the rounded corners are
  transparent.

## Taskbar measurement

DPI-aware `CopyFromScreen` of `Shell_TrayWnd` (0,1380)-(5120,1440), button
rectangles from UI Automation. Background (36,61,12); a pixel counts as icon
when any channel differs by more than 12 (25 gives the same result +-1 px).
Crop: (screenshot removed before publication).

| Item | Device-pixel box | Size |
|---|---|---|
| XBOX (running) | x 3068-3097, y 1395-1424 | 30 x 30 |
| Spotify, Hue (pinned) | x 2738-2767 / 3013-3042, y 1395-1424 | 30 x 30 |
| SoundConnect Desktop (pinned, running) | x 3125-3150, y 1397-1422 | 26 x 26 |

The square's fill (20,20,20) differs from the taskbar by 41 in green, so the
26 px box is the real drawn edge, not a contrast artefact.

Pixel match of the 30 px slot against the maintainer's two masters rendered at 30 px on
the same background: old `app-icon-v1.png` mean abs diff **3.2** (visible box
26 x 26), full-bleed `app-icon-fullbleed.png` **14.7** (visible box 30 x 30).

## Verdict

**Drawn smaller, not a contrast problem.** The taskbar is showing the old v1
artwork (83 % fill) from the pinned item, not the 0.1.3 exe's full-bleed icon.
The pin `...\User Pinned\TaskBar\SoundConnect Desktop.lnk` (written 16:28,
before the real install) targets the LocalCache exe
`%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Local\SoundConnect Desktop\soundconnect-desktop.exe`
with `IconLocation ",0"`, and Explorer keeps the pin's cached old bitmap; the
running 0.1.3 window groups into that pin. Fix on the maintainer's side: unpin, then
pin from the running window or from Start (the real install's shortcut).
Secondary: even the full-bleed icon is low-contrast on a dark taskbar (dark
square, thin gold trim), which the candidates below address.

## Candidates (the maintainer's art only, not wired)

Built by [icon-candidates.py](<../../../tools/icon-candidates.py>) from
[app-icon.png](<../../../src-tauri/icons/source/app-icon.png>) by matting,
cropping and scaling only:

- A: the shipped full-bleed square.
- B: [B-headphones-transparent.ico](<../../../src-tauri/icons/candidates/B-headphones-transparent.ico>)
  ([png](<../../../src-tauri/icons/candidates/B-headphones-transparent.png>)):
  the flat (20,20,20) fill connected to the background (tolerance 7) and the
  gold frame removed, cropped to the headphones (master box 66,96-980,928),
  padded square with a 4 % margin.
- C: [C-square-headphones-92.ico](<../../../src-tauri/icons/candidates/C-square-headphones-92.ico>)
  ([png](<../../../src-tauri/icons/candidates/C-square-headphones-92.png>)):
  the square with the headphone layer scaled 1.055x to span 92 % of it; the
  original headphone pixels are first replaced by the square's sampled fill.

Comparison at 256/48/32/16 and the 30 px taskbar slot (x4), with the real
taskbar slots below: (screenshot removed before publication).
Reproduce: `python -I tools/icon-candidates.py 30 <taskbar.png> "Xbox:3068,15" ...`.
