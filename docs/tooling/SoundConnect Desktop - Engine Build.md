---
title: "SoundConnect Desktop - Engine Build"
date: 2026-10-11
tags: [tooling, build, ci]
project: "SoundConnect Desktop"
area: "tooling"
---

# SoundConnect Desktop - Engine Build

**Status (2026-10-11): working, built on GitHub Actions.** The engine DLLs are
compiled by CI on `windows-latest` (MSVC 19.51), replayed against every upstream
capture there, and fetched to `engine/bin/RelWithDebInfo/` with one script. The
earlier blocker (a local MSVC 19.29 internal compiler error, see
[History](#history)) no longer applies to this project.

## Purpose

SoundConnect Desktop does not reimplement the Sony protocol. The Rust core loads
the upstream engine as two DLLs built from the pinned submodule
`upstream/SonyHeadphonesClient` (commit `4c91fe69711ce638a34e066d9bdcfaff504bbec8`,
reviewed in [SoundConnect Desktop - Upstream Security Review](<../research/SoundConnect Desktop - Upstream Security Review.md>)):

- `mdr-shared.dll` (CMake target `mdr_shared`, `libmdr`): the protocol state
  machine and the C API (`mdr-c/Headphones.h`, `mdr-c/Connection.h`,
  `mdr-c/Base.h`).
- `mdr-bt-shared.dll` (CMake target `mdr-bt_shared`, `libmdr-bt`): the Windows
  Bluetooth connections, Classic RFCOMM and BLE (`mdr-bt/ConnectionWindows.h`).

Building from the pinned submodule, rather than taking upstream's nightly
binaries, means the code we ship is exactly the code that was reviewed, and the
replay tests prove the build against real recorded captures.

## Upstream contract relied on

Quoted from the pinned upstream tree:

- `libmdr/src/CMakeLists.txt`: `add_library(mdr_shared SHARED ${SOURCES} ${INCLUDES} ${GENERATED_SRCS})`
  and `OUTPUT_NAME "mdr-shared"`, compiled with `PRIVATE MDR_BUILDING_SHARED`.
- `libmdr-bt/src/CMakeLists.txt`: `add_library(mdr-bt_shared SHARED ${SRCS})`
  and `set_target_properties(mdr-bt_shared PROPERTIES OUTPUT_NAME "mdr-bt-shared")`.
- `tests/CMakeLists.txt`: `add_executable(mdr_replay_tests Replay.cpp)`,
  `add_executable(mdr_abi_tests ABI.c)`,
  `add_custom_target(mdr_tests DEPENDS ${mdr_test_targets})`, and the guard
  `MDR ABI/replay tests require MDR_BUILD_SHARED=ON`. A post-build step copies
  `mdr-shared.dll` next to each test executable.
- Root `CMakeLists.txt`:
  `option(MDR_BUILD_CLIENT "Build the Sony Headphones Client and platform backends" ON)`,
  `option(MDR_BUILD_SHARED "Build the MDR and Bluetooth shared libraries" ${MDR_SUPPORTS_SHARED_LIBS})`,
  `option(MDR_ENABLE_CODEGEN "Enable codegen targets (requires LLVM)" ON)`,
  `option(MDR_ENABLE_LOG "Enable MDR_LOG logging output in non-Debug builds" OFF)`,
  and `include(CTest)` (which defines `BUILD_TESTING`), followed by
  `add_test(NAME mdr-c-abi COMMAND mdr_abi_tests)` and one
  `add_test(NAME "${replay_test_name}" COMMAND mdr_replay_tests "${replay_test_entry}")`
  per directory under `tests/`. `MDR_BLE` stays at its default `ON`, so the BLE
  connection is compiled in and exported.
- Upstream's own CI (`.github/workflows/cmake.yml`) runs on `windows-latest`:
  `cmake .. -DCMAKE_BUILD_TYPE=$BUILD_TYPE -DMDR_ENABLE_CODEGEN=OFF -DMDR_CLIENT_DEBUGGER=ON -DMDR_ENABLE_LOG=ON -A ${{ matrix.arch }}`,
  then `--target SonyHeadphonesClient`, `--target mdr_tests`, and
  `ctest --build-config $BUILD_TYPE --output-on-failure --no-tests=error`.
  Our workflow follows the same recipe without the ImGui client.

## How the DLLs are built (CI)

Workflow: [engine.yml](<../../.github/workflows/engine.yml>), job
`Build engine (win-x64)`, triggered by `workflow_dispatch` and by pushes that
touch `upstream/**`, `.github/workflows/engine.yml` or `engine/tools/**`.
Steps:

1. `actions/checkout@v4` with `submodules: true` (the pinned commit is public
   upstream, so no extra credentials are needed).
2. `ilammy/msvc-dev-cmd` pinned to commit `0b201ec` (tag `v1`, `arch: x64`)
   puts `cl` and `dumpbin` on `PATH`. The job token is read-only
   (`permissions: contents: read`).
3. Configure and build:

   ```
   cmake -S upstream/SonyHeadphonesClient -B build -A x64 -DMDR_BUILD_CLIENT=OFF -DMDR_ENABLE_CODEGEN=OFF -DMDR_BUILD_SHARED=ON -DBUILD_TESTING=ON -DMDR_ENABLE_LOG=ON
   cmake --build build --config RelWithDebInfo --target mdr_shared mdr-bt_shared mdr_replay_tests mdr_abi_tests
   ```

   - `MDR_ENABLE_CODEGEN=OFF` uses upstream's checked-in generated sources, so
     LLVM is not needed (upstream CI does the same).
   - `BUILD_TESTING=ON` requires `MDR_BUILD_SHARED=ON`.
   - `MDR_STATIC_CRT` and `MDR_DYNAMIC_UCRT` keep their defaults (`ON`): the
     MSVC runtime is linked statically (`/MT`) and only the UCRT comes from
     Windows, so the DLLs need no VC++ redistributable.
   - Configure fetches `{fmt}` 12.1.0 from GitHub with `FetchContent` (a tag
     pin, upstream `contrib/CMakeLists.txt`).
4. `ctest --test-dir build -C RelWithDebInfo --output-on-failure --no-tests=error`,
   output saved to `out/ctest.txt`; a failing test fails the job.
5. `dumpbin /EXPORTS` on both DLLs, saved to `out/mdr-shared-exports.txt` and
   `out/mdr-bt-shared-exports.txt`.
6. [sizes.cpp](<../../engine/tools/sizes.cpp>) is compiled with
   `cl /std:c++20 /EHsc /I upstream/SonyHeadphonesClient/libmdr/include /I upstream/SonyHeadphonesClient/libmdr-bt/include engine/tools/sizes.cpp`
   and run twice: plain, it prints `name sizeof alignof` for every C ABI
   struct the Rust FFI mirrors (`out/struct-sizes.txt`); with `--offsets` it
   prints `struct.field offsetof sizeof` for every field
   (`out/struct-offsets.txt`). It uses the same toolset as the DLLs, so the
   numbers are the layout the DLLs were compiled against. A renamed or removed
   upstream field breaks this compile; an added field must be added to
   `sizes.cpp` by hand.
7. `out/toolchain.txt` (cl, CMake, runner image, VC tools and SDK versions),
   `out/UPSTREAM_COMMIT.txt` (`git -C upstream/SonyHeadphonesClient rev-parse HEAD`)
   and `out/SHA256SUMS.txt` (SHA-256 of every other file in `out/`).
8. `out/` is uploaded as artifact `engine-win-x64`, retained 90 days. After
   that the exact binaries behind these hashes cannot be downloaded again (a
   rebuild is functionally equal but not byte-identical); before shipping an
   installer, attach the artifact to a GitHub Release so it is kept.

Toolchain recorded by the run ([toolchain.txt](<evidence/toolchain.txt>)):

- `Microsoft (R) C/C++ Optimizing Compiler Version 19.51.36260 for x64`
  (`VCToolsVersion: 14.51.36231`), Windows SDK `10.0.26100.0`
- `cmake version 4.4.3`
- runner image `win25-vs2026 20260925.250.1`

## Artifact `engine-win-x64`

From run 38202290392
(push of `b2c1611` on `feat/soundconnect-desktop`, success), the artifact
currently in `engine/bin/RelWithDebInfo/`. Earlier runs
38201407478
and 38201635607
(before `struct-offsets.txt` existed) also passed with identical exports,
sizes and toolchain. Binary hashes differ between runs (PDB GUIDs and
timestamps), so always verify against the run's own
[SHA256SUMS.txt](<evidence/SHA256SUMS.txt>).

| File | Bytes | SHA-256 |
|---|---:|---|
| `ctest.txt` | 749 | `21c1af1ef0ab4cba7298688cc30c601b45901c72a6c517ae179dc7227b8eb9ba` |
| `mdr-bt-shared-exports.txt` | 1,604 | `db3f6d5c848a8a5ce131edceb230695969e09486d90af0de5a72851abcf10ca4` |
| `mdr-bt-shared.dll` | 162,816 | `935567b0f34f0069a52a4e14e31427808b76e1bce9b1277f192a2d9b544725fe` |
| `mdr-bt-shared.lib` | 3,274 | `49cc55b5a9c832ce0305348aa25d4588843242c4535ef6f34dd541ec79e3cbf8` |
| `mdr-bt-shared.pdb` | 11,399,168 | `e4b162f7806d606e1eaac1c0f7fd3ad248aaac25b0b2199695e9547ad25f2c4c` |
| `mdr-shared-exports.txt` | 5,546 | `463d894d963d3a55b44ac7cce55e36ee04017c5f8e6478d8ccd6515f9480bff8` |
| `mdr-shared.dll` | 596,480 | `39eefb01c5a902c84304dd9abe22d1a354de232c998e669db4c2b7cfead069f4` |
| `mdr-shared.lib` | 17,386 | `5b31ab2a436c25c114c182c2179ca927b58b7928acae9bcb0926dfdddf1fad7d` |
| `mdr-shared.pdb` | 8,253,440 | `a91430a03f3028945cdfc97d5b1e03fad3fd7a54790e7bb69b72060fffaf23c9` |
| `mdr_abi_tests.exe` | 55,296 | `9e0d3ab69b03428f1bd210a16d70b499916125c45aaf5bd64d49b42537599e3f` |
| `mdr_replay_tests.exe` | 125,440 | `99485043967521cc14c88d98eb38f16b090fe648042fa286cafaa1d00b22721f` |
| `struct-offsets.txt` | 2,097 | `56396940a906a27cb1765990ae64f126c331ce11adabad06a333e2a37709ab8a` |
| `struct-sizes.txt` | 421 | `dcb81bba1ff1d53ec289231027936f5ffeb41c2683e2308da24b3738d11b3db7` |
| `toolchain.txt` | 225 | `32258d20b36c326bf4d82e84d6b79a8a194f019f86ba2f3fcb689f395c2a4cfc` |
| `UPSTREAM_COMMIT.txt` | 40 | `75e95058d5b9c900b88e0fdff1ba607cf1c5a455daf93938247c1b8d44fee111` |

`UPSTREAM_COMMIT.txt` contains `4c91fe69711ce638a34e066d9bdcfaff504bbec8`.

## Test results

- **CI ctest** ([ctest-upstream.txt](<evidence/ctest-upstream.txt>)):
  `100% tests passed out of 6`: `mdr-c-abi`, `WF-1000XM5-6.1.0`,
  `WF-LC900-2.0.3`, `WF-LC900-2.0.3-equalizer`, `WF-LC900-2.0.3-listening`,
  `WH-1000XM3-4.5.2`.
- **Local replay on the maintainer's PC** with the CI-built binaries
  ([replay-xm3-local.txt](<evidence/replay-xm3-local.txt>)):
  `mdr_replay_tests.exe upstream\SonyHeadphonesClient\tests\WH-1000XM3-4.5.2`
  exits 0 and prints `Replayed 187 packet(s) from upstream\SonyHeadphonesClient\tests\WH-1000XM3-4.5.2`,
  with no `FAIL:` lines; `mdr_abi_tests.exe` also exits 0 (same file). The CI
  binaries therefore load and run on this machine without a local MSVC build.

## Exports

[mdr-shared-exports.txt](<evidence/mdr-shared-exports.txt>): 61 functions.
[mdr-bt-shared-exports.txt](<evidence/mdr-bt-shared-exports.txt>): 6 functions.
They were compared name by name with every `MDR_API` declaration in
`libmdr/include/mdr-c/{Base,Connection,Headphones}.h` (61 = 1 + 8 + 52) and
`libmdr-bt/include/mdr-bt/ConnectionWindows.h` (6, including the three
`MDR_BLE` functions): **no declared function is missing and nothing extra is
exported.**

Reading note: `dumpbin` shows `mdrConnectionWindowsGet` and
`mdrConnectionWindowsBLEGet` as `= ??$IID_PPV_ARGS_Helper...`. That is the
linker's identical-code folding (`/OPT:ICF`, set by upstream): both functions
are `return &instance->mdrConn;` with `mdrConn` as the first struct member,
which is byte-identical to an unrelated identity helper. The exports are
correct; the alias is only the name dumpbin picks for the shared address.

## Struct layouts (x64, MSVC 19.51)

From [struct-sizes.txt](<evidence/struct-sizes.txt>). Every field's offset
and size is in [struct-offsets.txt](<evidence/struct-offsets.txt>) (67
fields). The Rust `#[repr(C)]` mirrors must assert both, so a wrong field order
or type fails a test instead of corrupting data at runtime. Offsets worth
noticing: `MDRPairedDevice.name` is at 26 (two 4-byte booleans, then the
18-byte MAC), `MDRPairedDeviceAction.device_id` is a pointer at 8, and
`uint8_t` fields followed by 4-byte fields leave padding (for example
`MDRSafeListening.preview` at 4).

Ownership note for the FFI: each DLL links its own static CRT, so memory the
engine allocates must be released only through the engine's own functions
(`mdrHeadphonesDestroy`, `mdrConnectionFreeDevicesList`,
`mdrConnectionWindows*Destroy`), never by Rust or by the other DLL.

| Struct | sizeof | alignof |
|---|---:|---:|
| `MDRConnection` | 72 | 8 |
| `MDRDeviceInfo` | 146 | 1 |
| `MDRModel` | 12 | 4 |
| `MDRBattery` | 16 | 4 |
| `MDRPlayback` | 8 | 4 |
| `MDRPlaybackCommand` | 4 | 4 |
| `MDRNoiseControl` | 28 | 4 |
| `MDRSpeakToChat` | 12 | 4 |
| `MDRListening` | 8 | 4 |
| `MDREqualizer` | 28 | 4 |
| `MDRPairedDevice` | 156 | 4 |
| `MDRPairedDeviceAction` | 24 | 8 |
| `MDRPairing` | 4 | 4 |
| `MDRGeneralSettingInfo` | 12 | 4 |
| `MDRGeneralSetting` | 8 | 4 |
| `MDRAssignableControl` | 12 | 4 |
| `MDRPower` | 20 | 4 |
| `MDRVoiceGuidance` | 8 | 4 |
| `MDRConnectionMode` | 4 | 4 |
| `MDRSafeListening` | 8 | 4 |

## Rebuild and fetch

- **Rebuild:** push a change under `upstream/**`, `engine/tools/**` or the
  workflow file, or run `gh workflow run engine.yml --ref <branch>`; watch it
  with `gh run watch <id>`.
- **Fetch:** [fetch-engine.ps1](<../../tools/fetch-engine.ps1>) finds the latest
  successful `engine.yml` run on the current branch (or takes `-RunId`) and
  warns if that run was built from a different commit than local `HEAD`. It
  downloads `engine-win-x64` with `gh run download` into
  `engine/bin/.fetch-staging/`, verifies every line of `SHA256SUMS.txt` (and
  rejects files the manifest does not list), checks that
  `UPSTREAM_COMMIT.txt` equals the submodule pin recorded in `HEAD`
  (`git rev-parse HEAD:upstream/SonyHeadphonesClient`), and only then replaces
  `engine/bin/RelWithDebInfo/` and prints the file list. A failed download or
  check leaves the previous DLLs in place. It needs an
  authenticated `gh`. `engine/bin/` and `engine/build/` stay git-ignored; the
  Rust `build.rs` (plan Task 3) links from `engine/bin/RelWithDebInfo/`.
- **Local build on a machine with VS 2022:**
  [build-engine.ps1](<../../tools/build-engine.ps1>) configures the same flags
  into `engine/build/`, picks the newest Visual Studio instance that has MSVC
  via `vswhere` (CMake ignores instances reported as `isComplete: 0`), builds
  the same four targets and copies the DLLs, import libraries and
  `mdr_replay_tests.exe` to `engine/bin/<Config>/`. It does not produce the
  evidence files or PDBs; prefer CI for anything shipped.
- **Upgrade upstream:** review the new upstream commit, then
  `git -C upstream\SonyHeadphonesClient fetch` and `checkout <commit>`,
  `git add upstream/SonyHeadphonesClient`, push (CI rebuilds), run
  `tools/fetch-engine.ps1`, re-check exports, struct sizes and offsets against the Rust
  mirrors, and update this page and the security review with the new commit.

## History

- 2026-10-11, local attempt: CMake 4.4.4 (winget) with the VS 2019 Build Tools
  (MSVC 19.29.30151.0, toolset 14.29.30133). CMake first could not see the
  VS 2019 instance (`vswhere` reports it `isComplete: 0`), so
  `build-engine.ps1` was taught to pass `-G` and `CMAKE_GENERATOR_INSTANCE`.
  Compilation then crashed, verbatim from
  [build-msvc-14.29-ice.txt](<evidence/build-msvc-14.29-ice.txt>):

  ```
  \libmdr\src\HeadphonesV2.cpp(1027): fatal error C1001: Internal compiler error.
    (compiler file 'D:\a\_work\1\s\src\vctools\Compiler\Utc\src\p2\main.c', line 213)
  ```

  Line 1027 opens the C++20 coroutine `MDRHeadphones::RequestAlertResponseV2`;
  the VS 2019 optimizer back end cannot handle upstream's coroutines. Upstream
  source is not patched by policy.
- Installing VS 2022 Build Tools needs interactive admin approval on this PC,
  which the maintainer chose not to deal with. Upstream itself builds on
  `windows-latest`, so the build moved to GitHub Actions in the private repo
  `soundconnect-desktop`, where it passed on the first run.
