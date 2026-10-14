---
title: "SoundConnect Desktop - Toggle Dropouts Debug Evidence"
date: 2026-10-13
tags: [core, evidence, dsee, speak-to-chat, connection-mode, xm4]
project: "SoundConnect Desktop"
area: "core"
---

# Toggle dropouts: upscaling, connection quality, Speak-to-Chat (2026-10-13)

The maintainer's report: when he turns upscaling on/off, changes connection quality, or
turns Speak-to-Chat on/off, "the headphones either lose Bluetooth connection and
have to reconnect or they lose connection to the application".

Device: The maintainer's WH-1000XM4 (`AA:BB:CC:12:34:56`, firmware 2.9.0, protocol V1).
Engine DLLs: upstream libmdr 4c91fe6. App: `feat/soundconnect-desktop` at
`b9a19c1` (the 0.1.5 code). His settings had `autoConnect: false`.

## Result

| Action | We send | Device replies | Link afterwards | Cause |
|---|---|---|---|---|
| Upscaling (DSEE) on / off | `AUDIO_SET_PARAM [e8 02 00 01]` / `[e8 02 00 00]` | ACK, `AUDIO_NTFY_PARAM [e9 02 00 01]`, `COMMON_NTFY_UPSCALING_EFFECT [17 00 02 01]` (and the `00` forms) | **kept**: RFCOMM and the audio endpoint stayed up in all 8 toggles | not reproduced; see "Upscaling" |
| Speak-to-Chat on / off | `SYSTEM_SET_PARAM [f8 05 01 01]` / `[f8 05 01 00]` | ACK, `SYSTEM_NTFY_PARAM [f9 05 01 01]`, then `SYSTEM_NTFY_PARAM [f9 05 02 00]` | **app dropped its own link** (the headset stayed connected to Windows) | libmdr rejects the second notify as malformed; the app treated that as a lost link |
| Connection quality (either way) | `AUDIO_SET_PARAM [e8 01 00 01]` (stable) / `[e8 01 00 00]` (sound quality) | ACK, `AUDIO_NTFY_PARAM [e9 01 00 0x]`, then the **device closes RFCOMM** 50-120 ms later; the Windows audio endpoint goes `Unknown` for 2.3-6.8 s | **device dropped both links** | the headset's normal behaviour; the app then stayed disconnected because `autoConnect` was off |

The XM4 raised **no `ALERT_NTFY_PARAM`** for any of the three actions, so our
automatic `NEGATIVE` answer to `DISCONNECT_CAUSED_BY_CONNECTION_MODE_CHANGE` was
never involved (hypothesis 1 rejected). The device enables alerts at init
(`ALERT_SET_STATUS [94 01 00]` is ACKed); it just does not ask for these.

## How the evidence was taken

- Probe: `src-tauri/crates/mdr/examples/toggle_probe.rs`, a new example that
  connects over the legacy RFCOMM UUID, initialises and syncs like the service,
  then stages + commits each scripted action and logs every frame (the
  `SOUNDCONNECT_PACKET_LOG` describer), every engine event, alerts (answered per
  `--alert`), poll errors, and what Windows lists while it reconnects.
  `cargo run -p mdr --example toggle_probe -- AA:BB:CC:12:34:56 --alert negative dsee:on dsee:off`
- Audio endpoint: a PowerShell loop logged every status change of
  `Get-PnpDevice -Class AudioEndpoint` "Headphones (WH-1000XM4)" with
  timestamps (300 ms poll).
- Real app: the debug build of `b9a19c1` with `SOUNDCONNECT_PACKET_LOG=1` and
  `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9334`. The real
  UI was clicked over CDP: Equalizer page "Upscaling" switch on and off, Sound
  page "Speak-to-Chat" switch on and off, Sound page "Priority on stable
  connection" button. `reconnect` was sent through
  `__TAURI_INTERNALS__.invoke('engine_send', ...)` after each drop.
- The installed app (`soundconnect-desktop`, which holds RFCOMM) was stopped
  first and restarted afterwards.

