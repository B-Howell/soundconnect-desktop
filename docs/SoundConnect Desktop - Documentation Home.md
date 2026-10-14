---
documentation_hub: true
project: "SoundConnect Desktop"
area: "documentation home"
---

# SoundConnect Desktop - Documentation Home

The single documentation root for SoundConnect Desktop, for humans, Claude and
Codex alike. It links only the major documentation branches; each branch links
the files it explains.

SoundConnect Desktop is an unofficial Windows app that gives the maintainer the Sony
Sound Connect phone-app controls for his WH-1000XM4 on the desktop, with an
iOS-style interface. It does not implement the Sony protocol itself: it loads
the protocol engine (`libmdr`, `libmdr-bt`, MIT) of
[mos9527/SonyHeadphonesClient](https://github.com/mos9527/SonyHeadphonesClient),
pinned as a git submodule, as DLLs inside a Tauri 2 app. Not affiliated with
Sony.

**Status (2026-10-13, 0.1.6):** the app controls the XM4 live: from the window
it reads and changes noise control, volume, the equalizer, DSEE and auto power
off on the maintainer's WH-1000XM4 (every noise change confirmed by the device). It runs
in the tray and can start with Windows. It is a 1180 x 760 Windows app with a
left rail over six pages (Status, Sound, System, Devices, Windows audio,
Settings; since 0.1.8 Equalizer and Noise control are Sound's sub-pages, listed
under it in the rail with a "Sound ›" breadcrumb), including Sony's missing menus (one
22-stop Ambient Sound Control slider, Speak-to-Chat, connection quality,
automatic pause, multipoint, a read-only paired-device list on protocol V1).

0.1.6 adds, since 0.1.5:

- **Dropout fixes.** A frame libmdr cannot parse (the XM4's Speak-to-Chat
  preview notify) is skipped instead of dropping the link. A
  connection-quality change first asks for confirmation (a banner) and the
  app then reconnects by itself, because the headset restarts its links to
  apply it.
- **Equalizer page.** Shows the XM4's recorded preset curves.
- **Windows audio page.** Shows how Windows treats the headphones' sound,
  with "Fix for music", "Fix for calls" and restore (0.1.9 replaced the two
  fixes with a choice between "Stereo audio" and "Mono audio with mic"). Admin changes go through
  a file-less elevated helper.
- **Integration review fixes.** A stale confirmation can no longer apply the
  wrong mode. "Not now" reverts the radio at once. Forgetting another device
  no longer leaves the status on "Reconnecting". The `SetFormat` input is
  checked before any COM call.

Tests: Vitest 299, Rust 101.

**Not verified live:** none of 0.1.6's device-side behaviour. The XM4 stayed
disconnected through two 10-minute polls on 2026-10-13. The release build's
Windows audio page was read with the headphones absent, and nothing was
changed. Details and the checklist are in
[live-0.1.6-verification.md](<core/evidence/live-0.1.6-verification.md>).

`pnpm dist` builds the per-user NSIS installer
`src-tauri/target/release/bundle/nsis/SoundConnect Desktop_0.1.6_x64-setup.exe`
(SHA-256 `4702209836131DBFBEAB54D2B20663D286AE8FA418525F0B2F9D98CE9FC7CFCA`),
which bundles the engine DLLs. The maintainer installs it by double-clicking; the copy
installed now is older (0.1.2). The engine DLLs come from GitHub Actions
(private repo `soundconnect-desktop`) via `tools/fetch-engine.ps1`.

## Branches

- [2026-10-11-soundconnect-desktop.md](<plans/2026-10-11-soundconnect-desktop.md>)
  — the implementation plan: verified facts, decisions, 22 tasks in five
  phases, review protocol (Opus subagents implement, the main session reviews).
- [SoundConnect Desktop - Upstream Security Review](<research/SoundConnect Desktop - Upstream Security Review.md>)
  — what was checked in the upstream source and nightly binary before
  installing it and before adopting its engine; residual risks.
- [SoundConnect Desktop - Product Image Sources](<research/SoundConnect Desktop - Product Image Sources.md>)
  — where each Sony product photo in `public/devices/` came from, its terms
  note, size and transparency.
- [SoundConnect Desktop - Windows Audio Settings Research](<research/SoundConnect Desktop - Windows Audio Settings Research.md>)
  — every Windows setting that changes Bluetooth headphone sound (Hands-Free,
  codec, enhancements, spatial, ducking, absolute volume, defaults, power,
  driver), measured state on the maintainer's PC, APIs and admin needs, and the
  proposed "Windows audio" page with risks and a test plan.
- [upstream-issue-speak-to-chat-preview.md](<research/upstream-issue-speak-to-chat-preview.md>)
  — ready-to-paste upstream issue for libmdr rejecting the XM4's
  Speak-to-Chat preview notify (`f9 05 02 00`); not filed, the maintainer decides.
- [SoundConnect Desktop - Engine Build](<tooling/SoundConnect Desktop - Engine Build.md>)
  — how the upstream engine DLLs are built on GitHub Actions from the pinned
  submodule, the artifact and its hashes, ctest/replay and export evidence,
  struct sizes for the Rust FFI, how to rebuild and fetch, and why CI replaced
  the local VS 2019 build.
- [SoundConnect Desktop - Build Toolchain](<tooling/SoundConnect Desktop - Build Toolchain.md>)
  — the Tauri 2 + React app shell scaffolded from Hue Desktop: what was
  copied and changed, every config file and script, pins, and verification.
- [SoundConnect Desktop - Renderer](<renderer/SoundConnect Desktop - Renderer.md>)
  — the iOS grouped-table visual language, why each design token has its
  value, every UI primitive with its props and accessibility contract, the
  dev-only `?gallery=1` page, screenshots and open design questions.
- [SoundConnect Desktop - Rust Engine Bindings](<engine/SoundConnect Desktop - Rust Engine Bindings.md>)
  — the `mdr-sys` crate transcribed from upstream's C headers (layout and
  export tests against compiler-produced evidence), the safe `mdr` crate
  (Transport trait, C-callback trampolines, Engine lifecycle, Snapshot JSON
  contract for the renderer) and how to run its tests.
- [SoundConnect Desktop - Core Services](<core/SoundConnect Desktop - Core Services.md>)
  — the engine service thread inside the Tauri app (connection state machine,
  16 ms tick, command set, v1/v2 noise normalisation), the Windows RFCOMM
  transport, the `engine:*` window events and Tauri commands, and the live
  first-contact evidence from the maintainer's WH-1000XM4.
- [SoundConnect Desktop - Windows Audio](<core/SoundConnect Desktop - Windows Audio.md>)
  — the `winaudio` crate: what Windows does to the headphones' sound (read
  live, user-level), fix-for-music / fix-for-calls / restore plans, apply with
  read-back, the elevated `--apply-admin` helper, the verified `IPolicyConfig`
  declaration, the restore point and the Tauri commands.
- [SoundConnect Desktop - Testing](<testing/SoundConnect Desktop - Testing.md>)
  — the replay-real-recordings principle, the upstream XM3 capture and the
  values observed from it, the other capture folders and how far each
  replays, and how an XM4 capture is added.

Branches added by the plan as it proceeds: `tooling/` (engine build, toolchain),
`engine/` (Rust bindings), `core/` (Tauri services), `renderer/` (React UI),
`testing/` (captures and replay tests).
