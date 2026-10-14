---
title: "SoundConnect Desktop - Rust Engine Bindings"
date: 2026-10-12
tags: [engine, rust]
project: "SoundConnect Desktop"
area: "engine"
---

# SoundConnect Desktop - Rust Engine Bindings

**Status (2026-10-12): working.** Two crates wrap the CI-built upstream engine
DLLs (`mdr-shared.dll`, `mdr-bt-shared.dll`, built from
`upstream/SonyHeadphonesClient` commit `4c91fe6`; see
[SoundConnect Desktop - Engine Build](<../tooling/SoundConnect Desktop - Engine Build.md>)).
`cargo test --workspace --manifest-path src-tauri/Cargo.toml` passes the 21 engine tests, including a full
init + sync replay of the recorded WH-1000XM3 session. Clippy is clean with
`-D warnings -W clippy::undocumented_unsafe_blocks`.

| Crate | Role |
|---|---|
| `mdr-sys` | Raw `extern "C"` declarations, transcribed from the C headers. Links the import libraries. |
| `mdr` | Safe API: `Transport` trait, `ConnectionBox` trampolines, `ReplayTransport`, `Engine`, `Snapshot`. No public `unsafe` signatures. |

Workspace: since Task 9 both crates are members of the Tauri workspace,
[src-tauri/Cargo.toml](<../../src-tauri/Cargo.toml>) (lock:
[Cargo.lock](<../../src-tauri/Cargo.lock>)), under `src-tauri/crates/`; the
standalone `engine/Cargo.toml` workspace was removed. `engine/` keeps only the
build tooling and the fetched DLLs (`engine/bin`).

## mdr-sys

Files: [Cargo.toml](<../../src-tauri/crates/mdr-sys/Cargo.toml>),
[build.rs](<../../src-tauri/crates/mdr-sys/build.rs>),
[lib.rs](<../../src-tauri/crates/mdr-sys/src/lib.rs>),
[base.rs](<../../src-tauri/crates/mdr-sys/src/base.rs>),
[connection.rs](<../../src-tauri/crates/mdr-sys/src/connection.rs>),
[headphones.rs](<../../src-tauri/crates/mdr-sys/src/headphones.rs>),
[bt_windows.rs](<../../src-tauri/crates/mdr-sys/src/bt_windows.rs>).

### Linking (build.rs)

- Bin dir: `MDR_ENGINE_BIN` if set, else `engine/bin/RelWithDebInfo` (relative
  to the crate, `../../../engine/bin/RelWithDebInfo`). That directory is gitignored and
  filled by `tools/fetch-engine.ps1`.
- Panics with "run tools/fetch-engine.ps1 (or set MDR_ENGINE_BIN)" if either
  `.lib` or `.dll` is missing.
- Emits `rustc-link-search=native=<bin>`, `rustc-link-lib=dylib=mdr-shared` and
  `dylib=mdr-bt-shared`; `links = "mdr-shared"` exposes the bin dir to dependents
  as `DEP_MDR_SHARED_BIN`.
- Copies both DLLs into `target/<profile>/`, `deps/` and `examples/`, found by
  walking up from `OUT_DIR`, so test and binary executables load them without
  touching `PATH`. If a running test holds a DLL open, an identical-size copy is
  accepted.
- Sets `MDR_ENGINE_BIN_DIR` for the crate's tests so they can read
  `struct-sizes.txt` and the export lists from the same place.
- `rerun-if-env-changed=MDR_ENGINE_BIN`, plus rerun if any `.lib`/`.dll` changes.

### Transcription rules

- Header order, one module per header: `Base.h` -> `base.rs`, `Connection.h` ->
  `connection.rs`, `Headphones.h` -> `headphones.rs`,
  `mdr-bt/ConnectionWindows.h` -> `bt_windows.rs`. Every item has a doc comment
  giving its header file and line.
- `typedef uint32_t X` becomes `pub type X = u32`. `#define NAME ((X)Nu)` becomes
  `pub const NAME: X = N`. The 243 `Headphones.h` defines were generated from the
  header line by line, so the counts match exactly.
- Structs are `#[repr(C)] #[derive(Clone, Copy, Debug)]` (plus `Default` where
  every field allows it). Fields named `type` use `r#type`.
- Opaque handles (`MDRHeadphones`, `MDRConnectionWindows`,
  `MDRConnectionWindowsBLE`) are `#[repr(C)] struct { _p: [u8; 0] }`.