Probe runs (2026-10-13, local time): 1 DSEE on/off (20:07); 2 Speak-to-Chat
on/off (20:07); 3 connection mode -> stable, no alert answer (20:08); 4 ->
quality, `NEGATIVE` policy (20:09); 5 Speak-to-Chat on, DSEE on/off,
Speak-to-Chat off with `--tolerate-malformed` (20:11); 6 -> stable, DSEE on/off,
-> quality (20:12). Real app: 20:14-20:16.

## Speak-to-Chat: an unparsed notify was treated as a lost link

Real app, Speak-to-Chat switch on (20:15:32):

```
command: engine_send SetSpeakToChat { enabled: true, sensitivity: Auto, timeout: Short }
engine: applied SetSpeakToChat { enabled: true, sensitivity: Auto, timeout: Short }
packet: tx len=13 DATA_MDR seq=0 cmd=0xf8(SYSTEM_SET_PARAM) payload=[f8 05 01 01] raw=[3e 0c 00 00 00 00 04 f8 05 01 01 0f 3c]
engine: commit requested
packet: rx len=13 DATA_MDR seq=0 cmd=0xf9(SYSTEM_NTFY_PARAM) payload=[f9 05 01 01] raw=[3e 0c 00 00 00 00 04 f9 05 01 01 10 3c]
packet: rx len=13 DATA_MDR seq=1 cmd=0xf9(SYSTEM_NTFY_PARAM) payload=[f9 05 02 00] raw=[3e 0c 01 00 00 00 04 f9 05 02 00 11 3c]
engine: link lost: mdrHeadphonesPoll failed: Malformed payload (10): Validation failed: data.parameterType == SmartTalkingModeParameterType::MODE_ON_OFF [\libmdr\src\Generated\ProtocolV1T1Validation.cpp:522] (Malformed payload) (None)
engine: status Disconnected ... lastError=mdrHeadphonesPoll failed: Malformed payload (10) ...
```

The UI then showed "Couldn't connect to WH-1000XM4". Speak-to-Chat off did the
same (`[f8 05 01 00]` -> `[f9 05 01 00]`, `[f9 05 02 00]`, link lost). The
probe reproduced it in both directions (run 2), and Windows kept the headset
connected throughout (the endpoint log has no change at 20:07:54 / 20:08:00).

Why:

- `[f9 05 02 00]` is `SYSTEM_NTFY_PARAM`, `SystemInquiredType::SMART_TALKING_MODE`
  (05), `SmartTalkingModeParameterType::PREVIEW_MODE_ON_OFF` (02,
  `ProtocolV1T1.hpp` `enum class SmartTalkingModeParameterType`), value 00.
- libmdr's `HandleSystemParam` (`HeadphonesV1T1.cpp` 421-429) deserialises any
  4-byte `SMART_TALKING_MODE` notify as `NotifySystemParamSmartTalkingModeSetNtfyParam`,
  whose generated validation requires
  `data.parameterType == SmartTalkingModeParameterType::MODE_ON_OFF`
  (`ProtocolV1T1Validation.cpp` 522). The `Deserialize` macro returns
  `SetLastError(...)` = -1, and `PollEvents` returns `mLastErrorCode`
  (`MDR_RESULT_ERROR_MALFORMED_PAYLOAD`).
- By then the frame is already handled: `MoveNext` erases it from the receive
  buffer before `Handle`, and `Handle` sends the ACK first (`case DATA_MDR:
  SendACK(seq);`). No property was overwritten. The link is intact.
- Our service (like upstream's client, `Client.cpp` 2253-2257
  `if (pollResult != MDR_RESULT_OK) { DisconnectWithModal(); ... }`) treated
  every poll error as a lost link and dropped the engine, closing RFCOMM.

Proof that skipping the frame is safe (probe run 5, `--tolerate-malformed`):
after the skipped `[f9 05 02 00]` the device sent
`SYSTEM_NTFY_STATUS [f5 05 00 00]` (handled), DSEE on and off then worked, and
Speak-to-Chat off worked, all on the same link.

