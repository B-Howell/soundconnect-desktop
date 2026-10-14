# SoundConnect Desktop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. **Every implementer and every reviewer subagent runs with `model: "opus"`.** The main session only writes task briefs, verifies the subagent's quoted contracts against the real files, runs the checks listed under each task, and decides pass/fail. (The maintainer's instruction, 2026-10-11: "Make sure that opus agents are doing the work and you are just reviewing to save on usage.")

**Goal:** An elegant, iOS-feeling Windows desktop app that controls the maintainer's Sony WH-1000XM4 the way the Sound Connect phone app does, replacing the rough ImGui interface of mos9527/SonyHeadphonesClient while reusing its proven protocol engine.

**Architecture:** A Tauri 2 app, structured like Hue Desktop (the sibling RE-PhilipsHue repository). The Rust core loads two DLLs built from the pinned upstream commit, `mdr-shared.dll` (protocol state machine, C ABI in `mdr-c/*.h`) and `mdr-bt-shared.dll` (Windows RFCOMM transport), through a hand-written `mdr-sys` FFI crate and a safe `mdr` wrapper. One engine thread owns the connection, polls the engine every 16 ms, publishes a JSON **snapshot** of all device state to the renderer over a Tauri event, and applies renderer commands through the engine's `Set*` + `RequestCommit` calls. The React 19 renderer (WebView2) renders iOS-style cards, segmented controls, sliders and sheets from the snapshot, with a mock mode that replays a recorded snapshot so the UI runs in a plain browser for design review. No Sony protocol code is written in this repo; all protocol knowledge stays in upstream libmdr.

**Tech Stack:** Tauri 2.12 (Rust stable 1.99, MSVC, WebView2), serde/serde_json, crossbeam-channel; upstream `libmdr`/`libmdr-bt` at commit `4c91fe69711ce638a34e066d9bdcfaff504bbec8` built with CMake 4.4.4 + MSVC; Vite 8 + React 19 + strict TypeScript, zustand, framer-motion, vitest; pnpm 10; Node 24.

---

## Verified facts this plan depends on (observed 2026-10-11)

Quote these; do not re-derive them. Anything labelled **inference** must be confirmed against a real artifact before code relies on it.