- `MDRConnection` is `user: *mut c_void` followed by eight
  `Option<unsafe extern "C" fn ...>` fields in header order: `connect`,
  `disconnect`, `recv`, `send`, `poll`, `getDevicesList`, `freeDevicesList`,
  `getLastError` (Connection.h:16-36).
- String constants (service UUIDs) are `&CStr`.
- The BLE functions are declared even though `ConnectionWindows.h` puts them
  under `#ifdef MDR_BLE`, because the CI build exports them.

### Conformance tests

[tests/layout.rs](<../../src-tauri/crates/mdr-sys/tests/layout.rs>):

- `struct_layouts_match_struct_sizes_txt` checks `size_of`/`align_of` for all 20
  structs against the numbers MSVC 19.51 produced in CI
  ([struct-sizes.txt](<../tooling/evidence/struct-sizes.txt>), for example
  `MDRConnection 72 8`, `MDRDeviceInfo 146 1`, `MDRPairedDeviceAction 24 8`).
- `hardcoded_table_matches_struct_sizes_txt` fails if a re-fetched engine
  changes that file, so the copied numbers cannot go stale silently.
- `every_exported_symbol_is_declared` parses the `dumpbin /exports` listings
  ([mdr-shared-exports.txt](<../tooling/evidence/mdr-shared-exports.txt>),
  61 names; [mdr-bt-shared-exports.txt](<../tooling/evidence/mdr-bt-shared-exports.txt>),
  6 names). It compares them, in both directions, against a list built by taking
  each declared function's address. A name in the list therefore has to be a real
  declaration that links.
- `abi_version_and_uuids_match_base_h` pins `MDR_ABI_VERSION == 2` and the UUIDs.

[tests/smoke.rs](<../../src-tauri/crates/mdr-sys/tests/smoke.rs>) pins
`mdrResultString(MDR_RESULT_OK) == "OK"`. This proves the DLL loads at test time.

Limitation: size and alignment do not catch a field whose type changed but kept
its width. Field offsets are recorded in
[struct-offsets.txt](<../tooling/evidence/struct-offsets.txt>) but not yet
asserted.

Export oddity: `dumpbin` lists `mdrConnectionWindowsGet` and
`mdrConnectionWindowsBLEGet` at the same RVA as a WinRT `IID_PPV_ARGS_Helper`
instance. That is identical-COMDAT folding: both are identity-style pointer
returns. They link and resolve normally.

## mdr

Files: [Cargo.toml](<../../src-tauri/crates/mdr/Cargo.toml>),
[lib.rs](<../../src-tauri/crates/mdr/src/lib.rs>),
[error.rs](<../../src-tauri/crates/mdr/src/error.rs>),
[transport.rs](<../../src-tauri/crates/mdr/src/transport.rs>),
[replay.rs](<../../src-tauri/crates/mdr/src/replay.rs>),
[protocol.rs](<../../src-tauri/crates/mdr/src/protocol.rs>),
[engine.rs](<../../src-tauri/crates/mdr/src/engine.rs>),
[events.rs](<../../src-tauri/crates/mdr/src/events.rs>),
[enums.rs](<../../src-tauri/crates/mdr/src/enums.rs>),
[types.rs](<../../src-tauri/crates/mdr/src/types.rs>),
[snapshot.rs](<../../src-tauri/crates/mdr/src/snapshot.rs>),
[packet.rs](<../../src-tauri/crates/mdr/src/packet.rs>).
Dependencies: `mdr-sys`, `serde` (derive). Dev-dependency: `serde_json`.

### Transport and the trampolines

```rust
pub trait Transport: Any + Send {
    fn connect(&mut self, mac: &str, uuid: &str) -> Result<ConnectStatus>; // Connected | InProgress
    fn disconnect(&mut self);
    fn recv(&mut self, dst: &mut [u8]) -> Result<Option<usize>>;           // None = would block
    fn send(&mut self, src: &[u8]) -> Result<usize>;
    fn poll(&mut self, timeout_ms: i32) -> Result<PollStatus>;             // Ready | InProgress | TimedOut
    fn devices(&mut self) -> Result<Vec<DeviceInfo>>;
    fn last_error(&self) -> String;
}
```