The upstream fix belongs in libmdr (handle `PREVIEW_MODE_ON_OFF`, or ignore it,
in `HandleSystemParam`); the submodule is upstream's repository, so it is noted
here rather than patched. Our fix does not depend on it.
A ready-to-paste issue for upstream is in
[upstream-issue-speak-to-chat-preview.md](<../../research/upstream-issue-speak-to-chat-preview.md>)
(not filed; the maintainer decides).

## Connection quality: the headset restarts its links

Probe run 3 (-> stable, alerts not answered):

```
4.379 packet: tx DATA_MDR seq=0 cmd=0xe8(AUDIO_SET_PARAM) payload=[e8 01 00 01]
4.412 packet: rx ACK seq=1
4.495 packet: rx DATA_MDR seq=0 cmd=0xe9(AUDIO_NTFY_PARAM) payload=[e9 01 00 01]
4.544 LINK LOST (poll error): mdrHeadphonesPoll failed: No connection has been established (6): Unable to receive from the device
4.949 init failed: ... No connection has been established   (first RFCOMM reconnect, 0.4 s after the drop)
6.186 packet: tx CONNECT_GET_PROTOCOL_INFO ...               (second attempt, 1.6 s after: accepted)
10.931 ready=true; connectionMode=Stability                  (the change stuck)
```

Audio endpoint: `20:09:01.607 Unknown`, `20:09:04.846 OK` (3.2 s). Run 4 (->
quality, `NEGATIVE` policy): RFCOMM closed 82 ms after the notify, endpoint
`Unknown` 20:09:32.126 -> `OK` 20:09:35.378 (3.3 s), reconnected and ready 6.3 s
after the drop with `Quality`. Run 6 and the real app (20:16:13 -> 20:16:20,
6.8 s) behaved the same. No alert frame (`cmd=0x9x` RX) appeared in any run.

This matches the Sony app, which warns that the headset disconnects and
reconnects to change this setting. The defect was ours: with `autoConnect` off
the service published `Disconnected` and waited for the user.

## Upscaling (DSEE): not reproduced

Eight toggles, all clean: probe runs 1, 5 and 6 (connection mode quality and
stable, Speak-to-Chat off and on) and two real-UI clicks. Each sent exactly one
`AUDIO_SET_PARAM UPSCALING` frame (libmdr `SendCommandACK(t1::SetAudioParamUpscalingParam, ...)`,
`HeadphonesV1.cpp` 630-640; it does not resend the EQ block: the `eqPending`
block only sends what the caller changed), got the ACK, `AUDIO_NTFY_PARAM` and
`COMMON_NTFY_UPSCALING_EFFECT`, and kept both links (no endpoint change).
Hypotheses 2 (DSEE sent as an EQ/connection-mode change) and 3 (a second write
from commit + notify) are rejected: no second frame was written.

What is still possible: The maintainer toggled upscaling in the same session as
Speak-to-Chat or connection quality, whose drops looked like the upscaling's.
If it recurs on the fixed build, the packet log will show which frame preceded
the drop (any frame libmdr cannot parse is now logged as
`engine: skipped a frame libmdr could not parse` instead of dropping the link).

## Fixes

1. **Unparsed frames do not drop the link.** `mdr::Error::is_malformed_payload()`
   (`crates/mdr/src/error.rs`); `Worker::step_live` logs and continues on that
   error instead of returning it. Transport errors still end the link.
