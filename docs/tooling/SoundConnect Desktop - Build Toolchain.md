---
title: "SoundConnect Desktop - Build Toolchain"
date: 2026-10-11
tags: [tooling, build]
project: "SoundConnect Desktop"
area: "tooling"
---

# SoundConnect Desktop - Build Toolchain

The app shell: a Tauri 2 window (Rust core) hosting a React 19 renderer in
WebView2, scaffolded from the maintainer's earlier Hue Desktop project
(`RE-PhilipsHue`) in plan Task 8. The protocol engine crates are not part of it
yet; they join `src-tauri/crates/` once the engine build
([SoundConnect Desktop - Engine Build](<SoundConnect Desktop - Engine Build.md>))
is unblocked.

## What came from Hue Desktop, and what changed

Copied unchanged (same pins, same behaviour):

- Vite, Vitest and TypeScript configuration, the pnpm/Node engine pins.
- `global.css` (reset, focus ring, `.glass`, scrollbars, reduced motion) and
  `motion.ts` (the one spring and the mirrored durations).
- The frameless caption buttons: `WindowControls`, `windowCommands.ts`,
  `useWindowControls`, and the capability file granting the four window
  permissions they call.
- Hooks `useIsTauri`, `useMediaQuery`, `usePrefersReducedMotion`,
  `usePointerDrag`, `useOptimisticValue` (with its pure reducer
  `src/lib/optimistic.ts`), `useRovingTabIndex`. Comments that described Hue
  bridge behaviour were generalised.
- The Tauri icons, as a placeholder; Task 13b replaced them with SoundConnect's
  own icon (see the icons entry below).

Changed for a phone-shaped window:

- **No navigation rail.** Hue's `SideNav`/`NavItem`, the rail tokens and
  `breakpoints.ts` (whose only constant was the rail-expansion width) were
  dropped. `AppFrame` is now the title bar plus one full-bleed scrolling
  content area; Task 13 added an optional footer slot that holds the bottom
  tab bar instead.
- `TitleBar` takes the wordmark as a prop (`SoundConnect`) and lays out
  wordmark / centred title / caption buttons in a `1fr auto 1fr` grid, so a
  title stays centred on the window rather than over a rail.
- Tokens keep Hue's structure, retuned to iOS system colours: grouped
  background `#f2f2f7` / `#000000`, surfaces `#ffffff` / `#1c1c1e`, accent
  system blue `#007aff` light / `#0a84ff` dark. Hue's warm "lamp" bloom and
  its glow token are gone. Task 12 retunes the full set.
- `Icon` holds only the four caption glyphs; Hue's navigation glyphs left with
  the rail.
- New `PlaceholderMessage` component: one centred secondary line, used for
  the scaffold's "Scaffold ready" and reusable for empty states.
- Rust core: no commands yet; registers single-instance (a second launch
  focuses the existing window), window-state (size and position persist) and
  opener. Hue's reqwest / rustls / keyring / tokio stack is not carried over.
- npm: Hue's `@tauri-apps/plugin-autostart` and `tsx` are not installed yet
  (no autostart, no TypeScript tools); the tasks that need them add them at
  Hue's pins (`@tauri-apps/plugin-autostart 2.7.0`). Hue's
  `tsconfig.tools.json` and `record:fixtures` script are dropped for the same
  reason. `zustand` joined at Hue's pin `5.0.15` in Task 13 for the
  navigation store.

## Files

Configuration:

- [package.json](<../../package.json>) — scripts `dev` (tauri dev), `dev:web`
  (Vite only), `build`, `tauri`, `typecheck`, `test`, `test:rust`, `dist`, and
  the exact npm pins.
- [pnpm-lock.yaml](<../../pnpm-lock.yaml>) — lockfile from `pnpm install`.
- [vite.config.ts](<../../vite.config.ts>) — port 1420 with `strictPort` (Tauri
  expects a fixed dev URL), ignores `src-tauri/` so Rust rebuilds do not
  reload the page.
- [vitest.config.ts](<../../vitest.config.ts>) — two projects since Task 12:
  `node` runs `tests/**/*.test.ts`, `dom` runs `tests/**/*.test.tsx` in
  `jsdom` (see [SoundConnect Desktop - Renderer](<../renderer/SoundConnect Desktop - Renderer.md>));
  `passWithNoTests` stays on.