**Upstream engine (clone at `upstream/SonyHeadphonesClient`, commit `4c91fe6`, branch `v1-compat`)**
- `libmdr/include/mdr-c/Base.h`: `#define MDR_ABI_VERSION 2u`; results `MDR_RESULT_OK 0`, `MDR_RESULT_INPROGRESS 1`, `MDR_RESULT_ERROR_GENERAL 2`, `..._NOT_FOUND 3`, `..._TIMEOUT 4`, `..._NET 5`, `..._NO_CONNECTION 6`, `..._BAD_ADDRESS 7`, `..._NOT_SUPPORTED 8`, `..._BUFFER_TOO_SMALL 9`, `..._MALFORMED_PAYLOAD 10`, `..._INVALID_ARGUMENT 11`, `..._ABI_MISMATCH 12`. Service UUIDs: `MDR_SERVICE_UUID_XM5 "956C7B26-D49A-4BA8-B03F-B17D393CB6E2"`, `MDR_SERVICE_UUID_LEGACY "96CC203E-5068-46AD-B32D-E316F5E069BA"`. `MDR_API` is `__declspec(dllimport)` when `MDR_USING_SHARED` is defined; exported names are plain C (`extern "C"`), no mangling.
- `libmdr/include/mdr-c/Connection.h`: `MDRConnection` is a struct of a `void* user` followed by function pointers `connect, disconnect, recv, send, poll, getDevicesList, freeDevicesList, getLastError` (order as in `tests/Replay.cpp`'s aggregate initialiser: `this, Connect, Disconnect, Receive, Send, Poll, GetDevices, FreeDevices, GetLastError`). `MDRDeviceInfo` has a MAC string and a name (read the exact fields from the header in Task 4; **do not guess**). Exported helpers: `mdrConnectionConnect(conn, mac, uuid)`, `mdrConnectionDisconnect`, `mdrConnectionRecv`, `mdrConnectionSend`, `mdrConnectionPoll(conn, timeoutMs)`, `mdrConnectionGetDevicesList(conn, &list, &count)`, `mdrConnectionFreeDevicesList`, `mdrConnectionGetLastError`.
- `libmdr-bt/include/mdr-bt/ConnectionWindows.h`: `mdrConnectionWindowsCreate() -> MDRConnectionWindows*`, `mdrConnectionWindowsGet(w) -> MDRConnection*`, `mdrConnectionWindowsDestroy(w)`. The Windows transport enumerates **connected** classic devices only (`fReturnConnected = 1`, `ConnectionWindows.cpp:242-249`); the headphones must already be connected to Windows audio.
- `libmdr/include/mdr-c/Headphones.h` lifecycle (quoted from its doc comments): `mdrHeadphonesCreate(MDR_ABI_VERSION, conn, protocolVersion, &out)` requires an already-connected `MDRConnection`; `mdrHeadphonesRequestInit` "MUST be called prior to other operations"; `mdrHeadphonesPoll(h, &event)` "Processes pending I/O without blocking and reports one semantic event. MDR_EVENT_NONE is returned when no command was received"; `mdrHeadphonesIsReady` is false while a request is in flight and then `Set*`/`Request*` return `MDR_RESULT_INPROGRESS`; `mdrHeadphonesRequestCommit` applies pending `Set*` changes ("You may call this function at the end of your frame/event loop"); after `MDR_EVENT_NEED_SYNC`, call `mdrHeadphonesRequestSync` once ready and keep polling until `MDR_EVENT_SYNC_COMPLETE`. All enums are `uint32_t` typedefs with `#define` values; all structs are plain C with fixed layout for ABI 2. The full struct list is in the header (MDRModel, MDRBattery, MDRPlayback, MDRNoiseControl, MDRSpeakToChat, MDRListening, MDREqualizer, MDRPairedDevice, MDRPairing, MDRGeneralSettingInfo, MDRGeneralSetting, MDRAssignableControl, MDRPower, MDRVoiceGuidance, MDRConnectionMode, MDRSafeListening). `MDRPairedDevice` contains `char macAddress[18]; char name[128];`.
- Reference driver loop: `client/Client.cpp:1273-1320` (connection poll -> `mdrHeadphonesCreate` -> `SetPacketCallback` -> `RequestInit`) and `client/Client.cpp:2250-2312` (`mdrHeadphonesPoll` then a `switch (event)` that re-reads only the changed state: `MDR_EVENT_INITIALIZE_COMPLETE` -> `RequestSync`; `IDENTITY_CHANGED` -> `GetModel`; `BATTERY_CHANGED` -> `GetBatteries`; `NOISE_CONTROL_CHANGED` -> `GetNoiseControl`; `EQUALIZER_CHANGED` -> `GetEqualizer` + `GetEqualizerBands`; `SYNC_COMPLETE` -> refresh everything; `ALERT` -> `GetText(MDR_TEXT_LAST_ALERT)`; `NEED_SYNC` -> set pending flag). Connection attempt order for an unknown device: `{MDR_SERVICE_UUID_XM5, MDR_SERVICE_UUID_LEGACY}` (`Client.cpp:1064`); protocol version is `MDR_PROTOCOL_V1` when the legacy UUID connected (`Client.cpp:1009-1017`).
- Build: `cmake_minimum_required(VERSION 3.31)`; options `MDR_BUILD_CLIENT`, `MDR_BUILD_SHARED` (default on where supported), `MDR_ENABLE_CODEGEN` (needs LLVM; pass `OFF` to use checked-in generated sources), `BUILD_TESTING` (needs `MDR_BUILD_SHARED=ON`), `MDR_STATIC_CRT` (default ON, `/MT`). Shared targets: `mdr_shared` -> `mdr-shared.dll`, `mdr-bt_shared` -> `mdr-bt-shared.dll`, both compiled with `MDR_BUILDING_SHARED`. Upstream CI builds with `-DMDR_ENABLE_CODEGEN=OFF -DMDR_CLIENT_DEBUGGER=ON -DMDR_ENABLE_LOG=ON` on `windows-latest` (VS 2022). The code uses `std::ranges` (7 files), coroutines (4) and `std::span` (3); **inference:** MSVC 14.29 (VS 2019 16.11) may compile it; if not, install VS 2022 Build Tools (Task 2 has the fallback).
- Replay harness: `tests/Replay.cpp` feeds the concatenated `*-rx.*.bin` files of a capture directory through a `MockTransport` whose `Receive` returns bytes until exhausted then `MDR_RESULT_INPROGRESS`, and whose `Send` just records TX bytes. Capture file names carry the ordinal, direction, frame type, sequence and command, for example `mdr-packet-1791485921245-000001-rx.type-DATA_MDR-0c.seq-00.cmd-CONNECT_RET_PROTOCOL_INFO-01.bin`. `tests/WH-1000XM3-4.5.2/` holds 187 rx files from a real XM3 (same v1 protocol family as the XM4). Captures are recorded with `SonyHeadphonesClient.exe --record <folder>` and scrubbed with `tooling/scrub-capture.py`.
- XM3 feature table (`docs/device-support/WH-1000XM3.md`) for the v1 family: supported = battery, codec, volume, play/pause, NC/AMB mode, ambient level, EQ preset, DSEE, touch panel on/off, voice guidance on/off, auto power off; "supported officially, pending implementation" = NC/AMB button assignment, NC optimizer, connection quality, adaptive sound control, sound position, VPT; unsupported in libmdr today = speak to chat, pause when removed, multipoint. **The XM4 has not been tested by upstream.** Whatever the XM4 actually reports during init (`CONNECT_RET_SUPPORT_FUNCTION`) decides which cards the UI shows (`mdrHeadphonesGetFeature`).

**The maintainer's headphones and PC**
- XM4 address `AA:BB:CC:12:34:56`, enumerated by Windows as connected (`BluetoothFindFirstDevice` with `fReturnConnected=1` returned it; PnP `AudioEndpoint "Headphones (WH-1000XM4)"` present). The XM5 UUID fails with `SO_ERROR=10049`; the legacy UUID connects. The maintainer confirmed the upstream nightly controls the headphones.
- Installed reviewed client: `%LOCALAPPDATA%\Programs\SonyHeadphonesClient\SonyHeadphonesClient.exe` (CI run 38058742485, sha256 `65d613667901034e105af7e75e50c47572157de909aa8c6686a8525c99750356`), console log via `--con`, recording via `--record <folder>`.
- Toolchain: rustup stable (rustc 1.99), MSVC 14.29.30133 (VS 2019 Build Tools), Windows SDK 10.0.26100, Node 24.20, pnpm 10.32.1, git 2.42, gh. **Missing:** CMake (winget `Kitware.CMake` 4.4.4 available), ninja, LLVM, VS 2022.
- Hue Desktop pins that worked on this machine (reuse exactly): tauri `=2.12.3`, tauri-build `=2.7.2`, tauri-plugin-opener `=2.7.1`, tauri-plugin-autostart `=2.7.0`, tauri-plugin-single-instance `=2.5.3`, tauri-plugin-window-state `=2.5.0`, serde `=1.0.229`, serde_json `=1.0.153`, thiserror `=2.0.21`; npm `@tauri-apps/api` 2.12.3, `@tauri-apps/cli` 2.12.2, react 19.3.0, zustand 5.0.15, framer-motion 14.1.0, vite 8.3.4, vitest 5.0.3, typescript 7.0.2, `@vitejs/plugin-react` 6.1.2. `tauri dev` needs `%USERPROFILE%\.cargo\bin` on PATH (see Hue's `tools/dev.ps1`).

## Decisions made for the maintainer (override any of these before Task 1)

1. **Name** `SoundConnect Desktop`, package `soundconnect-desktop`, identifier `dev.soundconnect.desktop`, docs root `docs/SoundConnect Desktop - Documentation Home.md`. Unofficial; not affiliated with Sony. The About screen says so.
2. **Reuse upstream libmdr as DLLs, do not port the protocol.** Upstream is active (pushed 2026-10-10) and fixing the v1 family; a Rust port would fork that effort. Upstream stays a git submodule pinned to a commit so a rebuild is reproducible. Upgrading = bump submodule, rebuild DLLs, re-run replay tests.
3. **Tauri 2 + React 19, copied from Hue Desktop.** Same frame (frameless window, custom title bar, caption buttons), same tokens/motion files as the starting point, retuned to an iOS feel: large rounded cards, segmented controls, grouped lists, system font, spring motion, light/dark.
4. **v1 scope = what the XM4 actually reports and libmdr already implements.** Phase 3 adds UI for every feature the device advertises **and** libmdr supports: battery/codec, playback + volume + now playing, noise control (Off / Ambient / Noise cancelling, ambient level, focus on voice), equalizer (presets, bands, Clear Bass), DSEE, touch panel, voice guidance, auto power off, NC/AMB button assignment if available. Speak-to-chat, multipoint and adaptive sound are **Phase 5 (optional)** because libmdr v1 lacks them; the right fix is a patch upstream, driven by an XM4 capture.
5. **Tray icon** with current mode and a quick NC/Ambient/Off menu, start minimized option, autostart option (Phase 4). Hotkeys are out of scope for v1.
6. **Tests replay real artifacts only:** the upstream XM3 capture (committed upstream) and an XM4 capture the maintainer records in Task 7. No hand-written packet bytes anywhere in this repo.

## Manual steps only the maintainer can do (the plan stops and waits at each)

- Task 2: approve `winget install Kitware.CMake` (and VS 2022 Build Tools only if MSVC 14.29 fails to compile libmdr).
- Task 7: wear the XM4, run the recording command, press each physical control once (NC/AMB button, touch panel play/pause, volume), then stop the client.
- Task 20: look at the app and approve the look before polish continues.

---

## Phase 0: Repository and engine build

### Task 1: Pin upstream as a submodule and write the documentation home

**Files:**
- Modify: `.gitignore` (remove the `upstream/` line)
- Create: `.gitmodules` (via `git submodule add`)
- Create: `docs/SoundConnect Desktop - Documentation Home.md`
- Create: `README.md`

**Step 1: Replace the plain clone with a submodule at the reviewed commit**

```powershell
cd <repo>
Remove-Item -Recurse -Force upstream\SonyHeadphonesClient
(Get-Content .gitignore) | Where-Object { $_ -notmatch '^upstream/$' -and $_ -notmatch 'third-party clone' } | Set-Content .gitignore -Encoding utf8
git submodule add https://github.com/mos9527/SonyHeadphonesClient upstream/SonyHeadphonesClient
git -C upstream\SonyHeadphonesClient checkout 4c91fe69711ce638a34e066d9bdcfaff504bbec8
git add .gitmodules upstream/SonyHeadphonesClient .gitignore
```

Expected: `git submodule status` prints `4c91fe69711ce638a34e066d9bdcfaff504bbec8 upstream/SonyHeadphonesClient (heads/v1-compat)` or similar with that exact hash.

**Step 2: Write the documentation home** (hub only; links branches, never project files). Branches to create as the plan proceeds: `tooling/SoundConnect Desktop - Engine Build.md` (Task 2-3), `research/SoundConnect Desktop - Upstream Security Review.md` (already written 2026-10-11), `engine/SoundConnect Desktop - Rust Engine Bindings.md` (Phase 1), `testing/SoundConnect Desktop - Testing.md` (Phase 1), `renderer/SoundConnect Desktop - Renderer.md` (Phase 3), `core/SoundConnect Desktop - Core Services.md` (Phase 2). Frontmatter `documentation_hub: true`, `project: "SoundConnect Desktop"`. Model it on `RE-PhilipsHue/docs/Hue Desktop - Documentation Home.md`.

**Step 3: README.md**: three paragraphs: what it is (unofficial, XM4-first), how it relates to upstream (engine DLLs from the submodule, MIT, credit mos9527 and Plutoberth), how to build (points to the toolchain doc).

**Step 4: Commit**

```bash
git add -A && git commit -m "chore: pin upstream SonyHeadphonesClient 4c91fe6 as submodule; add docs home"
```

### Task 2: Install CMake and build the engine DLLs

> **Executed via GitHub Actions (2026-10-11).** The local VS 2019 compiler crashes
> (C1001) on upstream's coroutines and VS 2022 cannot be installed here, so the DLLs
> are built by `.github/workflows/engine.yml` on `windows-latest` with the same
> configure flags as Step 2, replayed with `ctest` on CI, and fetched with
> `tools/fetch-engine.ps1` into the unchanged `engine/bin/RelWithDebInfo/`.
> `tools/build-engine.ps1` remains the local path for a machine with VS 2022.
> Evidence and hashes: `docs/tooling/SoundConnect Desktop - Engine Build.md`.

**Files:**
- Create: `tools/build-engine.ps1`
- Create: `docs/tooling/SoundConnect Desktop - Engine Build.md`

**Step 1: Install CMake** (the maintainer approves): `winget install --id Kitware.CMake --exact --accept-package-agreements --accept-source-agreements`. Then open a new shell; `cmake --version` -> `cmake version 4.4.4`.

**Step 2: Write `tools/build-engine.ps1`** (complete):

```powershell
# Builds upstream libmdr + libmdr-bt as DLLs for the Rust core. Output: engine/bin/<config>/.
# Requires CMake >= 3.31 and MSVC. Does NOT build the ImGui client.
param([string]$Config = "RelWithDebInfo")
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$src = Join-Path $root "upstream\SonyHeadphonesClient"
$build = Join-Path $root "engine\build"
$out = Join-Path $root "engine\bin\$Config"
if (-not (Test-Path (Join-Path $src "CMakeLists.txt"))) { throw "submodule missing: run git submodule update --init" }
cmake -S $src -B $build -A x64 `
  -DMDR_BUILD_CLIENT=OFF -DMDR_ENABLE_CODEGEN=OFF -DMDR_BUILD_SHARED=ON `
  -DBUILD_TESTING=ON -DMDR_ENABLE_LOG=ON
cmake --build $build --config $Config --target mdr_shared mdr-bt_shared mdr_replay_tests
New-Item -ItemType Directory -Force $out | Out-Null
Get-ChildItem $build -Recurse -Include "mdr-shared.dll","mdr-shared.lib","mdr-bt-shared.dll","mdr-bt-shared.lib","mdr_replay_tests.exe" |
  Where-Object { $_.FullName -like "*\$Config\*" } | Copy-Item -Destination $out -Force
Get-ChildItem $out | Format-Table Name, Length
```

**Step 3: Run it** and record what happened. If MSVC 14.29 fails on C++20 features, record the first error verbatim in the tooling doc, then install `Microsoft.VisualStudio.2022.BuildTools` with the `Microsoft.VisualStudio.Workload.VCTools` workload (the maintainer approves) and rerun.

Expected: `engine\bin\RelWithDebInfo\` contains `mdr-shared.dll`, `mdr-shared.lib`, `mdr-bt-shared.dll`, `mdr-bt-shared.lib`, `mdr_replay_tests.exe`.

**Step 4: Verify exports** (this is the FFI contract for Phase 1):

```powershell
$dumpbin = (Get-ChildItem "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2019\BuildTools\VC\Tools\MSVC\*\bin\Hostx64\x64\dumpbin.exe" | Select-Object -First 1).FullName
& $dumpbin /EXPORTS engine\bin\RelWithDebInfo\mdr-shared.dll    > docs\tooling\evidence\mdr-shared-exports.txt
& $dumpbin /EXPORTS engine\bin\RelWithDebInfo\mdr-bt-shared.dll > docs\tooling\evidence\mdr-bt-shared-exports.txt
```

Expected: `mdr-shared-exports.txt` lists `mdrHeadphonesCreate`, `mdrHeadphonesPoll`, `mdrConnectionConnect`, `mdrResultString` (and the rest of `Headphones.h`/`Connection.h`); `mdr-bt-shared-exports.txt` lists `mdrConnectionWindowsCreate`, `mdrConnectionWindowsGet`, `mdrConnectionWindowsDestroy`. Undecorated names (no leading underscore, no `@`).

**Step 5: Run the upstream replay test against the real XM3 capture**

```powershell
engine\bin\RelWithDebInfo\mdr_replay_tests.exe upstream\SonyHeadphonesClient\tests\WH-1000XM3-4.5.2
```
Expected: exit code 0, no `FAIL:` lines. Save the output to `docs/tooling/evidence/replay-xm3-upstream.txt`.

**Step 6: Document** in `docs/tooling/SoundConnect Desktop - Engine Build.md`: CMake version, compiler used, exact configure flags, what failed (if anything), output artifacts and their SHA-256, the export lists, the replay result. Link the script and evidence files. Add `engine/build/` and `engine/bin/` to `.gitignore` (DLLs are build output; the Rust build script rebuilds or expects them).

**Step 7: Commit** `chore(engine): build upstream libmdr DLLs; record exports and XM3 replay`.

---

## Phase 1: Rust engine bindings

Crate layout inside the Tauri workspace (Task 8 creates `src-tauri/`; until then the crates live at `engine/crates/` and are plain cargo crates):

```
engine/crates/mdr-sys/   # unsafe extern "C" declarations mirroring mdr-c/*.h, link to the DLL import libs
engine/crates/mdr/       # safe wrapper: Transport trait, Engine, Snapshot, replay test
```

### Task 3: `mdr-sys` crate skeleton with build.rs linking and a smoke test

**Files:**
- Create: `engine/crates/mdr-sys/Cargo.toml`, `build.rs`, `src/lib.rs`, `tests/smoke.rs`
- Create: `engine/Cargo.toml` (workspace)

**Step 1: Workspace**

```toml
# engine/Cargo.toml
[workspace]
members = ["crates/mdr-sys", "crates/mdr"]
resolver = "2"
```

**Step 2: `mdr-sys/Cargo.toml`**

```toml
[package]
name = "mdr-sys"
version = "0.1.0"
edition = "2021"
links = "mdr-shared"
[lib]
[dependencies]
```

**Step 3: `mdr-sys/build.rs`** (complete). It finds the DLL import libraries in `engine/bin/RelWithDebInfo` (populated by `tools/fetch-engine.ps1` from the CI artifact `engine-win-x64`; path unchanged from the local-build plan), lets `MDR_ENGINE_BIN` override the directory, and copies the DLLs next to test binaries so `cargo test` can load them.

```rust
use std::{env, fs, path::PathBuf};

fn main() {
    let manifest = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let default_bin = manifest.join("../../bin/RelWithDebInfo");
    let bin = env::var_os("MDR_ENGINE_BIN").map(PathBuf::from).unwrap_or(default_bin);
    println!("cargo:rerun-if-env-changed=MDR_ENGINE_BIN");
    for lib in ["mdr-shared", "mdr-bt-shared"] {
        let import = bin.join(format!("{lib}.lib"));
        assert!(import.exists(), "missing {}: run tools/fetch-engine.ps1 (CI-built DLLs) first", import.display());
        println!("cargo:rustc-link-lib=dylib={lib}");
    }
    println!("cargo:rustc-link-search=native={}", bin.display());
    // Copy the DLLs beside the test/bin outputs (target/<profile>/deps and target/<profile>).
    let out = PathBuf::from(env::var("OUT_DIR").unwrap());
    let profile_dir = out.ancestors().nth(3).unwrap().to_path_buf();
    for dir in [profile_dir.clone(), profile_dir.join("deps")] {
        fs::create_dir_all(&dir).unwrap();
        for lib in ["mdr-shared.dll", "mdr-bt-shared.dll"] {
            fs::copy(bin.join(lib), dir.join(lib)).unwrap();
        }
    }
    println!("cargo:bin_dir={}", bin.display());
}
```

**Step 4: Minimal `src/lib.rs`** with only `mdrResultString` and the result constants, so the link is proven before the full surface is typed:

```rust
#![allow(non_camel_case_types, non_snake_case)]
use std::os::raw::c_char;
pub type MDRResult = u32;
pub const MDR_RESULT_OK: MDRResult = 0;
pub const MDR_RESULT_INPROGRESS: MDRResult = 1;
pub const MDR_RESULT_ERROR_ABI_MISMATCH: MDRResult = 12;
pub const MDR_ABI_VERSION: u32 = 2;
extern "C" {
    pub fn mdrResultString(err: MDRResult) -> *const c_char;
}
```

**Step 5: Failing smoke test `tests/smoke.rs`**

```rust
use std::ffi::CStr;
#[test]
fn result_string_round_trips_ok() {
    let s = unsafe { CStr::from_ptr(mdr_sys::mdrResultString(mdr_sys::MDR_RESULT_OK)) };
    let text = s.to_str().unwrap();
    assert!(!text.is_empty(), "empty result string");
}
```

Run: `cargo test --manifest-path engine/Cargo.toml -p mdr-sys` -> must FAIL before the DLLs exist (link error or missing import lib) and PASS after Task 2's output is present. Record the actual string the DLL returns for `MDR_RESULT_OK` in the test as an exact assertion once observed (for example `assert_eq!(text, "OK")` only after seeing it).

**Step 6: Commit** `feat(mdr-sys): link upstream engine DLLs; smoke test`.

### Task 4: Full `mdr-sys` surface, transcribed from the headers

**Files:**
- Modify: `engine/crates/mdr-sys/src/lib.rs` (split into `base.rs`, `connection.rs`, `headphones.rs`, `bt_windows.rs`)
- Create: `engine/crates/mdr-sys/tests/layout.rs`

**Rule for the implementer:** every constant, struct field and function signature is copied from `upstream/SonyHeadphonesClient/libmdr/include/mdr-c/{Base,Connection,Headphones}.h` and `libmdr-bt/include/mdr-bt/ConnectionWindows.h` **in header order**, with a comment giving the header line. Types: `uint32_t` -> `u32`, `uint8_t` -> `u8`, `int8_t` -> `i8`, `int` -> `c_int`, `char[18]` -> `[c_char; 18]`, `const char*` -> `*const c_char`, opaque structs -> `#[repr(C)] pub struct MDRHeadphones { _p: [u8; 0] }`. All structs `#[repr(C)] #[derive(Clone, Copy, Debug)]`. `MDRConnection` is `#[repr(C)]` with the eight function-pointer fields in header order, each `Option<unsafe extern "C" fn(...)>`.

**Step 1: Write `tests/layout.rs` first.** It asserts `size_of` for each struct against values produced by a tiny C++ program compiled from the real header. Create `engine/tools/sizes.cpp`:

```cpp
#include <mdr-c/Headphones.h>
#include <mdr-bt/ConnectionWindows.h>
#include <cstdio>
#define P(T) std::printf("%s %zu %zu\n", #T, sizeof(T), alignof(T));
int main(){P(MDRConnection)P(MDRDeviceInfo)P(MDRModel)P(MDRBattery)P(MDRPlayback)P(MDRPlaybackCommand)P(MDRNoiseControl)P(MDRSpeakToChat)P(MDRListening)P(MDREqualizer)P(MDRPairedDevice)P(MDRPairedDeviceAction)P(MDRPairing)P(MDRGeneralSettingInfo)P(MDRGeneralSetting)P(MDRAssignableControl)P(MDRPower)P(MDRVoiceGuidance)P(MDRConnectionMode)P(MDRSafeListening)}
```
Compile with `cl /std:c++20 /I upstream\SonyHeadphonesClient\libmdr\include /I upstream\SonyHeadphonesClient\libmdr-bt\include engine\tools\sizes.cpp` (from a VS developer prompt), run it, and paste the output into `engine/crates/mdr-sys/tests/layout.rs` as `assert_eq!(size_of::<MDRBattery>(), N)` lines plus `align_of`. The expected numbers come from the compiler, never from arithmetic in your head.

**Step 2: Run** `cargo test -p mdr-sys` -> FAIL (types missing). **Step 3:** transcribe the headers. **Step 4:** run -> PASS. **Step 5:** commit `feat(mdr-sys): full C ABI surface with layout tests`.

### Task 5: `mdr` safe wrapper: Transport trait and an in-memory replay transport

**Files:**
- Create: `engine/crates/mdr/Cargo.toml`, `src/lib.rs`, `src/transport.rs`, `src/replay.rs`, `src/error.rs`
- Test: `engine/crates/mdr/tests/replay_transport.rs`

**Design (mirror `tests/Replay.cpp`):** a `Transport` trait with `recv(&mut self, dst: &mut [u8]) -> io::Result<Option<usize>>` (None = would block), `send(&mut self, src: &[u8]) -> io::Result<usize>`, `poll(&mut self, timeout_ms: i32) -> PollStatus`, `connect`, `disconnect`, `devices()`. A `Box<dyn Transport>` is wrapped into a `#[repr(C)] mdr_sys::MDRConnection` whose `user` pointer is the box and whose function pointers are `extern "C"` trampolines translating results to `MDR_RESULT_*` exactly as `Replay.cpp` does (`Receive` returns `MDR_RESULT_INPROGRESS` with `*received = 0` when exhausted; `Send` records bytes and returns OK; `Poll` returns OK). `ReplayTransport::from_capture_dir(path)` loads every `*-rx.*.bin` file sorted by the 6-digit ordinal in its name and concatenates them, recording all `tx` bytes for assertions.

**Step 1: Failing test**

```rust
use mdr::replay::ReplayTransport;
#[test]
fn xm3_capture_loads_in_ordinal_order() {
    let dir = concat!(env!("CARGO_MANIFEST_DIR"), "/../../../upstream/SonyHeadphonesClient/tests/WH-1000XM3-4.5.2");
    let t = ReplayTransport::from_capture_dir(dir).unwrap();
    assert_eq!(t.frame_count(), 187);           // observed file count
    assert_eq!(t.rx_bytes()[0], 0x3E);          // every MDR frame starts with 0x3E (observed in the first .bin; verify with `xxd` first)
}
```
Verify the first byte claim before writing it: `Format-Hex upstream\SonyHeadphonesClient\tests\WH-1000XM3-4.5.2\mdr-packet-1791485921245-000001-rx.*.bin | Select -First 2`. If it is not `3E`, write what it is.

**Step 2-5:** run (FAIL), implement, run (PASS), commit `feat(mdr): Transport trait and capture replay transport`.

### Task 6: `mdr::Engine` lifecycle over the DLL, proven by replaying the XM3 capture

**Files:**
- Create: `engine/crates/mdr/src/engine.rs`, `src/snapshot.rs`, `src/events.rs`
- Test: `engine/crates/mdr/tests/engine_replay.rs`

**Design:** `Engine::create(transport: Box<dyn Transport>, protocol: Protocol) -> Result<Engine>` calls `mdrHeadphonesCreate(MDR_ABI_VERSION, conn, v, &mut h)` and maps `MDR_RESULT_ERROR_ABI_MISMATCH` to `Error::AbiMismatch`. `Engine::request_init()`, `poll() -> Result<Event>` (maps every `MDR_EVENT_*` to a Rust enum, `Unhandled(u32)` for unknown), `request_sync()`, `commit()`, `is_ready()`, `is_dirty()`. Readers return owned Rust structs (`Model`, `Battery`, `NoiseControl`, `Equalizer { preset, clear_bass, bands: Vec<i8>, dsee_enabled, dsee_type, available, dsee_available }`, `Playback`, `Power`, `VoiceGuidance`, `Vec<PairedDevice>`, `Vec<GeneralSettingInfo>`, `Vec<AssignableControl>`), text via a two-call `GetText` (size query then fill, exactly like `Replay.cpp`'s `GetLastError`). `Snapshot` is one `serde::Serialize` struct holding `Option<T>` for every reader plus `features: BTreeMap<String, Availability>` (every `MDR_FEATURE_*` name) and `texts` (model name, firmware, unique id). `Engine::snapshot()` builds it by calling every reader and treating non-OK results as `None`. `Drop` calls `mdrHeadphonesDestroy` then drops the transport box.

**Step 1: Failing test**

```rust
use mdr::{Engine, Event, Protocol, replay::ReplayTransport};
#[test]
fn xm3_capture_initialises_and_reports_battery() {
    let dir = concat!(env!("CARGO_MANIFEST_DIR"), "/../../../upstream/SonyHeadphonesClient/tests/WH-1000XM3-4.5.2");
    let t = ReplayTransport::from_capture_dir(dir).unwrap();
    let mut e = Engine::create(Box::new(t), Protocol::V1).unwrap();
    e.request_init().unwrap();
    let mut seen = Vec::new();
    for _ in 0..10_000 {
        let ev = e.poll().unwrap();
        if ev != Event::None { seen.push(ev); }
        if ev == Event::InitializeComplete { e.request_sync().unwrap(); }
        if ev == Event::SyncComplete { break; }
    }
    assert!(seen.contains(&Event::InitializeComplete), "events: {seen:?}");
    let snap = e.snapshot();
    assert_eq!(snap.model.as_ref().unwrap().protocol_version, 1);
    // Fill these two from what the capture actually yields on the first green run, then pin them:
    // assert_eq!(snap.texts.model_name, "WH-1000XM3");
    // assert_eq!(snap.batteries[0].level_percent, <observed>);
}
```
The capture may stop before `SyncComplete` (the recorded session may not include a sync). If the loop ends on exhaustion, assert on `InitializeComplete` and the identity instead, and write down in the test why.

**Step 2-5:** FAIL, implement, PASS, commit `feat(mdr): Engine lifecycle, readers and Snapshot over libmdr`.

### Task 7: Record a real XM4 capture (the maintainer) and add it as a fixture

**Files:**
- Create: `tests/fixtures/WH-1000XM4-<firmware>/*.bin` (scrubbed), `tests/fixtures/WH-1000XM4-<firmware>/README.md`
- Create: `docs/testing/SoundConnect Desktop - Testing.md`
- Test: add `xm4_capture_initialises` to `engine/crates/mdr/tests/engine_replay.rs`

**Step 1 (the maintainer):**
```powershell
& "$env:LOCALAPPDATA\Programs\SonyHeadphonesClient\SonyHeadphonesClient.exe" --con --record "$env:USERPROFILE\Documents\Projects\RE-SoundConnect\downloads\xm4-capture"
```
Connect to the XM4 in the app, wait for the controls to appear, note the firmware version on the About tab, then: change NC -> Ambient -> Off from the app, move the ambient slider, pick an EQ preset, toggle DSEE, press the physical NC/AMB button once, tap the touch panel to pause and play, then close the app.

**Step 2:** scrub and inspect: `python -I upstream\SonyHeadphonesClient\tooling\scrub-capture.py --dry-run downloads\xm4-capture` then without `--dry-run`; `Get-ChildItem downloads\xm4-capture | Select -First 5`; `cat downloads\xm4-capture\*.bin | strings -n 4` (or `python -I` equivalent) must show no phone names or Bluetooth addresses other than the headset's own. Copy to `tests/fixtures/WH-1000XM4-<fw>/`.

**Step 3:** Run `engine\bin\RelWithDebInfo\mdr_replay_tests.exe tests\fixtures\WH-1000XM4-<fw>` -> exit 0. If it fails, that is an upstream libmdr bug on real XM4 data: save the output as `docs/testing/evidence/replay-xm4-upstream.txt`, open an upstream issue with the scrubbed capture (the maintainer approves), and continue; the Rust test then asserts the partial behaviour that does work.

**Step 4:** Add the Rust replay test for the XM4 directory (same shape as Task 6) and pin observed values: model name text, firmware text, which `features` are `Available`. **Write the observed feature list into `docs/testing/SoundConnect Desktop - Testing.md` as the authoritative "what the XM4 reports" table** (this table decides Phase 3's cards).

**Step 5:** Commit `test: real WH-1000XM4 capture fixture and replay test`.

---

## Phase 2: Tauri core

### Task 8: Scaffold the Tauri 2 app from Hue Desktop

> **Executed 2026-10-11 out of order (commit `0a25051`) while Task 2 was blocked on the compiler.** The scaffold shipped without the engine parts: moving `engine/crates/*` into the `src-tauri` workspace, the `MDR_ENGINE_BIN` line in `tools/dev.ps1`, and the `mdr` / `crossbeam-channel` dependencies are now the first steps of **Task 9**. `zustand` and `@tauri-apps/plugin-autostart` are added by the tasks that first use them (11 and 21).

**Files:**
- Create: `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `vitest.config.ts`, `tsconfig*.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles/{tokens,global}.css`, `src/styles/motion.ts`, `src/styles/breakpoints.ts`
- Create: `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/build.rs`, `src-tauri/src/{main,lib}.rs`, `src-tauri/icons/*`, `src-tauri/capabilities/default.json`
- Move: `engine/crates/*` -> `src-tauri/crates/*` and make `src-tauri/Cargo.toml` a workspace root listing `crates/mdr-sys`, `crates/mdr` (keep `engine/bin` and `tools/build-engine.ps1` where they are; set `MDR_ENGINE_BIN` default path in `mdr-sys/build.rs` to `../../../engine/bin/RelWithDebInfo`)
- Create: `tools/dev.ps1` (copy of Hue's, adds `MDR_ENGINE_BIN`)

Copy from `RE-PhilipsHue`: `package.json` (rename, drop `record:fixtures`), `vite.config.ts`, `vitest.config.ts`, `tsconfig*.json`, `src/styles/*`, `src/components/frame/*`, `src/components/icons/Icon.tsx`, `src/hooks/{useIsTauri,useMediaQuery,usePrefersReducedMotion,useWindowControls,useOptimisticValue,usePointerDrag,useRovingTabIndex}.ts`. Change wordmark to `SoundConnect`. `tauri.conf.json`: `productName "SoundConnect Desktop"`, identifier `dev.soundconnect.desktop`, window `width 420, height 760, minWidth 380, minHeight 600, decorations false, resizable true` (a tall phone-like window is the default; it may be widened). Cargo deps: tauri `=2.12.3` with `tray-icon`, tauri-plugin-opener `=2.7.1`, tauri-plugin-single-instance `=2.5.3`, tauri-plugin-window-state `=2.5.0`, serde, serde_json, thiserror, `mdr = { path = "crates/mdr" }`, crossbeam-channel (latest stable, pin exactly), windows-sys only if needed later.

**Verify:** `pnpm install`; `pnpm typecheck`; `pnpm test` (passWithNoTests); `cargo test --manifest-path src-tauri/Cargo.toml` (mdr tests still green after the move); `pnpm dev:web` opens the empty frame at `http://localhost:1420`; `.\tools\dev.ps1` opens the native frameless window with working caption buttons. Take a screenshot of each with the Browser pane / a window capture and store under `docs/renderer/screenshots/`.

**Commit** `feat: Tauri 2 + React scaffold from Hue Desktop`.

### Task 9: `EngineService`: one thread that owns the connection and publishes snapshots

**Files:**
- Create: `src-tauri/src/engine_service.rs`, `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/src/engine_service.rs` unit tests using `ReplayTransport`

**Design:** `EngineService::spawn(sink: Arc<dyn SnapshotSink>, transport_factory: Box<dyn Fn() -> Box<dyn Transport> + Send>) -> EngineHandle`. The thread runs a state machine `Disconnected -> Discovering -> Connecting{attempt} -> Initialising -> Ready -> Disconnected`, mirroring `Client.cpp`: enumerate devices via the transport, connect with the UUID order `[XM5, LEGACY]` (or a remembered UUID), poll the connection every 16 ms until OK or a 10 s deadline, then `Engine::create`, `request_init`, loop `poll()`; on `InitializeComplete` -> `request_sync`; on `NeedSync` -> `request_sync` when `is_ready`; on any `*Changed`/`SyncComplete` -> `sink.snapshot(&engine.snapshot())`; at the end of each tick `commit()` if `is_dirty`. Commands arrive over a `crossbeam_channel::Receiver<Command>` and are applied as `Set*` calls between polls: `Command::{SetNoiseControl(NoiseControl), SetAmbientLevel(u8), SetEqualizerPreset(u32), SetEqualizerBands(Vec<i8>), SetClearBass(i8), SetDsee(bool), Playback(PlaybackAction), SetVolume(u8), SetPower(Power), SetVoiceGuidance(VoiceGuidance), SetGeneralSetting{index,value}, SetAssignableControls(Vec<AssignableControl>), RespondToAlert(bool), Disconnect, Reconnect}`. Status changes publish `Status { state, device_name, address, last_error }`. `SnapshotSink` has `snapshot(&Snapshot)` and `status(&Status)`; the Tauri impl emits `engine:snapshot` and `engine:status` (same pattern as Hue's `TauriSink`).

**Test (replay):** a `VecSink` collects snapshots; spawn the service with a factory returning the XM4 (or XM3) `ReplayTransport` with a `devices()` stub returning one device; assert the sink saw `Status::Ready`-equivalent and at least one snapshot whose `model.protocol_version == 1`. Then send `Command::SetDsee(true)` and assert the transport's recorded TX bytes grew (a `DATA_MDR` frame was sent) — do not assert the bytes' content; libmdr owns that.

**Commands (Tauri):** `status()`, `snapshot()`, `send(command: Command)`, `devices()`, `connect(address, protocolHint)`, `disconnect()`. Each one line delegating to the handle, logging one line to stderr, as in Hue's `commands.rs`.

**Commit** `feat(core): EngineService thread, snapshot/status events, command channel`.

### Task 10: Windows RFCOMM transport over `mdr-bt-shared.dll`

**Files:**
- Create: `src-tauri/crates/mdr/src/transport_windows.rs`
- Test: manual (live headphones) + `devices()` unit test on this PC

**Design:** `WindowsTransport` wraps `mdrConnectionWindowsCreate()` and implements `Transport` by delegating to `mdrConnectionConnect/Recv/Send/Poll/GetDevicesList/FreeDevicesList/GetLastError` on `mdrConnectionWindowsGet(w)`. Alternatively, and simpler: `Engine::create_with_raw(conn: *mut MDRConnection, ...)` accepts the upstream `MDRConnection*` directly, and `WindowsTransport` only owns the `MDRConnectionWindows*` for Drop. Pick the simpler one and record why in the module doc. `devices()` returns `Vec<DeviceInfo { address, name }>` from `MDRDeviceInfo` (read the exact field names from `Connection.h`).

**Live check (the maintainer wearing the XM4, upstream client closed):** `cargo run --manifest-path src-tauri/Cargo.toml --example devices` prints `WH-1000XM4 AA:BB:CC:12:34:56`. Then `.\tools\dev.ps1`, and the renderer's debug status line (Task 11) shows `Ready: WH-1000XM4`.

**Commit** `feat(core): Windows RFCOMM transport via libmdr-bt`.

### Task 11: Renderer bootstrap: engine store, mock mode, status line

**Files:**
- Create: `src/lib/engine/types.ts` (TypeScript mirror of `Snapshot`, `Status`, `Command`; **generate** by hand from the Rust structs, field for field, with a vitest that parses `tests/fixtures/snapshots/xm4-ready.json`), `src/lib/engine/api.ts` (`invoke` wrappers + `listen`), `src/lib/engine/mockApi.ts` (replays `tests/fixtures/snapshots/*.json` and echoes commands into the snapshot), `src/state/engineStore.ts` (zustand), `src/state/useEngineBootstrap.ts`
- Create: `tests/fixtures/snapshots/xm4-ready.json` — **recorded** from the real service (add `--dump-snapshot <path>` to the Tauri binary or log the JSON on `SyncComplete` and save it), never hand-written
- Test: `tests/engine/types.test.ts`, `tests/engine/engineStore.test.ts`

`VITE_MOCK_ENGINE=1` selects `mockApi` so `pnpm dev:web` shows the full UI in a browser (the maintainer's visual review tool). Status line at the bottom of the frame shows `state · device · error` until Phase 3 replaces it with the real header.

**Commit** `feat(renderer): engine store, Tauri API, recorded-snapshot mock mode`.

---

## Phase 3: iOS-style interface

Read `<Brain vault>\general\preferences\frontend-component-and-hook-granularity.md` before every task in this phase: small components, hooks for state/logic, no pass-through wrappers. Every component gets a `.css` file beside it using only tokens. Every visual task ends with a screenshot in the Browser pane (`pnpm dev:web` with `VITE_MOCK_ENGINE=1`) at 420x760 and at 900x760, saved to `docs/renderer/screenshots/`, and a one-paragraph designer's judgement in the task report (alignment, spacing, hierarchy, contrast in light and dark).

**Visual language (decided):** background `--bg` grouped-table grey (`#f2f2f7` light / `#000000` or `#0b0b0f` dark, iOS grouped style), cards `--surface` white / `#1c1c1e` with 20 px radius, 16 px gutters, section headers 13 px uppercase secondary, system font stack (Segoe UI Variable on Windows), accent `#0a84ff` (iOS blue) with a secondary device-colour tint read from `model.model_color`, spring motion from `motion.ts`, segmented control with a sliding pill (framer-motion `layoutId`), iOS toggle switches, large thumb sliders, bottom sheets for EQ editing. Icons: a small inline SVG set in `src/components/icons/`.

### Task 12: Design tokens, primitives, and a component gallery page

**Files:** `src/styles/tokens.css` (retune), `src/components/primitives/{Card,GroupedList,ListRow,SegmentedControl,Toggle,Slider,SectionHeader,SheetButton,Pill}.tsx+.css`, `src/pages/GalleryPage.tsx` (dev-only route `?gallery=1`), tests `tests/primitives/*.test.tsx` (React Testing Library via vitest `jsdom` environment: SegmentedControl keyboard arrows move selection and call `onChange`; Toggle has `role="switch"` and `aria-checked`; Slider is an `<input type="range">` with label).

**Commit** `feat(ui): iOS primitives and gallery`.

### Task 13: App shell: header with device identity, tab bar, page transitions

**Files:** `src/components/shell/{DeviceHeader,BatteryGauge,CodecBadge}.tsx`, `src/components/frame/{NavRail,NavItem,RailDevice,SideNav}.tsx` (left rail; replaced `TabBar`/`TabItem` on 2026-10-12), `src/pages/{StatusPage,SoundPage,NoiseControlPage,SystemPage,DevicesPage,SettingsPage}.tsx` (`StatusPage` replaced `HomePage`/`ConnectedHome`), `src/state/navStore.ts`, hooks `useBattery`, `useModelIdentity`. Tabs: **Home**, **Sound**, **System**, **Settings**. Header shows model name (from `texts.model_name`), battery gauge (`batteries[part=MAIN].level_percent`, charging state), codec badge (`model.audio_codec`). Connection states render as a full-screen friendly card: "Looking for your headphones", "Connecting to WH-1000XM4", "Reconnect" button on error, with the real `last_error` under a disclosure.

**Commit** `feat(ui): shell, header, tabs, connection states`.

### Task 14: Home: now playing and noise control card

**Files:** `src/components/playback/{NowPlayingCard,TransportControls,VolumeSlider}.tsx`, `src/components/noise/{AmbientSoundControlCard,NoiseModeSegment,AmbientPositionSlider,FocusOnVoiceRow}.tsx` (replaced `NoiseControlCard`/`AmbientLevelSlider` on 2026-10-12), hooks `usePlayback`, `useNoiseControl`, `useThrottledCommand` (coalesce slider commands to one every 120 ms, like Hue's `useThrottledPut`). Noise segment options from `features`: `NOISE_CANCELLING` and `AMBIENT_SOUND` availability decide which segments render. Map: Off -> `mode=OFF`; Ambient -> `mode=AMBIENT, ambient_level` kept; Noise cancelling -> `mode=CANCELLING` (v1 alias `V1_ON`). Optimistic UI: store applies the command locally, then the next snapshot wins.

**Commit** `feat(ui): now playing and noise control`.

### Task 15: Sound page: equalizer and DSEE

**Files:** `src/components/equalizer/{EqualizerCard,PresetPicker,BandSliders,ClearBassSlider,EqualizerSheet}.tsx`, `src/components/sound/DseeRow.tsx`, hooks `useEqualizer`, `usePresetNames` (`texts.equalizer_presets[]` from the snapshot). Preset names come from the device via `MDR_TEXT_EQUALIZER_PRESET_NAME`; bands count from `equalizer.band_count`; editing bands in the sheet sends `SetEqualizerBands` on release, Clear Bass separately. Hide the card when `features.EQUALIZER != Available`.

**Commit** `feat(ui): equalizer and DSEE`.

### Task 16: System page: touch panel, voice guidance, auto power off, button assignment, power off

**Files:** `src/components/system/{GeneralSettingRow,VoiceGuidanceRow,AutoPowerOffPicker,AssignableControlsCard,PowerOffRow}.tsx`, hooks `useGeneralSettings`, `usePower`, `useAssignableControls`. General settings render from `general_settings[]` with subject/summary texts from the snapshot (`MDR_TEXT_GENERAL_SETTING_SUBJECT/SUMMARY`), boolean ones as toggles. Auto power off options are the ones libmdr accepts for v1 (`docs/device-support/WH-1000XM3.md`: 5/30/60/180 minutes and off; **no 15**). Power off asks for confirmation in a sheet.

**Commit** `feat(ui): system settings`.

### Task 17: Settings page and About

**Files:** `src/components/settings/{ThemePicker,StartupRow,AboutCard}.tsx`, `src/state/settingsStore.ts` (persist via `localStorage` in the renderer; theme `system|light|dark` sets `data-theme`). About credits mos9527/Plutoberth, shows the engine commit (`4c91fe6`, injected at build from `git submodule status` by `src-tauri/build.rs` into an env var) and the "not affiliated with Sony" line.

**Commit** `feat(ui): settings and about`.

### Task 18: Tray icon and window behaviour

**Files:** `src-tauri/src/tray.rs`, `src/hooks/useTrayState.ts`. Tray tooltip `WH-1000XM4 · 80% · Noise cancelling`; menu: Noise cancelling / Ambient sound / Off (radio items sending `SetNoiseControl`), separator, Show, Quit. Closing the window hides to tray when the setting "Keep running in the tray" is on (default on). Single-instance plugin re-shows the window.

**Commit** `feat: tray with quick noise control`.

### Task 19: Live verification against the XM4 and the renderer doc

The maintainer runs `.\tools\dev.ps1`, connects, and exercises every control; the implementer watches `engine:snapshot` events in the devtools console and fixes any mismatch between UI state and device notifications. Write `docs/renderer/SoundConnect Desktop - Renderer.md` (tokens and why, component tree, hooks, mock mode, screenshots) and `docs/core/SoundConnect Desktop - Core Services.md` (service state machine, events, commands, tray) and `docs/engine/SoundConnect Desktop - Rust Engine Bindings.md` (mdr-sys rules, Transport trait, Engine, Snapshot, replay tests). Update the documentation home.

**Commit** `docs: renderer, core and engine documentation`.

### Task 20: The maintainer's design review (manual gate)

The maintainer looks at the running app (light and dark) and lists what feels wrong. The main session turns the list into follow-up tasks appended under "Phase 3b: polish" in this file before any more code is written.

---

## Phase 4: Packaging

### Task 21: Installer, autostart, upstream-licence bundling

- `tauri.conf.json` bundle: NSIS `targets: ["nsis"]`, `resources: ["../engine/bin/RelWithDebInfo/mdr-shared.dll", "../engine/bin/RelWithDebInfo/mdr-bt-shared.dll"]` so the DLLs sit beside the exe; `src-tauri/build.rs` fails the build if they are missing. Include `upstream/SonyHeadphonesClient/LICENSE` as `THIRD-PARTY-LICENSES.txt`.
- `tauri-plugin-autostart` wired to the Settings "Start with Windows" toggle.
- `pnpm dist` produces `src-tauri/target/release/bundle/nsis/SoundConnect Desktop_0.1.0_x64-setup.exe`; install it, launch from Start Menu, confirm connect + one control change. Record the installer SHA-256 in the toolchain doc.

**Commit** `build: NSIS installer bundling engine DLLs; autostart`.

### Task 22: Final review and Brain update

- Run the `codex-review` skill on the whole change set; fix valid findings.
- Brain: create `projects/SoundConnect Desktop.md` hub (what it is, where, status, what is reusable: the DLL-over-FFI pattern, the Transport trampoline, the iOS primitives), add the bullet to `hot.md` (replace the Hue bullet's neighbour, keep hot.md short), link from `index.md`. Add a `general/references/sony-mdr-protocol-sources.md` note pointing at upstream's `docs/device-support`, `tooling/ida` extraction notes and the fixture folders (sources, not copies).
- Retire the installed upstream nightly only if the maintainer says so; otherwise leave it as the fallback.

---

## Phase 5 (optional, after Phase 4): features libmdr v1 lacks

Speak-to-chat, multipoint device list and adaptive sound control exist on the XM4 but are not implemented for the v1 family in libmdr (`docs/device-support/WH-1000XM3.md`). The honest path: record an XM4 capture while toggling each in the **phone** app with the PC also connected (the headphones notify every connected controller), inspect the `*_NTFY_PARAM` frames in the Protocol Debugger, implement the v1 payloads **in a fork of upstream** following `DEVELOPER.md`'s struct rules, run `mdr_replay_tests`, and send the PR upstream. This repo then bumps the submodule. No Sony-protocol code lands in this repo.

---

## Review protocol for every task (main session)

1. Brief the Opus implementer with: the task text, the "Verified facts" block, the exact upstream/Hue files to read, and the rule "quote the header/doc lines you rely on in your report".
2. On completion: check the quoted lines against the real files (`sed -n`), run the task's command(s), confirm the expected output, read the diff for scope creep.
3. Dispatch an Opus reviewer (superpowers:code-reviewer) with the diff and the task text; it reports spec compliance first, then code quality. Fix findings via the implementer, not inline.
4. Only then mark the task done and move on. Commit messages as given; attribution line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
