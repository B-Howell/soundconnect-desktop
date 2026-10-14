# SoundConnect Desktop - Live Verification 0.1.6

Purpose: the record of the 2026-10-13 live check of 0.1.6 against the maintainer's
WH-1000XM4 (`AA:BB:CC:12:34:56`, firmware 2.9.0). It covers the dropout fixes,
the connection-quality confirmation with auto-reconnect, upscaling, the
Equalizer page and the Windows audio page.

## Build under test

- Commit `a4d88ed` (`build: installer 0.1.6`), on top of `29f7646`
  (`fix: integration review follow-ups`).
- Installer: `src-tauri/target/release/bundle/nsis/SoundConnect Desktop_0.1.6_x64-setup.exe`
  (7,407,860 bytes), SHA-256
  `4702209836131DBFBEAB54D2B20663D286AE8FA418525F0B2F9D98CE9FC7CFCA`.
  It was not installed from the agent session; the maintainer installs it by
  double-clicking.
- Before the build:
  - typecheck clean;
  - Vitest 299/299 (45 files);
  - `cargo clippy --workspace --all-targets -- -D warnings` clean;
  - `cargo test --workspace` 101 passed, 2 ignored.

## Result: the headphones never connected, so nothing device-side was run

The XM4's Bluetooth "connected" device property
(`{83DA6326-97A6-4088-9453-A1923F573B29} 15`) and the "Headphones
(WH-1000XM4)" audio endpoint were polled every 20 s:

- the first window ran 20:42-20:52 (while the review fixes and the build ran);
- the second window ran 20:53-21:03, with the release exe ready.

Every sample in both windows read `connected=False endpoint=Unknown`. Neither
`soundconnect-desktop` nor `SonyHeadphonesClient` was running.

As a result, none of the checks below reached the device:

| Check | Status |
| --- | --- |
| (a) Speak-to-Chat on/off x3, link stays up | not run |
| (b) Connection quality -> banner -> OK -> drop -> auto-reconnect within 20 s, then back to "Priority on sound quality" | not run |
| (c) Upscaling on/off x3 | not run |
| (d) Equalizer page shows the real preset and curve; Bass, then back | not run |
| (e) Windows audio: stereo endpoint active, summary pill; enhancements off -> on -> off | partly: page read with the XM4 absent (below); enhancements not toggled, because the endpoint was not present |

## What was checked with the release exe (XM4 absent)

`src-tauri/target/release/soundconnect-desktop.exe` was started at about 21:04
with `SOUNDCONNECT_PACKET_LOG=1` and
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9334`.

stderr showed:

```
engine: idle at launch autoConnect=false remembered=AA:BB:CC:12:34:56
command: engine_status -> Disconnected
command: engine_snapshot -> none
```

The navigation rail over CDP read "Status | Sound | Equalizer | Noise control
| System | Devices | Windows audio | Settings".

The Windows audio page (clicked over CDP) showed:

- the summary pill "Set up for music";
- the not-connected note: "The headphones are not connected to Windows now.
  Settings show their last known state; ...";
- Hands-Free Off (recommended Off);
- default playback and playback for calls: PreSonus Eris (Realtek(R) Audio);
- microphone for calls: Snowball;
- audio enhancements Off;
- spatial sound Unknown;
- mono Off; ducking "Do nothing";
- format 48 kHz, 16-bit;
- exclusive mode "Allowed, with priority";
- absolute volume On.

No setting was changed. Capture (DPI-aware `PrintWindow`, 1493 x 997):
(screenshot removed before publication).

The release exe was then stopped and the installed app was restarted from
`%LOCALAPPDATA%\SoundConnect Desktop\soundconnect-desktop.exe`. Its file
version still reads 0.1.2, so the maintainer's installed copy predates 0.1.5 and 0.1.6.

## How to run it when the XM4 is connected

1. Stop `soundconnect-desktop` and `SonyHeadphonesClient`, which hold the
   RFCOMM channel.
2. Start the release exe with the two environment variables above, and
   capture stderr.
3. Drive the UI over CDP on port 9334.
4. Save each capture as
   `docs/renderer/screenshots/task29-live-<page>.png`.

Expected per check:

- (a) Each switch produces `f8 05 01 0x`, then `f9 05 01 0x` and
  `f9 05 02 00`. The log line
  `engine: skipped a frame libmdr could not parse (#n on this link)` appears.
  The status stays `ready`.
- (b) `engine:alert` with `CONFIRM_CONNECTION_MODE_CHANGE`, and the banner
  appears. On OK, `e8 01 00 0x` is sent, then `e9 ...`, then the link is lost
  and the status shows `connecting` with `reconnectingAfterSettingChange`.
  `ready` should return within 20 s. Repeat for "Priority on sound quality",
  the maintainer's preference.
- (c) `e8 01 01 0x` / `e9 ...` each time, with no drop.
- (d) The preset and the five-band curve match `engine_snapshot`. Bass sends
  the EQ preset write, the device echoes it, and the original preset is
  restored afterwards.
- (e) The stereo endpoint is `OK` (active) and the summary pill is shown.
  Enhancements off -> on -> off, each read back.
