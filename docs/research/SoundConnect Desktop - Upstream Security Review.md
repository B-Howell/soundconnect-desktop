---
title: "SoundConnect Desktop - Upstream Security Review"
date: 2026-10-11
tags:
  - research
  - security
project: "SoundConnect Desktop"
area: "research"
---

# SoundConnect Desktop - Upstream Security Review

Review of [mos9527/SonyHeadphonesClient](https://github.com/mos9527/SonyHeadphonesClient)
at commit `4c91fe69711ce638a34e066d9bdcfaff504bbec8` (branch `v1-compat`,
pushed 2026-10-10), done 2026-10-11 before installing its Windows nightly build
on the maintainer's PC and before adopting its protocol engine (`libmdr`, `libmdr-bt`)
for this project. Every statement is an **observation** from the cloned source
(`upstream/SonyHeadphonesClient`) or from the downloaded binary unless marked
**inference**.

## Verdict

No malicious or privacy-hostile behaviour found. The program talks only to the
headphones over Bluetooth, writes nothing to disk unless asked to record a
capture, requests no elevation, has no updater or telemetry. Residual risks are
the ordinary ones for an unsigned hobby build and are listed at the end.

## What was checked and what was found

| Check | Method | Result |
| --- | --- | --- |
| Network use | `grep` for WinHTTP/WinINet/curl/`getaddrinfo`/`socket(`/`connect(` across `client`, `libmdr`, `libmdr-bt` | Only Bluetooth sockets: Winsock `AF_BTH` RFCOMM in `libmdr-bt/src/Windows/ConnectionWindows.cpp`, WinRT BLE in `ConnectionWindowsBLE.cpp`, BlueZ on Linux, Web Bluetooth/Serial on Emscripten. No HTTP client anywhere. |
| URLs in buildable code | regex for `https?://` | Only comments/credits, the Windows DPI manifest schemas, and four Google Noto CJK font URLs used by the **web** build (`client/Platform/Emscripten/config.js.in`), not by the Windows exe. |
| URLs in the shipped exe | `grep -a` + UTF-16 scan of `SonyHeadphonesClient.exe` | Only the two `schemas.microsoft.com` manifest URLs. |
| Persistence / privilege | `grep` for registry, `CreateProcess`, `ShellExecute`, hooks, startup; read `client/Platform/Windows/app.manifest` | None. Manifest declares only `dpiAware` / `PerMonitorV2`. No `requestedExecutionLevel`. |
| Disk writes | `grep` for `ofstream`/`fopen`/`CreateFile`/`WriteFile`/`IniFilename` outside generated code | `CreateFileW` is read-only (memory-mapping fonts). ImGui's ini is disabled (`io.IniFilename = nullptr`). Packet captures are written only with `--record <folder>` or when the user accepts the prompt after a disconnect error (`tests/README.md`). |
| Checked-in binaries | `git ls-files` by extension | None executable. The `.bin` files are recorded Bluetooth frames under `tests/`. |
| Third-party code | `contrib/CMakeLists.txt` | Three libraries fetched at configure time by git tag: fmt `12.1.0`, SDL `release-3.2.26`, Dear ImGui `v1.92.7`. No submodules. |
| How the nightly is built | `.github/workflows/cmake.yml` | GitHub Actions builds from the repository source with `-DMDR_ENABLE_CODEGEN=OFF -DMDR_CLIENT_DEBUGGER=ON -DMDR_ENABLE_LOG=ON`, runs the packet replay tests, uploads the exe as an artifact. The artifact used (run `38058742485`, artifact `11672606301`) belongs to the exact commit reviewed. |
| Imports of the exe | DLL name scan | Standard Win32/CRT, DirectX/OpenGL/Vulkan names from SDL's renderer backends, `ws2_32`, `SETUPAPI`, `cfgmgr32`, WinRT shims. `steam_api64.dll` appears as a string because SDL probes for it; nothing links it. |
| Antivirus | Windows Defender `MpCmdRun -Scan -ScanType 3` (signatures 2026-10-11) | "found no threats". |
| Code signature | `Get-AuthenticodeSignature` | **NotSigned.** Expected for a hobby CI build; SmartScreen may warn on first launch. |
| PE resources | REA `inspect_pe_resources` (Evidence `ev_cec03b84bca17cc734055c0ba9608b1d21d968d90347c98c08c49a8d29eecc1f`) | One resource: the manifest (RT_MANIFEST, 681 bytes). No icon group, no embedded payloads. |

Downloaded file: `SonyHeadphonesClient-win-x64.zip` (1,505,694 bytes) ->
`SonyHeadphonesClient.exe` (3,956,224 bytes), SHA-256
`65d613667901034e105af7e75e50c47572157de909aa8c6686a8525c99750356`.

## Residual risks and how they are handled

- **Unsigned binary.** Mitigation: it was downloaded from GitHub's artifact API
  for the reviewed commit over the authenticated `gh` CLI, hashed, scanned, and
  the hash is recorded in `%LOCALAPPDATA%\Programs\SonyHeadphonesClient\VERSION.txt`.
- **Dependencies pinned by tag, not by commit hash.** A moved tag upstream could
  change a build. Acceptable for a desktop tool; this project pins the upstream
  submodule by commit and builds the engine locally.
- **The Protocol Debugger can send arbitrary frames to the headphones.** It is
  compiled into nightly builds. Misuse could put the headset into a bad state.
  the maintainer should not use it. SoundConnect Desktop does not expose it.
- **Captures contain private data** (paired phone names and addresses, track
  metadata). Upstream ships `tooling/scrub-capture.py`; this project scrubs
  every capture before it enters `tests/fixtures/`.

## Why this review matters for the build plan

The plan (`docs/plans/2026-10-11-soundconnect-desktop.md`) loads this
project's protocol engine as DLLs built from the same commit. The findings
above (Bluetooth-only I/O, no persistence, MIT licence) are the basis for
trusting that engine inside a Tauri process.

## Installed client

Reviewed nightly installed 2026-10-11 at
`%USERPROFILE%\AppData\Local\Programs\SonyHeadphonesClient\SonyHeadphonesClient.exe`
with a Start Menu shortcut `SonyHeadphonesClient`. First run with `--con`
found the XM4 (`AA:BB:CC:12:34:56`) after a manual Refresh, the XM5 service
UUID failed (`SO_ERROR=10049`), the legacy UUID connected, and the maintainer confirmed
the controls work. Log: `downloads/first-run.err.log` (not committed).
