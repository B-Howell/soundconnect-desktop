---
title: "SoundConnect Desktop - Noise Control Debug Evidence"
date: 2026-10-12
tags: [core, evidence, noise-control, xm4]
project: "SoundConnect Desktop"
area: "core"
---

# Noise control debug: "no difference when toggling" (2026-10-12)

Report: "there doesn't seem to be any difference when toggling options in the
noise control menu". Device: The maintainer's WH-1000XM4 (`AA:BB:CC:12:34:56`, firmware
2.9.0, protocol V1, `protocolVersion` 0x7000). Engine DLLs: upstream 4c91fe6.

**Result: the engine path works. I could not reproduce the report at the
protocol level.** Every NC / ambient / off / level / focus-on-voice / wind
change made from our UI produced an `NCASM_SET_PARAM` frame. The XM4 ACKed it
and then sent `NCASM_NTFY_PARAM` with the new state. That notify carries the
device's own state, not an echo of what we sent (see "The device reports its own
state" below). No code change was needed in the noise path. What landed instead:

- a packet logger (`SOUNDCONNECT_PACKET_LOG=1`, below) so the next report comes
  with bytes;
- a `engine: commit requested` log line;
- regression tests that pin the frames the live XM4 confirmed (see "Regression
  tests").

## How the evidence was taken

- Debug build `src-tauri/target/debug/soundconnect-desktop.exe` with
  `SOUNDCONNECT_PACKET_LOG=1` and
  `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9334`. The
  renderer was served by `pnpm dev:web`.
- Run 1: the real UI's noise segments were clicked over CDP:
  `[role=radio]` "Ambient", "Off", "Noise cancelling"; the ambient
  `input[type=range]` was set to 10; the focus-on-voice `[role=switch]` was
  clicked. Later in the run the renderer, which another agent was rebuilding,
  hot-reloaded into an error. So focus off, wind and NC were sent through
  `__TAURI_INTERNALS__.invoke('engine_send', ...)`. That is the same Tauri
  command the UI calls.
- Run 2 (the regression fixtures): the same build, through `invoke`: NC (no-op),
  ambient 10, off, NC.
- The installed app (`%LOCALAPPDATA%\SoundConnect Desktop\soundconnect-desktop.exe`,
  built 01:42) was run with stderr redirected, and its UI was clicked over CDP:
  Ambient, Off, NC. Every click produced `engine_send` -> `applied` -> a new
  snapshot, and the radio's `aria-checked` followed the click (it has no
  packet logger, so this run shows no bytes).
- Upstream nightly 5c23c9c (`SonyHeadphonesClient.exe --record
  downloads/upstream-record-xm4-noise`). Its ImGui window was driven by mouse
  clicks at screenshot coordinates: the ambient slider to 10, Enabled off,
  Enabled on, slider to NC.

Frame layout: `3e <type> <seq> <len BE32> <payload> <checksum> 3c`. The
`NCASM_SET_PARAM` payload fields (`ProtocolV1T1.hpp` `SetNcAsmParamNcAsmParam`)
are: `68`, `type 02` (NC+ASM), `ncAsmEffect`, `ncType`, `ncValue`, `asmType`,
`asmId`, `asmValue`. Some values:

- `ncAsmEffect`: 00 OFF, 01 ON, 10 ADJUSTMENT_IN_PROGRESS, 11 ADJUSTMENT_COMPLETION.
- `ncValue` (`NcDualSingleValue`): 02 DUAL (NC), 01 SINGLE (wind), 00 OFF.

## Device capability and state at connect (run 2)

```
tx NCASM_GET_CAPABILITY payload=[60 02]
rx NCASM_RET_CAPABILITY payload=[61 02 02 00 01 02 00 14 01 14]
   ncSettingType=02 DUAL_SINGLE_OFF, ncStep=00, asmSettingType=01 LEVEL_ADJUSTMENT,
   asm list: (00 NORMAL, max 0x14=20), (01 VOICE, max 20)
rx NCASM_RET_STATUS     payload=[63 02 00]
rx NCASM_RET_PARAM      payload=[67 02 01 02 02 01 00 00]   ON, DUAL (noise cancelling)
```

