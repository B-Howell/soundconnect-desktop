---
title: "SoundConnect Desktop - Testing"
date: 2026-10-12
tags: [engine, rust, testing]
project: "SoundConnect Desktop"
area: "testing"
---

# SoundConnect Desktop - Testing

## Replay principle

The engine is tested against **recorded device sessions, never hand-written
packet shapes**. A capture directory holds one file per received frame.
[ReplayTransport](<../../src-tauri/crates/mdr/src/replay.rs>) feeds those bytes to
the real `mdr-shared.dll` through the same `MDRConnection` trampolines a live
Bluetooth transport uses ([transport.rs](<../../src-tauri/crates/mdr/src/transport.rs>)).
libmdr's own init and sync coroutines then run against them. The test
assertions read state back through the public [Engine](<../../src-tauri/crates/mdr/src/engine.rs>)
API and the [Snapshot](<../../src-tauri/crates/mdr/src/snapshot.rs>) JSON. This
follows upstream `tests/Replay.cpp`, with two differences. Our driver also calls
`request_init` and `request_sync` the way `client/Client.cpp` does; upstream
only pushes frames and checks that each one dispatches. And all RX frames are
available at once, as on a real stream, instead of one frame per step.

Pinned values were observed on the first green run (the snapshot was printed
and read), then written into the tests. Nothing was guessed.

The driver is [tests/common/drive.rs](<../../src-tauri/crates/mdr/tests/common/drive.rs>):
`create -> request_init -> poll`. On `InitializeComplete` it calls
`request_sync`. It stops after 64 consecutive idle polls once every recorded
byte has been consumed, with a hard cap of 20,000 polls, and fails on any poll
error. Capture paths come from
[tests/common/mod.rs](<../../src-tauri/crates/mdr/tests/common/mod.rs>).

## Fixtures

All fixtures are the upstream MIT captures in
`upstream/SonyHeadphonesClient/tests/` (submodule commit `4c91fe6`). They are
already scrubbed of personal data by upstream `tooling/scrub-capture.py`, which
is why the unique id reads `AA:BB:CC:00:00:01`.

### WH-1000XM3 firmware 4.5.2 (primary)

- Path: `upstream/SonyHeadphonesClient/tests/WH-1000XM3-4.5.2/`, with 187 RX
  files and no TX files.
- First file:
  `mdr-packet-1791485921245-000001-rx.type-DATA_MDR-0c.seq-00.cmd-CONNECT_RET_PROTOCOL_INFO-01.bin`.
  Its bytes are `3e 0c 00 00 00 00 04 01 00 40 10 61 3c`: `>` start, type
  `0x0C` DATA_MDR, seq 0, size 4, payload `01 00 40 10`, checksum `0x61`, and
  `<` end. The 4-byte `CONNECT_RET_PROTOCOL_INFO` payload marks protocol V1.
- The upstream CLI replay of this directory printed `Replayed 187 packet(s)`
  ([evidence](<../tooling/evidence/replay-xm3-local.txt>)).

Values pinned from the XM3 replay
([engine_replay.rs](<../../src-tauri/crates/mdr/tests/engine_replay.rs>)):

| Item | Observed |
|---|---|
| Events | `InitializeComplete` (exactly once), then `SyncComplete`; an `Alert` is also seen |
| State after replay | initialized, ready, not dirty; all RX bytes consumed |
| `texts.modelName` / `firmwareVersion` | `WH-1000XM3` / `4.5.2` |
| `texts.modelSeries` / `modelColor` / `uniqueId` | `PREMIUM` / `BLACK` / `AA:BB:CC:00:00:01` |
| `texts.lastAlert` | `DISCONNECT_CAUSED_BY_CONNECTION_MODE_CHANGE` |
| `model` | `protocolVersion` 16400 (`0x4010`), `audioCodec` `ldac`, `modelColor` 1 |
| Batteries | one `main` battery, present, 100%, not charging |
| Available features (13) | AMBIENT_SOUND, AUTO_POWER_OFF, BATTERY_SINGLE, CONNECTION_MODE, DSEE, EQUALIZER, GENERAL_SETTINGS, IDENTITY, NOISE_CANCELLING, PLAYBACK_CONTROL, PLAYBACK_METADATA, PLAYBACK_VOLUME, VOICE_GUIDANCE (the other 21 are `unavailable`, none `unknown`) |
| Noise control | mode `cancelling` |
| Equalizer | preset `off`, 5 bands all 0, DSEE `hx` enabled |
| Presets (12) | off, bright, excited, mellow, relaxed, vocal, treble, bass, speech, custom, user1, user2 (names are empty on V1) |
| General settings | index 1, `TOUCH_PANEL_SETTING`, writable, `true` |
| Power / voice guidance / connection mode | auto-off 5 min / enabled / `quality` |
| Playback volume | 24 |
| `null` in snapshot | assignableControls, safeListening, wearingStatus, sourceSwitchControl (unsupported on XM3) |