- [tsconfig.json](<../../tsconfig.json>) — strict bundler-mode project for `src`
  and `tests`.
- [tsconfig.node.json](<../../tsconfig.node.json>) — the Vite config's own
  project. It is `composite`, so `pnpm typecheck` writes
  `tsconfig.node.tsbuildinfo`; the root `.gitignore` ignores `*.tsbuildinfo`
  (as Hue's does).
- [vite-env.d.ts](<../../src/vite-env.d.ts>) — pulls in Vite's client types
  (`import.meta.env`, CSS imports) for the renderer project.
- [.gitignore](<../../.gitignore>) — root ignores: dependencies, build output,
  logs, `.env`, engine build folders and `*.tsbuildinfo`.
- [index.html](<../../index.html>) — the WebView entry; declares
  `color-scheme: light dark` so the first paint follows the OS theme.
- [Cargo.toml](<../../src-tauri/Cargo.toml>) — package `soundconnect-desktop`,
  lib `soundconnect_desktop_lib`, exact crate pins, size-optimised release
  profile.
- [Cargo.lock](<../../src-tauri/Cargo.lock>) — resolved Rust dependency graph.
- [tauri.conf.json](<../../src-tauri/tauri.conf.json>) — product name,
  identifier `dev.soundconnect.desktop`, the frameless 420 x 760
  window (min 380 x 600, created hidden and shown by `setup`, see Core
  Services), dev/build hooks into pnpm, and the installer settings (see
  [Installer](#installer)).
- [icons](<../../src-tauri/icons/>) — Windows bundle icons referenced by
  `tauri.conf.json` (`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.ico`,
  `icon.icns`) plus Store logos (`Square*Logo.png`, `StoreLogo.png`),
  `64x64.png` and `icon.png` (512 px). Since 2026-10-12 (round 2) all are
  generated from the full-bleed master
  [app-icon-fullbleed.png](<../../src-tauri/icons/source/app-icon-fullbleed.png>)
  (1024 px) with
  `pnpm tauri icon src-tauri/icons/source/app-icon-fullbleed.png`. It is the
  original master [app-icon.png](<../../src-tauri/icons/source/app-icon.png>)
  (1254 px, about 8 % transparent margin on each side) cropped with PIL to the
  rounded square's alpha bounds (alpha > 128: `(105, 106, 1149, 1140)`),
  padded to square, resized to 1024 and with alpha < 16 cleared, so the
  rounded square, corners kept, touches the canvas edges like other Windows
  app icons (the maintainer: "too small compared to the Xbox icon"). Every frame of
  `icon.ico` is now opaque edge to edge (alpha bbox = full frame). `icon.ico` holds
  16 / 24 / 32 / 48 / 64 / 256 px frames. The generator also writes
  `android/` and `ios/` folders: delete them after every run (Windows-only
  app). After regenerating, touch `src-tauri/build.rs` (or change any Rust
  file) before `tools/dev.ps1`, because cargo does not notice the new icons
  and keeps the old one embedded in the exe. The dev browser tab uses a copy,
  [public/icon.png](<../../public/icon.png>), linked from
  [index.html](<../../index.html>). Design notes and the small-size
  follow-up are in
  [SoundConnect Desktop - Renderer](<../renderer/SoundConnect Desktop - Renderer.md>)
  (Brand).
- [default.json](<../../src-tauri/capabilities/default.json>) — window
  permissions for dragging, minimize, toggle-maximize and close, plus
  `autostart:default` (Task 21).
- [build.rs](<../../src-tauri/build.rs>) — `tauri_build::build()`, after
  checking that the two engine DLLs the installer bundles exist and
  generating `gen/THIRD-PARTY-LICENSES.txt` (see [Installer](#installer)).
- [.gitignore](<../../src-tauri/.gitignore>) — ignores `target/`, the
  generated capability schemas and the generated licence file.

Rust entry points:

- [main.rs](<../../src-tauri/src/main.rs>) — calls `run()`; hides the console
  window in release builds.
- [lib.rs](<../../src-tauri/src/lib.rs>) — builder with single-instance
  (registered first so a second launch exits before touching state),
  window-state and opener.

Scripts:

- [dev.ps1](<../../tools/dev.ps1>) — prepends `%USERPROFILE%\.cargo\bin` to
  `PATH` (older shells otherwise fail with "cargo metadata ... program not
  found") and runs `pnpm dev`.
- [dev-web.ps1](<../../tools/dev-web.ps1>) — sets `VITE_MOCK_ENGINE=1` and runs
  `pnpm dev:web` for browser review at `http://localhost:1420`; the variable is
  consumed from Task 11.

Renderer shell:

- [main.tsx](<../../src/main.tsx>) and [App.tsx](<../../src/App.tsx>) — mount
  the app; `App` renders the app shell (or the dev gallery inside `AppFrame`)
  under one `MotionConfig` (reduced motion follows the OS). The shell's
  components are described in [SoundConnect Desktop - Renderer](<../renderer/SoundConnect Desktop - Renderer.md>).
- [AppFrame.tsx](<../../src/components/frame/AppFrame.tsx>) — title bar plus
  scrolling content plus an optional bottom footer (the tab bar); the page is
  a flex column so `flex: 1` children fill it.
  [AppFrame.css](<../../src/components/frame/AppFrame.css>) — the two-row grid,
  the absolutely positioned scroller, page gutters, and the footer overlay
  with the page's `--tabbar-reserve` bottom padding.
  [PageTransition.tsx](<../../src/components/frame/PageTransition.tsx>) —
  replaced the old CSS page-enter fade in Task 13: framer-motion
  `AnimatePresence` cross-fades pages with an 8 px spring slide, keeping the
  leaving page inert. [PageTransition.css](<../../src/components/frame/PageTransition.css>)
  — stacks the two pages absolutely during a swap.
- [TitleBar.tsx](<../../src/components/frame/TitleBar.tsx>) — 40 px drag strip;
  caption buttons render only inside Tauri.
  [TitleBar.css](<../../src/components/frame/TitleBar.css>) — the
  `1fr auto 1fr` wordmark / title / controls grid; text ignores the pointer so
  the strip stays draggable.
- [WindowControls.tsx](<../../src/components/frame/WindowControls.tsx>) and
  [windowCommands.ts](<../../src/components/frame/windowCommands.ts>) —
  Windows 11 caption buttons; failures are reported, not thrown.
  [WindowControls.css](<../../src/components/frame/WindowControls.css>) —
  46 x 40 hit targets, hover/active fills, red close hover.
- [Icon.tsx](<../../src/components/icons/Icon.tsx>) — inline SVG glyphs.
- [PlaceholderMessage.tsx](<../../src/components/page/PlaceholderMessage.tsx>)
  — one centred quiet line.
  [PlaceholderMessage.css](<../../src/components/page/PlaceholderMessage.css>)
  — `flex: 1` plus grid centring so the line sits in the middle of the page.
- [tokens.css](<../../src/styles/tokens.css>),
  [global.css](<../../src/styles/global.css>),
  [motion.ts](<../../src/styles/motion.ts>) — design tokens, base styles, spring.
- Hooks: [useIsTauri](<../../src/hooks/useIsTauri.ts>),
  [useMediaQuery](<../../src/hooks/useMediaQuery.ts>),
  [usePrefersReducedMotion](<../../src/hooks/usePrefersReducedMotion.ts>),
  [useWindowControls](<../../src/hooks/useWindowControls.ts>),
  [useOptimisticValue](<../../src/hooks/useOptimisticValue.ts>) over
  [optimistic.ts](<../../src/lib/optimistic.ts>),
  [usePointerDrag](<../../src/hooks/usePointerDrag.ts>),
  [useRovingTabIndex](<../../src/hooks/useRovingTabIndex.ts>).

Tests (copied from Hue, imports unchanged in shape):

- [windowCommands.test.ts](<../../tests/renderer/windowCommands.test.ts>) —
  each caption click reaches the window; a rejected call is reported.
- [useOptimisticValue.test.ts](<../../tests/renderer/useOptimisticValue.test.ts>)
  — hold, confirm, expire and custom-equality rules.
- [rovingTabIndex.test.ts](<../../tests/renderer/rovingTabIndex.test.ts>) —
  arrow/Home/End index maths and clamping (Hue's wheel and scroll-edge cases
  dropped with those hooks).

## Installer

Plan Task 21. `pnpm dist` (= `tauri build`) runs `pnpm build`, builds the
release exe (LTO, about 3.5 min from clean) and makes one NSIS installer.

`tauri.conf.json` `bundle`:

- `"targets": ["nsis"]` (no MSI, no WiX);
- `"windows": { "nsis": { "installMode": "currentUser" } }`: no admin
  prompt, installed under the user's profile, uninstall metadata under `HKCU`;
- `"resources"` maps `../engine/bin/RelWithDebInfo/mdr-shared.dll` and
  `mdr-bt-shared.dll` to the resource dir root, which for NSIS is the install
  dir next to the exe, where Windows' loader finds them (mechanism and proof
  in [Core Services](<../core/SoundConnect Desktop - Core Services.md#engine-dlls-at-run-time>));
- `"licenseFile": "gen/THIRD-PARTY-LICENSES.txt"`: the installer's licence
  page. `build.rs` writes it on every build from upstream's `LICENSE` (MIT)
  with a header naming the two DLLs, the upstream URL and the commit in
  `engine/bin/RelWithDebInfo/UPSTREAM_COMMIT.txt`, plus the Sony disclaimer;
  it is generated, so it is git-ignored;
- the icons were already set (Task 13b).

Prerequisite: the DLLs from `tools/fetch-engine.ps1`. The check in
`build.rs` runs on every cargo build of the app (`cargo test`, clippy,
`tauri dev` too), deliberately: `mdr-sys` cannot link without the DLLs
anyway, and the upstream submodule must be checked out for the licence. GitHub keeps the CI
artifact only for its retention period (see
[Engine Build](<SoundConnect Desktop - Engine Build.md>)); if it has expired,
rerun the workflow first. Without them `build.rs` stops with "missing
../engine/bin/RelWithDebInfo/mdr-shared.dll ... run tools/fetch-engine.ps1
first". The first `pnpm dist` on a machine also downloads NSIS 3.11 and
`nsis_tauri_utils.dll` from Tauri's GitHub releases (the bundler checks their
hashes).

Output of the 2026-10-12 build:

- `src-tauri\target\release\bundle\nsis\SoundConnect Desktop_0.1.0_x64-setup.exe`,
  2,109,482 bytes, SHA-256
  `4D2EBE2C40B00A34E7DB830360E3ACFA6C7D06CC879CFC94258BCD7463C8CEB0`
  (the build after the review fixes; the first build was 2,110,440 bytes,
  `4E9A8A0E...93925067`). The hash changes with every code change; the
  build is not reproducible byte for byte across commits.
- Silent install, `"SoundConnect Desktop_0.1.0_x64-setup.exe" /S`: exit 0,
  installed to `%LOCALAPPDATA%\SoundConnect Desktop\`
  (`%LOCALAPPDATA%\<productName>`, not `Programs\`) with
  `soundconnect-desktop.exe` (5,296,640 bytes), `mdr-shared.dll`,
  `mdr-bt-shared.dll` and `uninstall.exe`.
- Apps & Features entry, `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\SoundConnect Desktop`:
  `DisplayName SoundConnect Desktop`, `DisplayVersion 0.1.0`,
  `Publisher` (the second segment of the identifier), `InstallLocation "%LOCALAPPDATA%\SoundConnect Desktop"`,
  `UninstallString "%LOCALAPPDATA%\SoundConnect Desktop\uninstall.exe"`.
- Installing again over an existing install (`/S`) replaced it in place.
- Uninstall: Apps & Features, or `uninstall.exe` (`/S` for silent). Not run
  on 2026-10-12; the build was left installed. Switch Start with Windows off
  first: the uninstaller does not remove the autostart `Run` value. Settings live separately in
  `%APPDATA%\dev.soundconnect.desktop\` (`settings.json`, and the window state after a normal exit)
  and the WebView's data under
  `%LOCALAPPDATA%\dev.soundconnect.desktop\`.

Known overlap: the debug snapshot dump (`SOUNDCONNECT_DUMP_SNAPSHOT=1`)
writes `last-snapshot.json` to `%LOCALAPPDATA%\SoundConnect Desktop\`, which
is also the install dir; harmless, but the dump would be better under the
app's data dir.

The running installed app loaded both DLLs from its install dir (process
modules), wrote `settings.json`, showed its tray icon and hid to the tray on
close; see [Core Services](<../core/SoundConnect Desktop - Core Services.md#verification-2026-10-12-installed-build>).

## Pins

Cargo: `tauri =2.12.3` (`tray-icon`), `tauri-build =2.7.2`,
`tauri-plugin-opener =2.7.1`, `tauri-plugin-single-instance =2.5.3`,
`tauri-plugin-window-state =2.5.0`, `tauri-plugin-autostart =2.7.0` (Task 21),
`tauri-plugin-updater =2.13.3`, `tauri-plugin-process =2.4.0` (0.1.9; the
newest 2.x a few days old, 2.14.0 was hours old),
`serde =1.0.229` (`derive`),
`serde_json =1.0.153`, `thiserror =2.0.21`.

npm: `@tauri-apps/api 2.12.3`, `@tauri-apps/cli 2.12.2`, `react` /
`react-dom 19.3.0`, `framer-motion 14.1.0`, `vite 8.3.4`, `vitest 5.0.3`,
`typescript 7.0.2`, `@vitejs/plugin-react 6.1.2`, `@types/react` /
`@types/react-dom 19.3.0`, `@types/node 24.19.2`, `zustand 5.0.15` (since
Task 13), `@tauri-apps/plugin-autostart 2.7.0` (Task 21, Hue's pin),
`@tauri-apps/plugin-updater 2.13.3` and `@tauri-apps/plugin-process 2.4.0`
(0.1.9, matching the crates);
test-only since Task 12:
`@testing-library/react 16.3.3`, `@testing-library/dom 10.4.2`,
`@testing-library/user-event 14.6.7`, `@testing-library/jest-dom 7.0.1`,
`jsdom 30.1.2`; `packageManager
pnpm@10.32.1`, `engines.node >=24.11`.

Machine toolchain (2026-10-11): rustup stable (rustc 1.99), MSVC 14.29 linker,
Node 24.20, pnpm 10.32.1, WebView2 runtime.

## Verification (2026-10-11)

- `pnpm install`: `Packages: +53` ... `Done in 1.4s using pnpm v10.32.1`.
- `pnpm typecheck`: `tsc --noEmit && tsc -p tsconfig.node.json --noEmit`,
  exit 0, no diagnostics.
- `pnpm test`: `Test Files  3 passed (3)`, `Tests  18 passed (18)`.
- `cargo check --manifest-path src-tauri/Cargo.toml` (first run, crates
  downloaded): `Finished \`dev\` profile [unoptimized + debuginfo] target(s) in 45.37s`,
  no warnings.
- `tools/dev-web.ps1`: `VITE v8.3.4  ready in 655 ms`, `Local: http://localhost:1420/`.
  Measured in the Browser pane at 420 x 760: title bar 40 px, wordmark box
  centred on it (top 11, height 19), wordmark inset 16 px to match the content
  gutter; "Scaffold ready" horizontally centred (text centre x = 210 of 420),
  vertical centre y = 388 (8 px below the window's centre because the page's
  bottom padding is larger than its top). Light background `rgb(242, 242, 247)`;
  dark renders on `#000000` with the grey secondary text.
- `tools/dev.ps1`: `Finished \`dev\` profile ... in 56.03s`,
  `Running \`target\debug\soundconnect-desktop.exe\``; `Get-Process` found
  `soundconnect-desktop` with `MainWindowTitle 'SoundConnect Desktop'`, client
  area 525 x 950 physical px at 120 DPI (= 420 x 760 logical), frameless, with
  the three caption buttons drawn. Caption-button behaviour was confirmed by
  code review (`WindowControls` calls `minimize` / `toggleMaximize` / `close`,
  all granted in `capabilities/default.json`), not by clicking.

Screenshots: (screenshot removed before publication)
(light) and (screenshot removed before publication)
(dark), both at 420 x 760 in the Browser pane;
(screenshot removed before publication)
is the native window (OS in dark mode) captured with `PrintWindow`.

## Release 0.1.2 (2026-10-12, round 2)

Version `0.1.2` in [tauri.conf.json](<../../src-tauri/tauri.conf.json>) and
[package.json](<../../package.json>). `pnpm dist` produced
`src-tauri\target\release\bundle\nsis\SoundConnect Desktop_0.1.2_x64-setup.exe`,
7,259,520 bytes, SHA-256
`C98292421B0DC68225CB5CF0DE058B4AE27E0050F971B415EF7089DE5D54E1ED` (the
installer grew from about 2 MB because the renderer now bundles the product
images in `public/devices/`). Silent install (`/S`): exit 0, `FileVersion
0.1.2`; Start Menu shortcut `%APPDATA%\Microsoft\Windows\Start Menu\Programs\SoundConnect Desktop.lnk`
(Start Menu root, icon from the exe), `Get-StartApps` lists
`SoundConnect Desktop` with AppID `dev.soundconnect.desktop` (the
NSIS template sets the shortcut's AppUserModelID to the bundle identifier).

Release 0.1.3 (2026-10-12, round 3): The maintainer's new master `Gold-Trimmed Headphone App Icon (1).png` (1048 x 1038 RGBA, about 2 px transparent margin) became [app-icon.png](<../../src-tauri/icons/source/app-icon.png>), the old one kept as [app-icon-v1.png](<../../src-tauri/icons/source/app-icon-v1.png>); its visible pixels are identical to the old master cropped at `(103, 104, 1151, 1142)`, so the regenerated full-bleed master and icon set are unchanged. `pnpm dist` produced `SoundConnect Desktop_0.1.3_x64-setup.exe`, 7,334,931 bytes, SHA-256 `8151B09A57CD1B4B625AFC8AF90FFF058B505999CE8A5305239435C3F8999811`; not installed from Claude (the maintainer double-clicks it, see below).

Release 0.1.4 (2026-10-12): the remembered-device card showed the Bluetooth address instead of the model (0.1.3 stored the address as the profile `name`; see Core Services "Remembered profiles" and the Renderer's `rememberedTitle`). `pnpm dist` produced `SoundConnect Desktop_0.1.4_x64-setup.exe`, 7,336,126 bytes, SHA-256 `8DC554C54FBD2FCC93C01985B944A534C926FEE5E3885544B42E6E8D1ED47AE0`; not installed from Claude. Not verified live: the XM4 was not connected to Windows at build time.

### Windows Search and the taskbar icon: installing from inside Claude

The maintainer saw the app's icon on the taskbar but not in Windows Search. Findings:

- The Claude desktop app is an MSIX package (`Claude_pzs8sxrjxfjjc`). A process
  started from it (an agent's shell, and so the NSIS installer it runs) has its
  writes to `%LOCALAPPDATA%` redirected to
  `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Local\`. The 0.1.2
  exe exists physically only there (checked: the LocalCache copy has
  `FileVersion 0.1.2`); inside Claude the real path shows it through the
  merged view, outside Claude it does not exist. The shortcuts on the Desktop
  and in the Start Menu are written to the real folders.
- The 0.1.1 Start Menu shortcut's target was the LocalCache path itself; the
  0.1.2 one points at the logical `%LOCALAPPDATA%\SoundConnect Desktop\...`,
  which only exists inside Claude. The Windows Search index
  (`Search.CollatorDSO`, `System.FileName LIKE 'SoundConnect%'`) holds the
  Desktop shortcut only.
- An app installed by an agent therefore never looks right in Search or
  Start. The fix is to **run the installer outside Claude**: double-click
  `SoundConnect Desktop_0.1.2_x64-setup.exe` in Explorer once (an agent may
  not start it outside the package; a scheduled-task launch was refused). That
  writes the real `%LOCALAPPDATA%\SoundConnect Desktop\` and rewrites both
  shortcuts. Unpin and re-pin the taskbar item afterwards: the old pin points
  at the LocalCache exe and Explorer keeps that pin's cached (pre-full-bleed)
  icon; `ie4uinit.exe -show` did not refresh it.
- Tried and reverted: setting the process AppUserModelID to the bundle
  identifier (`SetCurrentProcessExplicitAppUserModelID`). With it the taskbar
  took the running window's icon from the Start Menu shortcut with the same
  AppID and, with that shortcut's target unreadable, showed a generic window
  icon. Without it, the window groups by exe path and shows the exe's icon.

Icon check (DPI-aware `CopyFromScreen` of the taskbar, 5120 x 1440): the
running app groups with the maintainer's pinned item, drawn about 25 px against the
Xbox icon's 30 px. That pinned item still shows the cached old icon (25 / 30
matches the old master's 83 % fill); the exe's own icon
(`ExtractAssociatedIcon`, 32 px) is opaque edge to edge. Re-pinning after a
real install shows the full-bleed icon.

After the maintainer's own 0.1.3 install the pin still drew the old artwork (26 px
against Xbox's 30 px; the pin targets the LocalCache exe). Measurement,
verdict and maintainer-art-only candidates: [Taskbar Icon Measurement](<evidence/taskbar-icon-measurement.md>).

## CI

[ci.yml](<../../.github/workflows/ci.yml>) runs on every push and pull
request: job `web` (Ubuntu: checkout with the upstream submodule, because
`src/lib/licenses.ts` inlines its `LICENSE`; `pnpm install --frozen-lockfile`,
`pnpm typecheck`, `pnpm test`) and job `rust` (Windows: checkout with the upstream submodule,
download the `engine-win-x64` artifact of the latest successful
[engine.yml](<../../.github/workflows/engine.yml>) run for the branch, else
for any branch, and check its `UPSTREAM_COMMIT.txt` against the submodule;
`pnpm build`; `cargo fmt --check`, `cargo clippy -D warnings`,
`cargo test --workspace`). The engine is not rebuilt in CI; when the
artifact has expired (90 days), rerun `engine.yml`.

## Releases

[release.yml](<../../.github/workflows/release.yml>) runs when a tag `v*` is
pushed. It first checks that the tag equals the version in `package.json` and
`src-tauri/tauri.conf.json` and that [CHANGELOG.md](<../../CHANGELOG.md>) has
a `## <version>` section. It then
builds the engine DLLs in the job with the same configure, build and ctest
steps as `engine.yml` (so a release never depends on an expired artifact),
places them in `engine/bin/RelWithDebInfo` with `UPSTREAM_COMMIT.txt` so
`build.rs` writes the installer's licence page, runs `pnpm typecheck`,
`pnpm test` and `pnpm dist`, and publishes a GitHub Release with
`gh release create --verify-tag`. Assets (since 0.1.9):

- `SoundConnect-Desktop-Setup.exe`: a fixed-name copy of the installer, so
  `https://github.com/B-Howell/soundconnect-desktop/releases/latest/download/SoundConnect-Desktop-Setup.exe`
  (the README's Download link) always fetches the newest one.
- `SoundConnect.Desktop_<version>_x64-setup.exe` (staged with GitHub's
  dotted name, so `SHA256SUMS.txt` and the URL agree; 0.1.8 and earlier
  listed it with a space) and its `.sig`.
- `latest.json`, the updater manifest: `version`, `notes` (the changelog
  section), `pub_date`, and `platforms.windows-x86_64.{signature, url}` (the
  `.sig` contents and the versioned installer's download URL).
- `engine-dlls-<upstream-short-sha>.zip` (both DLLs, their import libraries,
  the `dumpbin /EXPORTS` listings, `UPSTREAM_COMMIT.txt` and upstream's MIT
  `LICENSE`, which redistribution requires) and `SHA256SUMS.txt` over all of
  the above.

The release body comes from [release-notes.ps1](<../../tools/release-notes.ps1>):
"Install (Windows 10/11)" with three numbered steps for an ordinary user
(download the fixed-name installer, get past SmartScreen with More info / Run
anyway, open it from Start and follow the wizard), "What's new" (the
changelog section), "For developers" (versioned installer, engine zip,
checksums) and "Not affiliated with Sony." The maintainer asked for this on
2026-10-14 because the old body (the changelog alone) did not tell an
average user what to download. The same script re-wrote the v0.1.8 body by
hand (`gh release edit v0.1.8 --notes-file ...`), and a fixed-name copy of
the 0.1.8 installer was uploaded to it so the latest-download link worked
before 0.1.9 published.

### Updater signing

`pnpm dist` signs the installer for the in-app updater
(`bundle.createUpdaterArtifacts` in `tauri.conf.json`) when
`TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` are set;
the release job passes both from repository secrets of those names. Without
them a local `pnpm dist` fails at the signing step, so set them for a local
release build too (`$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content <key> -Raw`).
The key pair was made on 2026-10-14 with `pnpm tauri signer generate` into
`%APPDATA%\soundconnect-signing\` on the maintainer's PC (`soundconnect.key`,
`soundconnect.key.pub`, and the password in `PASSWORD.txt`), outside the
repository; `.gitignore` ignores `*.key` and `*.key.pub` in case one is
copied in. The password sits beside the key only because the setup asked
for it there; moving it into a password manager (and deleting
`PASSWORD.txt`) keeps a copied folder from being enough to sign. **Back up
the key and the password** (offline, two places): without the
private key and its password no later release can be signed with a key the
installed apps accept, so every user would have to reinstall by hand. Key
rotation is in Core Services, Updates.
Only `contents: write` is granted, and only the built-in token is used. The
release flow is: bump the version in both files, move the "Unreleased"
changelog lines under the new version, commit, tag, push the tag.

## Going public

Public-facing files: [README.md](<../../README.md>) (screenshots in
`docs/readme/`, credits to mos9527 and the SonyHeadphonesClient contributors,
Plutoberth, Andreas Olofsson's libmdr and REA, the Sony disclaimer),
[CONTRIBUTING.md](<../../CONTRIBUTING.md>) (commands, replay-real-recordings
rule, capture recording, scrub rule, docs contract, PR expectations) and
[CHANGELOG.md](<../../CHANGELOG.md>). The README screenshots
(`docs/readme/soundconnect-*-dark.png`) were taken on 2026-10-14 with headless
Edge over CDP against `pnpm dev:web` with `VITE_MOCK_ENGINE=1`, 1180 x 760 at
2x, dark; retake them the same way when the pages change.

The repository stays private until the maintainer decides. Checklist:

1. **Backup.** Before any history rewrite, `git bundle create --all` was
   written on 2026-10-14 (at `3abfadf`) to
   `%USERPROFILE%\Documents\Projects\RE-SoundConnect-prepublic-backup.bundle`,
   SHA-256 `d6e5c8eb38baba2633bc20dbe381aac3515a05d3886d0a1d6ee2b31b268e50e0`
   (`git bundle verify` passed). It stays outside the repository.
2. **History.** The fixtures and docs were scrubbed on 2026-10-12 (commit
   `dd13685`) and again on 2026-10-14, but earlier commits still contain the
   paired-device names and addresses, the track metadata, the Windows user
   path and the headset's address. Publish a fresh history (squash to one
   commit, or `git filter-repo` replacing those strings) rather than the
   current one.
3. **Scrub state of the tracked tree (2026-10-14).** A grep for the real
   device and PC names, track titles, Windows user name and path, e-mail,
   non-headset MACs and tokens finds nothing (keep that pattern list outside
   the repository so the check itself leaks nothing). Absolute user paths in
   docs read `%USERPROFILE%` or `<repo>`. Everywhere, including the
   raw evidence logs under `docs/*/evidence/`, docs, examples, tests, the
   Windows audio fixtures and the recorded `CONNECT_RET_CAPABILITY_INFO` frame
   (whose checksum was recomputed), the headset's address is the placeholder
   `AA:BB:CC:12:34:56`. The PC-name check in
   `crates/winaudio/tests/plans.rs` compares against `COMPUTERNAME` instead of
   naming the PC.
4. **Licence text in the app**: done; the Settings licences sheet says the
   app is MIT ([LICENSE](<../../LICENSE>)), and the installer's licence page
   carries upstream's MIT text (checked in `src-tauri/gen/THIRD-PARTY-LICENSES.txt`).
5. **Product images**: Sony's images in `public/devices/` are used to identify
   the user's device (stated in the README); confirm that is acceptable
   before publishing, or ship without them.
6. **Releases**: tag `v<version>` to run `release.yml`; the installer is
   unsigned, so SmartScreen will warn (the README says so).
7. **Settings**: enable the `ci.yml`, `engine.yml` and `release.yml`
   workflows, branch protection on `main`, and make sure no secrets are in
   Actions.
8. **Name**: "SoundConnect" echoes Sony's app name; consider whether to keep
   it.