## Our frames and the device replies (run 1 UI clicks, run 2 invoke)

| Transition | Our TX payload | Device reply |
|---|---|---|
| NC -> Ambient (UI segment, fallback level 20) | `68 02 11 01 00 01 00 14` | ACK, `69 02 01 02 00 01 00 14` (ON, NC off, ambient 20) |
| Ambient 20 -> 10 (UI slider) | `68 02 11 01 00 01 00 0a` | ACK, `69 02 01 02 00 01 00 0a` |
| Focus on voice on (UI switch) | `68 02 11 01 00 01 01 0a` | ACK, `69 02 01 02 00 01 01 0a` (asmId VOICE) |
| Focus on voice off | `68 02 11 01 00 01 00 0a` | ACK, `69 02 01 02 00 01 00 0a` |
| Ambient -> Wind | `68 02 11 01 01 01 00 00` | ACK, `69 02 01 02 01 01 00 00` (SINGLE) |
| Wind -> NC | `68 02 11 01 02 01 00 00` | ACK, `69 02 01 02 02 01 00 00` (DUAL) |
| Ambient 20 -> Off (UI segment) | `68 02 00 01 00 01 00 14` | ACK, `69 02 00 02 00 01 00 14` (OFF) |
| Off -> NC (UI segment) | `68 02 01 01 02 01 00 00` | ACK, `69 02 01 02 02 01 00 00` |
| run 2: NC -> NC | no frame (`is_dirty()` false: nothing to change) | - |
| run 2: NC -> ambient 10 | `68 02 11 01 00 01 00 0a` | ACK, `69 02 01 02 00 01 00 0a` |
| run 2: ambient 10 -> Off | `68 02 00 01 00 01 00 0a` | ACK, `69 02 00 02 00 01 00 0a` |
| run 2: Off -> NC | `68 02 01 01 02 01 00 00` | ACK, `69 02 01 02 02 01 00 00` |

Each change logged the whole chain: `command: engine_send ...` ->
`engine: applied ...` -> `packet: tx ... NCASM_SET_PARAM` ->
`engine: commit requested` -> `packet: rx ... ACK` -> a new snapshot
(`noise=Ambient/20`, `Off/20`, `Cancelling/20`, `Ambient/10`, `Wind/10`, ...) ->
`packet: rx ... NCASM_NTFY_PARAM` -> our ACK.

## Upstream's frames for the same transitions

| Transition (upstream UI) | Upstream TX payload | Device reply |
|---|---|---|
| NC -> ambient 10 (slider click) | `68 02 10 01 00 01 00 0a` (ADJUSTMENT_IN_PROGRESS) | ACK only, **no notify** |
| -> Off (Enabled unchecked) | `68 02 00 01 00 01 00 0a` | ACK, `69 02 00 02 02 01 00 00` |
| -> On (Enabled checked; level now -1) | `68 02 01 01 02 01 00 00` | ACK, `69 02 01 02 02 01 00 00` |

Our Off and Off -> NC frames are byte-identical to upstream's: whole frames
`3e 0c 00 00 00 00 08 68 02 00 01 00 01 00 0a 8a 3c` (upstream ordinal 324) and
`3e 0c 01 00 00 00 08 68 02 01 01 02 01 00 00 84 3c` (ordinal 328). The ambient
frame differs only in `ncAsmEffect`: upstream sends 0x10, we send 0x11.

Upstream gets 0x10 because `client/Client.cpp` 1618 sets
`gState.mNoise.changing_asm_level = sliderChanged && ImGui::IsItemActive();`.
`HeadphonesV1.cpp` 549-550 then serialises that as
`if (state.mNcAsmChangingLevel.submitted) payload.ncAsmEffect = t1::NcAsmEffect::ADJUSTMENT_IN_PROGRESS;`.
Our `noise_request` always clears `changing_asm_level`, so we send
`ADJUSTMENT_COMPLETION` (`else if (!state.mNcAsmEnabled.pending())`). When the
mode turns on, we send `ON` instead.

## The device reports its own state