`ConnectionBox::new(Box<dyn Transport>)` puts the transport in a heap `State`
(`Box::into_raw`) and builds a separately boxed `MDRConnection` whose `user` is
that pointer, so the address libmdr keeps is stable. The `extern "C"`
trampolines map results the same way upstream `tests/Replay.cpp` `MockTransport`
does:

| Rust result | C result |
|---|---|
| `connect` -> `Connected` / `InProgress` | `MDR_RESULT_OK` / `MDR_RESULT_INPROGRESS` |
| `recv` -> `Some(n)` | `OK`, `*pReceived = n` |
| `recv` -> `None` | `INPROGRESS`, `*pReceived = 0` |
| `send` -> `n` | `OK`, `*pSent = n` |
| `poll` -> `Ready` / `InProgress` / `TimedOut` | `OK` / `INPROGRESS` / `ERROR_TIMEOUT` |
| `devices` | `OK` and a list owned by the box until `freeDevicesList` (or drop) |
| any `Err(e)` | `e.code()` (`Mdr` code, `Transport` -> `ERROR_GENERAL`, `Io` -> `ERROR_NET`, `InvalidArgument` -> `ERROR_INVALID_ARGUMENT`); the message is stored for `getLastError` |
| a panic | caught with `catch_unwind` and returned as `ERROR_GENERAL` with "panic in transport: ..." |
| null or negative arguments from C | `ERROR_INVALID_ARGUMENT` |

`getLastError` never returns null (Connection.h:101). If the latest trampoline
call failed, it returns that call's stored message. Otherwise it returns the
transport's non-empty `last_error()`, then the last stored message, then a
static fallback. An `Err` whose `code()` is `OK` or `INPROGRESS` is reported as
`ERROR_GENERAL`, so an error can never read as success. `transport_as::<T>()` and `transport_as_mut::<T>()`
downcast the wrapped transport through `Any`; tests use them to inspect a
`ReplayTransport`. On `Engine` both take `&mut self`: libmdr may call the
transport from any engine call, including the `&self` readers, so the borrow
must exclude them all. (Today libmdr reads its own copy of the error text and
never calls the transport from getters or Destroy, but the API does not rely on
that.)

### ReplayTransport

`ReplayTransport::from_capture_dir(dir)` loads every `*-rx.*.bin` file and sorts
the files by the ordinal in the name
(`mdr-packet-<ms>-<ordinal>-rx.type-<TYPE>-<hex>.seq-<n>.cmd-<NAME>-<hex>.bin`;
some appended frames use five digits). It concatenates the bytes. `recv`
returns the bytes until they run out and then reports would-block. This
deliberately differs from `Replay.cpp`, which loads one frame per step: one
`recv` may return several frames, as on a real RFCOMM stream; `send`
records TX; `poll` is always `Ready`; there are no devices; `last_error` is
"replay transport". Accessors: `frame_count()`, `frames()`, `rx_bytes()`,
`rx_remaining()`, `tx_bytes()`, `disconnected()`.

`detect_protocol()` finds the protocol family the same way
`Replay.cpp DetectProtocolVersion` does. It unescapes the first valid
`DATA_MDR` (`0x0C`) frame whose command is `CONNECT_RET_PROTOCOL_INFO` (`0x01`)
and checks its checksum. A 4-byte payload means V1 and 8 bytes means V2. If no
such frame exists, the result is V2.

### Engine lifecycle

`Engine::create(Box<dyn Transport>, Protocol::V1 | V2)` calls
`mdrHeadphonesCreate(MDR_ABI_VERSION, ...)`. The transport must already be
connected (Headphones.h:470-472). The ABI handshake surfaces as
`Error::Mdr { code: 12, .. }`. The states, as `client/Client.cpp` drives them:

1. **Created**: `is_initialized() == false`. Call `request_init()` first
   (Headphones.h:510).
2. **Initializing**: call `poll()` often. It never blocks and returns one
   `Event` per call (`Event::None` when idle). State events
   (`IdentityChanged`, `BatteryChanged`, ...) arrive as replies land.
3. On `Event::InitializeComplete`, call `request_sync()`.
4. **Syncing**: keep polling until `Event::SyncComplete`. Now
   `is_initialized()` and `is_ready()` are both true.
5. **Running**: re-read state on each `*Changed` event. On `NeedSync`, call
   `request_sync()` once `is_ready()`. On `Alert`, read `last_alert()` and
   answer with `respond_to_alert(AlertAction::Positive | Negative)`.
