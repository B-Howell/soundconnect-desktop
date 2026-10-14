# SoundConnect Desktop - Live Menu Verification (0.1.1)

Purpose: the record of the live check of the menus added on 2026-10-12
(Ambient Sound Control slider, Focus on voice, Speak-to-Chat, connection
quality, automatic pause, multipoint) against the maintainer's WH-1000XM4
(`AA:BB:CC:12:34:56`) through the installed 0.1.1 build.

## Build under test

- Installer: `src-tauri/target/release/bundle/nsis/SoundConnect Desktop_0.1.1_x64-setup.exe`
  (2.03 MiB), SHA-256
  `329AECA6FE678AB0966825A173713685C2CBAF639B6EDF72F22BF3E7DF828AF3`.
- Installed silently (`/S`) to `%LOCALAPPDATA%\SoundConnect Desktop\`. The
  running process loads `mdr-shared.dll` and `mdr-bt-shared.dll` from that
  folder; both are byte-identical to `engine/bin/RelWithDebInfo`.
- Before the build: typecheck clean, Vitest 214/214, clippy `-D warnings`
  clean, `cargo test` 60 passed (1 ignored).

## Result (2026-10-12): not run, headphones not connected

The installed app was launched with `SOUNDCONNECT_PACKET_LOG=1` and
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9334`, stderr
captured to `downloads/installed-run.log` (ignored by git). The XM4's
Bluetooth "connected" property (`{83DA6326-97A6-4088-9453-A1923F573B29} 15`)
was polled every 20 s for about 10 minutes and stayed `False`; the engine
log shows `BluetoothFindFirstDevice FAILED ... error=259` (no connected
device) on every scan. No command was sent, so nothing in the table below is
verified live yet. The app was then restarted normally.

What is verified live earlier: noise control (every change reached the XM4
and was confirmed by the device, see
[noise-control-debug.md](<noise-control-debug.md>)), volume, equalizer,
DSEE and auto power off.

## Still to verify (with the XM4 connected)

| Page | Action | Expected device reply |
| --- | --- | --- |
| Noise control | slider to Noise cancelling, Wind, 10 | NC/ASM notify with the mode / level |
| Noise control | Focus on voice on / off | NC/ASM notify with voice passthrough |
| Sound | Speak-to-Chat on, sensitivity high, timeout long, off | Speak-to-Chat notify with each field |
| Sound | connection quality to quality, back to stability | connection-mode notify; possibly an alert (auto-answered by the service) |
| System | automatic pause off / on | auto-pause notify |
| Devices | multipoint off / on | general setting `MULTIPOINT_SETTING` notify |

Run it the same way (stop `SonyHeadphonesClient` and any running
`soundconnect-desktop` first, since they hold the RFCOMM channel), drive the
UI over CDP on port 9334, save a DPI-aware PrintWindow capture of each page
as `docs/renderer/screenshots/task24-live-<page>.png`, and fill in what was
sent, what the device replied and what the UI showed.