2. **Connection quality asks first.** `SetConnectionMode` to a value different
   from the device's is held, and the service emits
   `engine:alert {message: "CONFIRM_CONNECTION_MODE_CHANGE", autoResponse: null, requiresChoice: true}`.
   `respondToAlert {positive: true}` queues the change; `false` discards it and
   republishes the snapshot (undoing the renderer's optimistic change). The
   same value needs no confirmation (libmdr sends nothing). `AlertView` gains
   `requiresChoice` (true for every alert that waits for an answer).
3. **Automatic reconnect after a setting change.** A link lost within 10 s
   (`RECOVERY_TRIGGER`) of applying `SetConnectionMode`, `SetSpeakToChat` or
   `SetDsee` is reconnected to the same address every `recovery_retry` (1 s)
   for `recovery_window` (20 s), even with `autoConnect` off. Meanwhile
   `engine:status` is `{state: "connecting" | "initialising", reason:
   "reconnectingAfterSettingChange", deviceName, address}`; Ready clears it. No
   reconnect in 20 s -> `Disconnected` with `reason: "timeout"`. `disconnect`,
   `reconnect`, `connect` and `forgetDevice` cancel it.

### Renderer text contract

| Engine payload | Renderer shows |
|---|---|
| `engine:alert {message: "CONFIRM_CONNECTION_MODE_CHANGE", autoResponse: null, requiresChoice: true}` | Question banner "Change connection quality?" / "Your headphones disconnect and reconnect to apply it, so audio stops for a few seconds. SoundConnect reconnects to them by itself." OK -> `respondToAlert {positive: true}`, Not now -> `{positive: false}` (`alertCopy.ts`, `useAlertBannerProps.ts`) |
| `engine:status {state: "connecting", reason: "reconnectingAfterSettingChange"}` | "Reconnecting to WH-1000XM4" / "They restarted their Bluetooth connection to apply your setting. This takes a few seconds." (`connectionCopy.ts`, `useConnectionView.ts`); not a failure for a connect attempt (`failureReasonOf`) |

## Regression tests

Fixtures: `src-tauri/fixtures/xm4-toggle-dropouts/`, raw frames from the
real-app log (DSEE, Speak-to-Chat, connection mode -> stable) and from probe
run 4 (connection mode -> quality).

- `xm4_speak_to_chat_notify_libmdr_cannot_parse_does_not_drop_the_link`: the
  XM4 capture replays; the armed responder answers each Speak-to-Chat set with
  the recorded `[f9 05 01 0x]` + `[f9 05 02 00]`. Asserts the two TX payloads,
  the snapshot following each notify, no status change and no reconnect.
  Proved against a broken line: disabling the malformed-payload branch made it
  fail ("timed out waiting for the on notify": the link dropped).
- `xm4_dsee_toggle_sends_one_audio_set_param_and_keeps_the_link`: one
  `[e8 02 00 00]`, no alert, still Ready.
- `connection_mode_change_waits_for_the_users_confirmation`: the alert JSON;
  nothing sent before the answer; Not now sends nothing and republishes; the
  current value needs no alert; OK sends `[e8 01 00 00]`.
- `drop_after_a_connection_mode_change_reconnects_even_with_auto_connect_off`:
  the responder closes the link after the recorded notify (like the live XM4);
  statuses go `connecting`/`initialising` with `reconnectingAfterSettingChange`,
  never `disconnected`, then Ready. Proved against a broken line: never arming
  the recovery made it fail ("timed out waiting for Ready again").
- `no_reconnect_within_the_window_ends_disconnected_with_timeout` and
  `a_drop_without_a_setting_change_does_not_reconnect_with_auto_connect_off`.
- `set_connection_mode_reaches_the_xm4_once_confirmed` (was
  `set_connection_mode_reaches_the_xm4`).
- Renderer: `tests/shell/settingChangeReconnect.test.tsx`.

## Live verification of the fix: pending

The fixed debug build was started at 20:27, but the XM4 had left Windows at
20:18:40 (endpoint `Unknown`, `devices` example: 0 connected devices) and did
not come back within a 10-minute wait (until 20:37:51). The fix is verified by
the replay tests above, which use the recorded device frames, and the
confirmation banner was checked in the browser renderer with the mock engine
(`__engineMock.simulateAlert`). Still to run on the XM4 with the fixed build:

1. Speak-to-Chat on and off: expect `engine: skipped a frame libmdr could not
   parse` after each change and the status to stay `Ready`.
2. "Priority on sound quality": expect the confirmation banner; OK -> the
   drop, `engine: link lost right after a setting change; reconnecting`,
   statuses `Connecting` / `Initialising` with `ReconnectingAfterSettingChange`,
   then `Ready` within a few seconds (autoConnect off). Not now -> no frame.
3. Upscaling on and off: one `e8 02` frame each, no drop.

Note: the last real-app run (20:16:13) left the headset on **"Priority on
stable connection"** (`[e8 01 00 01]`, confirmed by the device). Step 2 restores
"Priority on sound quality".