6. **Changing settings**: `set_*` stages a change (`is_dirty()` becomes true).
   `commit()` sends it, and `ApplyComplete` follows. While a request is in flight,
   `is_ready()` is false and further requests fail with `MDR_RESULT_INPROGRESS`
   (`Error::is_in_progress()`).
7. **Drop**: `mdrHeadphonesDestroy` runs first, then the `ConnectionBox`
   (vtable and transport) drops.

`poll()` returning `Err` is fatal for the session, with one exception: an
`Err` for which `Error::is_malformed_payload()` is true means libmdr could not
deserialise one received frame. `MoveNext` (`Headphones.cpp`) erased that frame
before `Handle`, which ACKed it first, and no state changed, so polling can go
on. The upstream client disconnects on any `Err`; the app's service skips this
one (the WH-1000XM4 sends such a frame after every Speak-to-Chat change, see
[toggle-dropouts-debug.md](<../core/evidence/toggle-dropouts-debug.md>)).

`Engine` is `Send`, not `Sync`. Every mutating call takes `&mut self`.

### Readers, setters, events

- Readers return owned types (`types.rs`): `model`, `batteries`,
  `playback_state`, `noise_control`, `speak_to_chat`, `listening`, `equalizer`
  (with `bands: Vec<i8>`), `equalizer_presets` (`{id, name}`; unknown ids are
  skipped like the client), `paired_devices`, `pairing`,
  `source_switch_control`, `general_settings` (`{index, info, value, subject,
  summary}`), `assignable_controls` (each with `options` from
  `GetAssignableControlActions`), `assignable_control_actions(key)`, `power`,
  `voice_guidance`, `connection_mode`, `safe_listening`, `wearing_status`.
- Lists use libmdr's two-call protocol: a NULL buffer with count 0 returns the
  size, then a second call fills it. Text works the same way:
  `text(Text, index)`, `model_name()`, `firmware_version()`, `last_alert()`,
  `last_error()`.
- `feature(Feature) -> Availability`; a failed query reads as `Unknown`.
- Setters: `set_playback` (volume), `playback(PlaybackAction)`,
  `set_noise_control`, `set_speak_to_chat`, `set_listening`, `set_equalizer`,
  `set_equalizer_bands`, `set_paired_device(command, id)`, `set_pairing`,
  `set_source_switch_control`, `set_general_setting(index, bool)`,
  `set_assignable_controls`, `set_power`, `set_voice_guidance`,
  `set_connection_mode`, `set_safe_listening`, `respond_to_alert`,
  `set_timeout`.