After upstream's ambient-10 frame, upstream's Off reply was
`69 02 00 02 02 01 00 00`: ncValue DUAL, asm level 0. The XM4 was still in its
NC configuration, so it never applied the 0x10 frame. After our ambient-10
frame, our Off reply was `69 02 00 02 00 01 00 0a`: NC off, ambient 10 kept.
So the notify reports what the device holds, not what was sent. Every notify in
our table above shows the device in the requested state.

## Candidates checked

| Candidate | Finding |
|---|---|
| (a) V1 translation differs from upstream | No. Mode ON (1) with level 255 / 0 / 1..20, and OFF, match upstream's `gState.mNoise` handling (`Client.cpp` 1597-1607); the bytes match upstream's for Off and NC. |
| (b) `is_dirty()` false so no commit | Only when nothing changes (NC -> NC). Every real change logged `engine: commit requested`. |
| (c) applied while not ready and dropped | No. `apply_pending` waits on `is_ready()`. Device commands are dropped only when not connected (`engine: ignored ...: not connected`). |
| (d) libmdr V1 needs `changing_asm_level` | The opposite: setting it produces 0x10, which the XM4 ignores. The new unit test `v1_requests_are_completed_changes_never_in_progress` guards against it. |
| (e) wrong NC/ASM setting type for the XM4 | libmdr sends `ncType` 01 (LEVEL_ADJUSTMENT), while the XM4 declares and reports 02 (DUAL_SINGLE_OFF). It still applies `ncValue` (its notifies show 02 / 01 / 00 as requested). This is a real mismatch, but it is not proven to matter. Changing it needs a libmdr rebuild. Left as is. |
| (f) optimistic UI hides a rejected send | No rejection occurred: no `rejected` line, and the device notify followed every change. |

## What I could not verify

- **Audio.** I did not listen. The evidence is the device's own notifies. If
  the maintainer still hears no change, the next step is `SOUNDCONNECT_PACKET_LOG=1`
  with his clicks. Also worth trying: pressing the headset's NC/AMB button,
  which shows the device's native frame for each mode.
- The tray menu's noise items were not clicked: the icon sits in the Windows
  overflow flyout, and UI Automation could not open its menu reliably. They
  send the same `EngineCommand::SetNoise` through `EngineService::send`
  (`tray.rs` `on_menu_event`).
- I did not watch what the maintainer did when he made the report. Toggles made while
  the service is not connected are logged as `engine: ignored ...` and dropped.

## Packet logger

`SOUNDCONNECT_PACKET_LOG=1` installs `Engine::set_packet_callback` (a safe
wrapper over `mdrHeadphonesSetPacketCallback`, `crates/mdr/src/engine.rs`).
`mdr::packet::describe_frame` then logs every frame:

```
packet: tx len=17 DATA_MDR seq=1 cmd=0x68(NCASM_SET_PARAM) payload=[68 02 11 01 00 01 00 0a] raw=[3e 0c 01 00 00 00 08 68 02 11 01 00 01 00 0a 9c 3c]
```

Command names come from the V1 table-1 enum (`ProtocolV1T1.hpp`
`enum class Command`). They are shown only for `DATA_MDR` frames.

## Regression tests

The fixtures are real recordings (see `src-tauri/fixtures/`):

- `WH-1000XM4-2.9.0/`: the upstream recorder's RX frames from connect to idle
  (ordinals 1-321, before any change).
- `xm4-noise-control/`: run 2's TX frames and the device's replies
  (`soundconnect-01..06`), plus upstream's frames 322, 324, 326, 328 and 330.

Tests:

- `engine_service::tests::xm4_nc_to_ambient_10_to_off_to_nc_sends_the_frames_the_live_device_confirmed`.
  The XM4 capture plays through the service. An armed responder ACKs each DATA
  frame and returns the recorded device notify for each recorded TX payload.
  The test asserts:
  - the three `NCASM_SET_PARAM` payloads equal run 2's;
  - Off and NC equal upstream frames 324 and 328;
  - upstream's ambient frame 322 differs only in `ncAsmEffect` (0x10);
  - the snapshot follows the device reply after each step.

  Proved against a broken line: setting `changing_asm_level = true` in
  `noise_request` made it fail.
- `noise_view::tests::v1_requests_are_completed_changes_never_in_progress`.