Note: `model.protocolVersion` is **not** 1. It is the device's reported
protocol info. The `MDR_PROTOCOL_V1` family is `Engine::protocol()` and the
snapshot's top-level `"protocol": "V1"`.

`xm3_setters_stage_and_commit` changes noise control to ambient level 10 and
checks that `is_dirty()` turns true. It then calls `commit()` and checks that
libmdr sent a request. The capture has no reply to that request.

### Every other upstream capture

`every_capture_replays_without_error` replays each folder. It requires the
folder list to match its table exactly, so a new capture fails the test until
someone adds it. The protocol is inferred from the first `CONNECT_RET_PROTOCOL_INFO`
payload, as upstream `Replay.cpp` does (4 bytes = V1, 8 bytes = V2), and is also
asserted. Every folder must replay with no poll error, consume all of its bytes,
report a non-zero `protocolVersion` (upstream's own assertion) and give the
expected model name.

| Folder | Protocol | Model name | Init | Sync |
|---|---|---|---|---|
| WF-1000XM5-6.1.0 | V2 | WF-1000XM5 | no | no |
| WF-LC900-2.0.3 | V2 | LinkBuds Clip | yes | no |
| WF-LC900-2.0.3-equalizer | V2 | LinkBuds Clip | yes | yes |
| WF-LC900-2.0.3-listening | V2 | LinkBuds Clip | yes | yes |
| WH-1000XM3-4.5.2 | V1 | WH-1000XM3 | yes | yes |

Why some recordings stop early:

- **XM5**: the last init request, `LOG_SET_STATUS` (`0xC4`, the final
  `SendCommandACK` in `HeadphonesV2.cpp RequestInitV2`), was sent but never
  ACKed. The last recorded init reply is ordinal 138. Ordinals 801-802 are
  later `PERI_*` frames appended to the capture. Init cannot complete from this
  recording, and the engine stays not-ready waiting for that ACK. This was found
  by decoding the TX the engine sent during the replay.
- **WF-LC900-2.0.3**: the recording ends after init and before the sync replies.

## How to add an XM4 capture (Task 7)

1. Record a session with the upstream client:
   `SonyHeadphonesClient.exe --record <folder>`. Connect, let init and sync
   finish, and touch the settings you want covered.
2. Scrub it with upstream `tooling/scrub-capture.py --scrub-device-address`
   (the repository keeps no real headset address outside `docs/*/evidence/`),
   then check what is left.
   Captures can contain Bluetooth addresses, device names and track metadata.
3. Put it in a repository fixture folder such as
   `src-tauri/crates/mdr/tests/captures/WH-1000XM4-<fw>/`, keeping the
   `mdr-packet-<ms>-<ordinal>-rx...bin` names. Add a helper next to `capture()`
   in `tests/common/mod.rs` that resolves it.
4. Write the test before you know the values. Replay with
   `replay(&dir, detect_protocol())`, print
   `serde_json::to_string_pretty(&engine.snapshot())` with `--nocapture`, read
   the output, and only then pin the values: model name, firmware, available
   features, batteries, noise control and equalizer. XM4 should detect as V1
   (`MDR_SERVICE_UUID_LEGACY`). Assert that instead of assuming it.
5. If a recording ends before `InitializeComplete`, find out why by decoding
   the TX tail, as was done for XM5, and record the reason next to the
   expectation.

## Running

```powershell
cd src-tauri
cargo test --workspace
cargo test -p mdr --test engine_replay -- --nocapture   # see the replays
```

The full test list and the result on 2026-10-12 are in
[SoundConnect Desktop - Rust Engine Bindings](<../engine/SoundConnect Desktop - Rust Engine Bindings.md#running>).