- `Event` maps all 25 `MDR_EVENT_*` values. `MDR_EVENT_UNHANDLED` (23, "libmdr
  got a command it does not handle") and any unknown code both become
  `Unhandled(code)`, which needs no action. It serializes as
  `{"type":"batteryChanged"}`.
- Every `Headphones.h` value set (`MDRNoiseMode`, `MDREqualizerPreset`,
  `MDRFeature`, `MDRText`, ...) is a Rust enum generated in header order.
  Variants are the constant name without its prefix, in PascalCase. Each enum
  also has an `Unrecognized(u32)` arm for values a newer engine might report.
  `MDR_NOISE_MODE_V1_ON` has the same value as `CANCELLING` and reads back as
  `Cancelling`. Serde writes known variants as camelCase strings and
  `Unrecognized(n)` as a number, and reads either form.
- Packet observer: `Engine::set_packet_callback(Some(Box<dyn FnMut(PacketDirection,
  &[u8]) + Send>))` wraps `mdrHeadphonesSetPacketCallback`, and `None`
  removes it. The engine owns the closure through `Box::into_raw`, and that
  pointer is libmdr's `user_data`. The old closure is freed only after libmdr
  has been given the new pointer (or none), and the current one is freed after
  `mdrHeadphonesDestroy`. Storing a raw pointer, not a `Box` field, means
  moving the `Engine` never retags the allocation that libmdr still points
  to. The `extern "C"`
  trampoline ignores null or negative arguments and catches panics. libmdr
  calls it with each packed frame (`'>' ... '<'`, escaped) inside engine calls
  only (`Headphones.cpp`: RX before `MDRUnpackCommand`, TX in
  `SendCommandImpl`). [tests/packet_callback.rs](<../../src-tauri/crates/mdr/tests/packet_callback.rs>)
  proves, over the XM3 capture, that the observer sees every TX byte, that
  every frame is a valid packet, and that a removed observer is silent.
- `mdr::packet` (diagnostics, no FFI): `decode_frame` unescapes a frame and
  checks it, returning the data type, seq, payload and whether the checksum
  matched. `v1_command_name` is the V1 table-1 `enum class Command` from
  `ProtocolV1T1.hpp`, 134 names. `describe_frame` formats a single log line.
  The app uses these for `SOUNDCONNECT_PACKET_LOG=1` (see Core Services).
- The `mdrConnection*` / `mdrConnectionWindows*` helpers are used only through
  `WindowsTransport` (below).

### Snapshot (renderer contract)

`Engine::snapshot()` runs every reader and stores `None` for any read libmdr
refuses (feature unsupported, not yet received, or not initialized). JSON keys
(camelCase), pinned by `snapshot_json_keys_are_the_renderer_contract`:

```text
protocol            "V1" | "V2"
initialized, ready, dirty   bool
model               {protocolVersion, audioCodec, modelColor} | null
batteries           [{part, present, levelPercent, updateThresholdPercent, charging}] | null
playback            {status, volume} | null
noiseControl        {mode, ambientLevel, changingAsmLevel, focusOnVoice, buttonMode, adaptiveAmbient, adaptiveSensitivity} | null
speakToChat         {enabled, sensitivity, timeout} | null
listening           {mode, backgroundRoom} | null
equalizer           {preset, clearBass, bandCount, dseeEnabled, dseeType, available, dseeAvailable, bands[]} | null
equalizerPresets    [{id, name}] | null
pairedDevices       [{connected, playbackDevice, macAddress, name}] | null
pairing             {enabled} | null
sourceSwitchControl bool | null
generalSettings     [{index, info: {index, kind, writable}, value, subject, summary}] | null
assignableControls  [{location, kind, action, options[]}] | null
power               {autoPowerOffMinutes, wearingPower, autoPause, headGesture, shutdownRequested} | null
voiceGuidance       {enabled, volume} | null
connectionMode      {audioPriority} | null
safeListening       {soundPressure, preview} | null
wearingStatus       "worn" | "leftRemoved" | ... | null
features            {"NOISE_CANCELLING": "available" | "unavailable" | "unknown", ...}  (all 34 MDR_FEATURE_* names, prefix removed)
texts               {modelName, firmwareVersion, uniqueId, modelSeries, modelColor, lastAlert, trackTitle, trackAlbum, trackArtist}  (each string | null)
```

Enum values are camelCase strings, for example `"cancelling"`, `"ldac"`,
`"rAndBHipHop"` and `"user1"`.

`model.protocolVersion` is the protocol info the device reports (`0x4010` =
16400 on the XM3), not the `MDR_PROTOCOL_V1/V2` family. The family is the
top-level `protocol` field.

## Unsafe hygiene

- Every `unsafe` block, `unsafe impl` and `unsafe fn` has a `// SAFETY:` comment
  or a `# Safety` section. `cargo clippy -W clippy::undocumented_unsafe_blocks`
  reports nothing.
- No public function in `mdr` is `unsafe`. `ConnectionBox::as_raw` returns a raw
  pointer for FFI, but calling it is safe.
- No trampoline can unwind into C. `catch_unwind` turns a panic into
  `ERROR_GENERAL`, and `trampolines_report_errors_devices_and_contain_panics`
  covers this.

## Running

```powershell
# once, or after an engine rebuild
powershell -ExecutionPolicy Bypass -File tools/fetch-engine.ps1
cd src-tauri
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings -W clippy::undocumented_unsafe_blocks
cargo test --workspace
```

Result on 2026-10-12 (rustc 1.99.0, MSVC linker 14.29):

```text
mdr (unit)            5 passed
engine_replay         6 passed
replay_transport      5 passed
mdr-sys layout        4 passed
mdr-sys smoke         1 passed
total                16 integration + 5 unit = 21 passed, 0 failed
```

Later the same day, with the packet observer:

```text
mdr (unit)            8 passed, 1 ignored (packet::tests 2, live XM4 listing ignored)
engine_replay         6 passed
packet_callback       1 passed
replay_transport      5 passed
mdr-sys layout        4 passed
mdr-sys smoke         1 passed
total                25 passed, 0 failed
```

`cargo clippy --workspace --all-targets -- -D warnings -W clippy::undocumented_unsafe_blocks` is clean.

Replay tests and their pinned values are described in
[SoundConnect Desktop - Testing](<../testing/SoundConnect Desktop - Testing.md>).

## Windows transport

Added with Task 10 (2026-10-12):
[transport_windows.rs](<../../src-tauri/crates/mdr/src/transport_windows.rs>),
example [devices.rs](<../../src-tauri/crates/mdr/examples/devices.rs>).

Live probe [toggle_probe.rs](<../../src-tauri/crates/mdr/examples/toggle_probe.rs>)
(2026-10-13): connects to a headset over the legacy UUID, initialises and syncs,
then stages and commits scripted actions (`dsee:on|off`, `stc:on|off`,
`cm:quality|stability`) and logs every frame, engine event, alert (answered per
`--alert negative|positive|none`), poll error, and the reconnect after a drop.
`--tolerate-malformed` keeps polling after `Error::is_malformed_payload`. Used
for [toggle-dropouts-debug.md](<../core/evidence/toggle-dropouts-debug.md>).

- `WindowsTransport` owns the object from `mdrConnectionWindowsCreate()`
  (`ConnectionWindows.h:15`) and implements `Transport` by calling the
  `mdrConnection*` helpers (`Connection.h:51-104`) on
  `mdrConnectionWindowsGet(w)`. Drop calls `mdrConnectionDisconnect` (the
  upstream Destroy does not close the socket; Disconnect is idempotent) and then
  `mdrConnectionWindowsDestroy`.
- Design choice: it goes through `ConnectionBox` like every other transport
  (libmdr -> trampoline -> helper -> upstream vtable) instead of a separate
  `Engine::create_with_raw_connection`. One extra call per send/recv buys a
  single code path for live and replayed sessions, and `Engine` owning the
  `Box<dyn Transport>` guarantees the connection outlives the
  `MDRHeadphones` instance (handle destroyed first, then the box).
- Result mapping: connect `OK`/`INPROGRESS` -> `Connected`/`InProgress`; recv
  `INPROGRESS` -> `Ok(None)`; send `INPROGRESS` -> `Ok(0)` (libmdr's
  `MDRHeadphones::Send` erases only the bytes sent, so it retries); poll
  `OK`/`INPROGRESS`/`ERROR_TIMEOUT` -> `Ready`/`InProgress`/`TimedOut`; any other
  code -> `Error::Mdr` with `mdrConnectionGetLastError` as detail, so the code
  reaches libmdr unchanged.
- Upstream lists only devices Windows has **connected**
  (`ConnectionWindows.cpp:246` `.fReturnConnected = 1`), and it is plain
  Winsock (`AF_BTH`, `BTHPROTO_RFCOMM`, non-blocking), so it has no thread
  affinity; `unsafe impl Send` relies on that.
- The RelWithDebInfo engine logs `[BT] ...` lines to stderr on every call
  (including the 2-second device scans); that is upstream's `MDR_LOG`, not ours.
- Tests: `create_and_drop_without_connecting` (recv before connect is
  `ERROR_NO_CONNECTION`), and `live_devices_lists_connected_xm4`, `#[ignore]`d.
  Run on 2026-10-12 with the XM4 connected:

```text
> cargo test -q -p mdr --lib live_ -- --ignored --nocapture
[BT] Found device: name="WH-1000XM4" mac=AA:BB:CC:12:34:56 connected=32 authenticated=8 remembered=16
AA:BB:CC:12:34:56 WH-1000XM4
test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 6 filtered out
```

- `cargo run -p mdr --example devices -- --probe AA:BB:CC:DD:EE:FF` tries both
  service UUIDs (XM5, then legacy, 10 s each). With the XM4 off it reported a
  10 s timeout on XM5 and `SO_ERROR=10060` on legacy; with it on, the XM5 UUID
  fails with `SO_ERROR=10049` (see
  [live-xm4-first-contact.txt](<../core/evidence/live-xm4-first-contact.txt>)).

Test count after Task 10: `mdr` unit 6 passed + 1 ignored (22 run in the engine
crates); the app crate adds 10 (see
[SoundConnect Desktop - Core Services](<../core/SoundConnect Desktop - Core Services.md>)).
