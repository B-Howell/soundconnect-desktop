---
title: "SoundConnect Desktop - Core Services"
date: 2026-10-12
tags: [core, rust, tauri, bluetooth]
project: "SoundConnect Desktop"
area: "core"
---

# SoundConnect Desktop - Core Services

**Status (2026-10-12): working against the real WH-1000XM4.** The Tauri process
runs one engine thread that finds the headphones, opens RFCOMM through
upstream's Windows backend, drives libmdr, and publishes status and snapshots to
the window. On this PC it reached `Ready` with the maintainer's XM4 (protocol V1,
firmware 2.9.0); see [Live first contact](#live-first-contact). The renderer
consumes the events (Task 11), and since Tasks 18 and 21 the process also
owns a tray icon, closes to the tray and can start with Windows; see
[Tray, settings bridge, close to tray, autostart](#tray-settings-bridge-close-to-tray-autostart-tasks-18-and-21).

| File | Role |
|---|---|
| [engine_service.rs](<../../src-tauri/src/engine_service.rs>) | `EngineService` (thread handle), the state machine, command set, payload types, `SnapshotSink`, replay tests |
| [noise_view.rs](<../../src-tauri/src/noise_view.rs>) | V1/V2 noise control -> `noiseView`, and view requests -> `MDRNoiseControl` |
| [commands.rs](<../../src-tauri/src/commands.rs>) | Tauri commands and `TauriSink` (emits `engine:*` to all windows) |
| [tray.rs](<../../src-tauri/src/tray.rs>) | Tray icon, tooltip and quick noise menu; `TraySink` (wraps `TauriSink`) |
| [settings.rs](<../../src-tauri/src/settings.rs>) | `settings.json` mirror of the renderer's settings (plus `autoConnect`), `settings_write` command |
| [profiles.rs](<../../src-tauri/src/profiles.rs>) | Remembered headphones (`devices.json`), learned at each Ready |
| [lib.rs](<../../src-tauri/src/lib.rs>) | Plugins (single-instance, window-state, opener, autostart), close to tray, start hidden; creates the tray and starts the service in `setup` |
| [build.rs](<../../src-tauri/build.rs>) | Fails early without the engine DLLs; generates the installer's licence file |
| [transport_windows.rs](<../../src-tauri/crates/mdr/src/transport_windows.rs>) | `WindowsTransport` over `mdr-bt-shared.dll` (see [Rust Engine Bindings](<../engine/SoundConnect Desktop - Rust Engine Bindings.md#windows-transport>)) |
| [Cargo.toml](<../../src-tauri/Cargo.toml>) | Workspace root: the app plus `crates/mdr-sys`, `crates/mdr`; `crossbeam-channel =0.5.17` |
| [tools/dev.ps1](<../../tools/dev.ps1>) | `tauri dev` launcher: sets `MDR_ENGINE_BIN`, checks the DLLs, stops the upstream client |
| [fixtures/WH-1000XM4-2.9.0](<../../src-tauri/fixtures/WH-1000XM4-2.9.0>) | Real XM4 RX capture (upstream recorder, connect to idle) replayed by the service tests |
| [fixtures/xm4-noise-control](<../../src-tauri/fixtures/xm4-noise-control>) | Live XM4 `NCASM_SET_PARAM` frames, the device's replies, and upstream's frames for the same transitions |
| [fixtures/xm4-toggle-dropouts](<../../src-tauri/fixtures/xm4-toggle-dropouts>) | Live XM4 frames for DSEE, Speak-to-Chat and connection quality and the device's replies, including the Speak-to-Chat notify libmdr cannot parse ([evidence](<evidence/toggle-dropouts-debug.md>)) |

## Threading

`EngineService::start(factory, sink, config)` spawns a thread named `engine`
that owns everything Bluetooth: the idle transport (used for discovery and
connecting) and, once connected, the `mdr::Engine`, which owns the transport
from then on (so the connection outlives the `MDRHeadphones` handle). The
handle the app manages (`Arc<EngineService>`) only holds a
`crossbeam_channel::Sender` and two mutex-guarded copies of the latest status
and snapshot. Nothing else touches libmdr, so the engine's single-threaded
contract holds without locks.

The thread waits on the command channel with `recv_timeout(tick)`; a command
wakes it immediately, otherwise it steps every 16 ms while connecting or
connected, and at the next discovery time while idle. Dropping the service (or
`shutdown()`) stops the thread and drops the link.

`TransportFactory = Arc<dyn Fn() -> mdr::Result<Box<dyn Transport>>>`: the app
passes `WindowsTransport::new`, the tests a replay.

## State machine

```text
Disconnected -> Discovering -> Connecting{address, uuid_index, deadline}
             -> Initialising -> Ready -> Disconnected(lastError)
```

- **Idle at launch** (since round 2) - with the `autoConnect` setting off (the
  default) the service publishes `Disconnected` plus the remembered profile and
  does nothing else until the user sends `connect`, `reconnect` or `scan`; see
  [Contract changes 2026-10-12 (round 2)](#contract-changes-2026-10-12-round-2).
- **Idle Windows check** (0.1.9) - while not connected and not discovering
  (auto-connect off, or suspended by `disconnect`), every `discovery_interval`
  (3 s) one `devices()` call, nothing else: no RFCOMM connect, no inquiry for
  new devices. It sets `windowsConnected` in `engine:status` (see
  [Contract changes 0.1.9](#contract-changes-019-windowsconnected)).
- **Discovering** (`autoConnect` on) - every `discovery_interval` (3 s since
  0.1.9, was 2 s) call
  `devices()` and pick the most recently seen remembered device, else the
  first whose name starts with `WH-`, `WF-` or `LinkBuds`. Upstream's backend
  lists only devices Windows has connected, so nothing is paged while the
  headphones are off.
- **Connecting** - follows upstream `client/Client.cpp`:
  - order: `connectionAttempt.services = {MDR_SERVICE_UUID_XM5, MDR_SERVICE_UUID_LEGACY};` (line 1064);
  - deadline per attempt: `static constexpr uint64_t kAttemptTimeoutMs = 10'000;` (line 987);
  - polling: `MDRResult pollResult = mdrConnectionPoll(conn, 0);` (line 1277);
    timeout or error -> disconnect and try the next UUID
    (`AdvanceConnectionAttempt`); a connect that fails synchronously skips to
    the next UUID (`TryConnectionAttempt`);
  - protocol: `if (std::strcmp(service, MDR_SERVICE_UUID_LEGACY) == 0) return MDR_PROTOCOL_V1;`
    (lines 1014-1015), otherwise V2.
  All UUIDs exhausted -> `Disconnected` with `lastError`, retried after
  `retry_backoff` (10 s).
- **Initialising** - `Engine::create(transport, protocol)` then
  `request_init()`; on `InitializeComplete`, `request_sync()` (as upstream's
  `case MDR_EVENT_INITIALIZE_COMPLETE:`); on the first `SyncComplete` ->
  **Ready**. No `SyncComplete` within `init_timeout` (30 s) -> link lost.
- **Ready** - the tick loop below.
- Any `poll` error -> link lost: drop the engine (which closes the socket),
  clear the snapshot, publish `Disconnected{lastError}`, retry after 10 s.
  Except `MDR_RESULT_ERROR_MALFORMED_PAYLOAD` (`Error::is_malformed_payload`):
  libmdr could not parse one frame it had already ACKed and consumed, so the
  service logs `engine: skipped a frame libmdr could not parse (#n on this
  link)` and keeps polling. The count lives on the link (`Live.malformed_skips`);
  only the first three and every hundredth skip are logged, so a device that
  keeps sending such frames cannot flood stderr (the skip loop is also bounded
  by `MAX_EVENTS_PER_TICK`, and libmdr's `MoveNext` erases each frame before
  handling it, so the cursor always advances). The XM4 sends such a frame after every Speak-to-Chat change, which
  used to drop the app's link ([evidence](<evidence/toggle-dropouts-debug.md>)).
- **Reconnecting after a setting change** - a link lost within
  `RECOVERY_TRIGGER` (10 s) of applying `setConnectionMode`, `setSpeakToChat`
  or `setDsee` is reconnected to the same address every `recovery_retry` (1 s)
  for `recovery_window` (20 s), even with `autoConnect` off. The status stays
  `connecting` / `initialising` with `reason: "reconnectingAfterSettingChange"`
  (failed attempts do not publish `disconnected`); Ready clears the reason; no
  Ready in 20 s -> `Disconnected` with `reason: "timeout"`. `disconnect`,
  `reconnect`, `connect` and `forgetDevice` cancel it. The XM4 closes RFCOMM
  50-120 ms after acknowledging a connection-quality change and accepts a new
  RFCOMM connection 1.5-2 s later.

`Disconnect` drops the link and pauses auto-connect (status `Disconnected`,
no `lastError`); `Reconnect` connects to the remembered device (or runs one
discovery pass); `Connect{address}` drops any link and connects to that
address if Windows lists it as connected, else fails at once with
`reason: "notConnectedToWindows"`. A failed manual connect is not retried
unless `autoConnect` is on.

## Tick loop (Initialising and Ready)

1. `poll()` up to 32 times, stopping at the first `Event::None` (upstream polls
   once per frame):
   - `InitializeComplete` -> `request_sync()`;
   - `SyncComplete` -> Ready (first time) and publish;
   - `NeedSync` -> remember; `request_sync()` once `is_ready()` (upstream sets
     `gState.mPendingSync` at `case MDR_EVENT_NEED_SYNC:`, line 2314);
   - `Alert` -> read `texts.lastAlert`, emit `engine:alert`; auto-answer below;
   - `Unhandled(n)` -> ignored; every other event -> publish.
2. Publish once if anything changed: `engine.snapshot()` + `noiseView`.
3. Pending `NeedSync`, then a pending alert answer, when `is_ready()`.
4. When Ready, apply queued device commands while `is_ready()`. libmdr's setters
   return `MDR_RESULT_INPROGRESS` when not ready (`if (!h->IsReady()) return
   MDR_RESULT_INPROGRESS;` in every `mdrHeadphonesSet*`), so a command waits at
   the head of the queue; other errors are logged and dropped.
5. `commit()` only when step 4 applied a user command since the last commit
   (and `is_ready()`). Until round 2 this was "whenever `is_dirty()`", which
   wrote stale state back over the phone app's changes; see
   [Coexisting with the Sony phone app](#coexisting-with-the-sony-phone-app).

### Alerts

The XM3 doc in upstream (`docs/device-support/WH-1000XM3.md`, line 69) records:
"Changing the equalizer preset made the device raise `ALERT_NTFY_PARAM`
`DISCONNECT_CAUSED_BY_CONNECTION_MODE_CHANGE` with a yes/no choice. The client
answered `NEGATIVE`, and the device notified the new preset
(`EQEBB_NTFY_PARAM`) anyway, without disconnecting." So that alert is answered
`NEGATIVE` automatically (`autoResponse: "negative"` in the event); any other
alert is surfaced and waits for `RespondToAlert{positive}`.
`mdrHeadphonesRequestRespondToAlert` also returns `INPROGRESS` when not ready,
so the answer is retried each tick. Every alert carries `requiresChoice`: true
when it waits for an answer.

The WH-1000XM4 (fw 2.9.0) raises no alert for DSEE, Speak-to-Chat or
connection-quality changes (live, 2026-10-13); it simply restarts its links for
a connection-quality change. So the service asks itself: a `setConnectionMode`
to a value other than the device's is held and the service emits
`{message: "CONFIRM_CONNECTION_MODE_CHANGE", autoResponse: null, requiresChoice: true}`.
The next `respondToAlert` answers it, not the device: `positive: true` queues
the change, `false` discards it and republishes the snapshot so the renderer's
optimistic change is undone. Two cases withdraw the pending question
(integration review, 0.1.6), so a late answer can never apply a stale choice
or be misrouted:

- a `setConnectionMode` to the device's current value (the user changed their
  mind before answering) clears it; the renderer drops the banner when it sends
  any `setConnectionMode`;
- a device alert that waits for a choice clears it and republishes the
  snapshot: the renderer's banner now shows the device's question, so the next
  answer goes to the device.

On "Not now" the renderer also drops its own `setConnectionMode` patch at once
(`respondToAlert(false)` in `src/state/engineStore.ts`), because the
republished snapshot arrives inside the 1.5 s settle time that would otherwise
keep the optimistic value on screen.

## Commands

`engine_send(command)` takes a serde-tagged object,
`{"type": "<camelCase name>", ...camelCase fields}`:

| type | fields | effect |
|---|---|---|
| `setNoise` | `mode` (`off`/`cancelling`/`ambient`/`wind`), `ambientLevel?`, `focusOnVoice?` | view -> raw per protocol (below) |
| `setAmbientLevel` | `level` 1..20 | ambient at that level |
| `setFocusOnVoice` | `enabled` | keeps mode and level |
| `setEqualizerPreset` | `preset` (`"bass"` or raw number) | `MDREqualizer.preset` |
| `setEqualizerBands` | `bands: i8[]` | `mdrHeadphonesSetEqualizerBands` |
| `setClearBass` | `level: i8` | `MDREqualizer.clear_bass` |
| `setDsee` | `enabled` | `MDREqualizer.dsee_enabled` |
| `playback` | `action` (`play`/`pause`/`next`/`previous`) | `mdrHeadphonesPlayback` |
| `setVolume` | `volume` | `MDRPlayback.volume` |
| `setPower` | `autoPowerOffMinutes?`, `wearingPower?`, `autoPause?`, `headGesture?` | read-modify-write `MDRPower` |
| `setVoiceGuidance` | `enabled`, `volume?` | `MDRVoiceGuidance` |
| `setGeneralSetting` | `index`, `value` | `mdrHeadphonesSetGeneralSetting` |
| `setAssignableControls` | `controls` (snapshot shape) | `mdrHeadphonesSetAssignableControls` |
| `powerOff` | - | `power.shutdown_requested = MDR_TRUE;` (Client.cpp line 1392) |
| `respondToAlert` | `positive` | answers the pending alert |
| `disconnect` / `reconnect` / `connect` | `address` for connect | service commands, run at once |

Device commands sent while not connected are logged and dropped. Commands
libmdr rejects are logged as `engine: <command> rejected: <error>` and dropped;
`engine_send` has already returned `Ok` by then. See
[Commands added 2026-10-12](#commands-added-2026-10-12) for speak-to-chat,
connection mode, paired devices, pairing, auto-pause and multipoint.

Tauri commands ([commands.rs](<../../src-tauri/src/commands.rs>)), each logging
one `command: ...` line to stderr: `engine_status`, `engine_snapshot`,
`engine_send(command)`, `engine_devices` (async; `{address, name}[]`, a fresh
transport answers while connected), `engine_connect(address)`,
`engine_disconnect`. No capability change is needed: app commands are allowed
by default when `build.rs` defines no app manifest.

## Events and payloads

| Event | Payload |
|---|---|
| `engine:status` | `{state: "disconnected"|"discovering"|"connecting"|"initialising"|"ready", deviceName?, address?, protocol?: "V1"|"V2", lastError?, reason?, remembered, windowsConnected}` (absent keys omitted; see [`engine:status`](#enginestatus)) |
| `engine:snapshot` | `{snapshot: Snapshot, noiseView: NoiseView | null}`; `Snapshot` is the renderer contract from the bindings doc |
| `engine:alert` | `{message, autoResponse: "negative" | null, requiresChoice: boolean}` |

`NoiseView = {mode, ambientLevel (1..20), focusOnVoice, canCancel, canAmbient,
canWind, canFocusOnVoice}`. A snapshot is published during initialisation too
(model, firmware and battery arrive before `SyncComplete`), so the renderer can
fill in as data lands; `snapshot.ready` says whether sync has finished.

`SOUNDCONNECT_DUMP_SNAPSHOT=1` writes every published `engine:snapshot` payload
to `%LOCALAPPDATA%\SoundConnect Desktop\last-snapshot.json` (pretty JSON).

`SOUNDCONNECT_PACKET_LOG=1` (`ServiceConfig::packet_log`) logs every frame on the
link to stderr, through `Engine::set_packet_callback` and
`mdr::packet::describe_frame`. Each line shows the direction, length, data
type, seq, command byte and name (V1 table 1), the unescaped payload and the raw
bytes:
`packet: tx len=17 DATA_MDR seq=1 cmd=0x68(NCASM_SET_PARAM) payload=[68 02 11 01 00 01 00 0a] raw=[...]`.
Every successful `commit()` also logs `engine: commit requested`.

## Noise normalisation

[noise_view.rs](<../../src-tauri/src/noise_view.rs>). Upstream reads V1 as:

```cpp
// -1: Noise Cancelling
// 0: Wind Noise Reduction
// 1-20: Ambient Sound
int sliderLevel = static_cast<int8_t>(gState.mNoise.ambient_level);
```

(`client/Client.cpp` lines 1604-1607), with `mode` only `MDR_NOISE_MODE_V1_ON`
or `OFF`, and `MDR_NOISE_MODE_V1_ON` equal to `MDR_NOISE_MODE_CANCELLING` (both
`1u`, `Headphones.h` 167-168).

| Protocol | Raw | View |
|---|---|---|
| V1 | `mode OFF` (any level) | `off` |
| V1 | `ON`, level 255 (-1) | `cancelling` |
| V1 | `ON`, level 0 | `wind` |
| V1 | `ON`, level 1..20 | `ambient`, `ambientLevel` = level |
| V2 | `OFF` / `CANCELLING` / `AMBIENT` | `off` / `cancelling` / `ambient` (level 0 -> fallback) |

`ambientLevel` is never the raw byte: outside ambient it is the last ambient
level seen on this connection (default 20, upstream's
`if (gState.mNoise.ambient_level == 0) gState.mNoise.ambient_level = 20;`,
line 1646). `canCancel` / `canAmbient` come from the `NOISE_CANCELLING` /
`AMBIENT_SOUND` features, `canWind` = V1 and `canCancel`, `canFocusOnVoice` =
`canAmbient`.

Writes reverse the table from the device's current `NoiseControl` (so fields
the view does not model, such as V1's required `button_mode NONE`, are kept):
V1 `cancelling` -> `ON` + 255, `wind` -> `ON` + 0, `ambient` -> `ON` + level
clamped to 1..20; V2 sets `mode` and, in ambient, the level; `wind` on V2 is
rejected. `changing_asm_level` is always false.

## Engine DLLs at run time

`mdr-sys/build.rs` copies `mdr-shared.dll` and `mdr-bt-shared.dll` from
`engine/bin/RelWithDebInfo` (or `MDR_ENGINE_BIN`) into `target/<profile>/`,
`deps/` and `examples/`. Since the crates are in the Tauri workspace, that is
`src-tauri/target/debug/`, next to `soundconnect-desktop.exe`, so `tauri dev`
needs no extra step; `tools/dev.ps1` only sets `MDR_ENGINE_BIN` and fails early
when the DLLs were never fetched.

Installed app (Task 21): the exe imports both DLLs at load time (it links
them with `rustc-link-lib=dylib`), so Windows must find them before `main`
runs, and the first place it looks is the exe's own folder.
`tauri.conf.json` maps them to the root of the bundle's resource dir:

```json
"resources": {
  "../engine/bin/RelWithDebInfo/mdr-shared.dll": "mdr-shared.dll",
  "../engine/bin/RelWithDebInfo/mdr-bt-shared.dll": "mdr-bt-shared.dll"
}
```

For an NSIS install the resource dir is the install dir, the folder that
holds `soundconnect-desktop.exe`. That is what makes the installed exe load
them: the running installed process's modules were
`%LOCALAPPDATA%\SoundConnect Desktop\mdr-shared.dll`
and `...\mdr-bt-shared.dll`. The list form (`["../engine/..."]`) would not
work, because it places them under `_up_\engine\bin\...`, outside the DLL
search path. [build.rs](<../../src-tauri/build.rs>) fails the build with
"run tools/fetch-engine.ps1 first" when either DLL is missing. The installer
always takes the DLLs from `engine/bin/RelWithDebInfo`; `MDR_ENGINE_BIN`
only steers the link and the dev copy.

The upstream nightly client (`SonyHeadphonesClient.exe`) holds the RFCOMM
channel while it runs; `dev.ps1` stops it.

## Tray, settings bridge, close to tray, autostart (Tasks 18 and 21)

### Settings bridge

The renderer's zustand store (`localStorage` key `soundconnect.settings`) is
the **source of truth** for `theme`, `startWithWindows`, `startMinimized` and
`keepRunningInTray`. Rust cannot read WebView storage, but it needs
`keepRunningInTray` when the window closes and the startup pair before the
window is shown. So there are two copies:

1. the store (renderer), edited on the Settings page;
2. `%APPDATA%\dev.soundconnect.desktop\settings.json`
   (`app.path().app_config_dir()` joined with `settings.json`), a **mirror**
   written by the `settings_write(settings)` command whenever one of the four
   values changes and once when the renderer mounts (`useSettingsSync`), and
   read once at launch by `settings::load(app)` into the managed
   `SettingsState`, which `settings_write` also updates.

Rule: never edit the file to change a setting; the renderer overwrites it on
its next mount. `settings::load` gives the defaults (`system`, false, false,
true, as `SETTINGS_DEFAULTS`) for a missing, unreadable or non-object file,
and keeps each field only when its type is right (a theme outside
system / light / dark falls back), like the renderer's `sanitizeSettings`.
On a first launch the file does not exist yet, so the defaults apply until
the renderer writes it moments later.

### Window lifecycle

- The window is declared `"visible": false`; `setup` shows it unless
  `start_hidden(args, settings)`: the process was started with `--minimized`
  (only the autostart entry passes it) **and** `startWithWindows &&
  startMinimized`. A manual launch always shows the window.
- `on_window_event`, `WindowEvent::CloseRequested` on `main`: when
  `keepRunningInTray`, `api.prevent_close()` then `window.hide()`; the engine
  keeps the link. When off, the close proceeds and the app exits with its
  last window.
- Single-instance: a second launch calls `show_main_window` (show,
  unminimize, focus), so a window hidden to the tray comes back; a second
  launch with `--minimized` does nothing.
- window-state: `.with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)`,
  so a window closed to the tray is not restored hidden.

### Tray

[tray.rs](<../../src-tauri/src/tray.rs>), Tauri's `tray-icon` feature:
`TrayIconBuilder::with_id("main")` with `app.default_window_icon()`,
`.show_menu_on_left_click(false)`, `.on_menu_event(...)` and
`.on_tray_icon_event(...)` (a `TrayIconEvent::Click` with `MouseButton::Left`
and `MouseButtonState::Up` shows the window; the right button opens the menu).

- Tooltip (`tooltip_text`): Ready gives `WH-1000XM4 · 90% · Noise cancelling`
  (model name from `texts.modelName`, else the status name; the main battery,
  else the lower earbud; then Noise cancelling / Wind noise reduction /
  Ambient sound / Noise control off). Otherwise `SoundConnect · <state>`,
  where `state_label` mirrors the renderer's `connectionCopy` from the
  status's `remembered`, `windowsConnected` and `reason` (0.1.10 copy
  register): "No headphones set up", "Headphones off or disconnected",
  "Ready to connect", "Connecting…", "Reconnecting…" or "Connection failed".
  Capped at 127 characters, the Windows limit.
- Menu (`noise_menu_model`): with a `noiseView`, `CheckMenuItem`s in the
  renderer's order and with its labels: Noise cancelling (`canCancel`), Wind
  (`canWind`), Ambient (`canAmbient`), Off (always), the current mode
  checked. Without one, a disabled line with the same `state_label`. Then a separator,
  "Show SoundConnect" and "Quit" (`app.exit(0)`, the way out while keep
  running is on). A noise click sends `EngineCommand::SetNoise { mode,
  ambient_level: None, focus_on_voice: None }`, in view terms, so V1 wind and
  the ambient level are handled by `noise_request`.
- `TraySink` is the service's sink: it forwards every call to `TauriSink`
  unchanged, keeps the last status and payload (the payload is dropped in
  any state but Ready or Initialising, as the service clears its snapshot),
  and refreshes the tray. The menu is rebuilt (`Menu::new` and
  `tray.set_menu`) only when its model changes, and the tooltip set only when
  its text changes. A click toggles the clicked check item locally, so the
  handler forces a rebuild from the device's state, from a short-lived
  thread: tray calls post to the main thread and wait for it
  (`run_item_main_thread!`), and the menu handler runs on that thread, so
  `refresh` must never run there. The state lock is released before calling
  the tray; a second lock, `apply`, is held across a whole refresh, so a
  forced rebuild and a snapshot's refresh cannot apply their models out of
  order (found in review: without it a stale model could be applied after a
  newer one and stay, because the newer one was already recorded).
- Cost: each tray update makes the engine thread wait for the main thread,
  so while the main thread sits in a modal loop (dragging or resizing the
  window) engine polling pauses too. Updates happen only when the tooltip
  text or menu model changes, so this has not mattered.

### Autostart

`tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--minimized"]))`
(pin `=2.7.0`; capability `autostart:default`, which is `allow-enable`,
`allow-disable` and `allow-is-enabled`). On Windows the plugin writes a value
named after the product under
`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`. Verified from the
installed app: switching Start with Windows on created
`SoundConnect Desktop = %LOCALAPPDATA%\SoundConnect Desktop\soundconnect-desktop.exe --minimized`,
and switching it off removed it. The renderer calls the plugin (`enable()` /
`disable()` from `@tauri-apps/plugin-autostart`) from the switch and, once on
mount, `isEnabled()`, correcting the switch to what Windows will actually do
(the entry can be removed in Task Manager, or `localStorage` lost); see
[SoundConnect Desktop - Renderer](<../renderer/SoundConnect Desktop - Renderer.md#settings-sync-and-autostart>).
Known gaps: the entry records the exe that switched it on, so switching it on
from a dev build registers the dev exe until it is switched again from the
installed app; and the NSIS uninstaller does not remove the `Run` value, so
switch Start with Windows off before uninstalling (an uninstall hook is a
follow-up).

### Verification (2026-10-12, installed build)

- Rebuilt after the review fixes and reinstalled over the first install
  (`/S`, exit 0): same modules from the install dir, same tray entry.
- Tray icon: UI Automation, after invoking "Show Hidden Icons", lists
  `[SystemTray.NormalButton] 'SoundConnect SoundConnect · Looking for headphones'`
  in `System tray overflow window.`, so the icon exists and its tooltip
  follows `engine:status`. Invoking it (a left click) showed the hidden window.
- Close to tray: `WM_CLOSE` to the window left the process running with
  `IsWindowVisible` false. A second launch made it visible again; a second
  launch with `--minimized` did not.
- Start hidden: with `settings.json` set to both switches on, a launch with
  `--minimized` created the window without showing it; a launch without the
  flag showed it. The renderer then rewrote the file from its own store (both
  off), as the rule above says.
- `settings.json` written by the installed app on first launch:
  `{"theme": "system", "startWithWindows": false, "startMinimized": false, "keepRunningInTray": true}`.
- Not verified: the XM4 was not connected to Windows during the session
  (`DEVPKEY_Device_IsConnected` false), so the installed app stayed on
  "Looking for your headphones" and the tray's Ready tooltip and noise menu
  were not seen live (unit tests cover their model). Quit from the tray menu
  was not driven: a synthetic right click did not open the menu from the
  agent session (screen capture also failed with "The handle is invalid",
  most likely a locked session), so the app was stopped with `Stop-Process`.

## Tests

2026-10-12 (noise control debug and the new commands):
`cargo test --workspace`: 60 passed, 1 ignored (engine crates 25, app 35);
`cargo clippy --workspace --all-targets -- -D warnings` clean.

New tests:

- `xm4_nc_to_ambient_10_to_off_to_nc_sends_the_frames_the_live_device_confirmed`
  ([evidence](<evidence/noise-control-debug.md>)).
- `noise_view::tests::v1_requests_are_completed_changes_never_in_progress`.
- One replay test per new command: `set_speak_to_chat_reaches_the_xm4`,
  `set_connection_mode_reaches_the_xm4` (since 2026-10-13
  `set_connection_mode_reaches_the_xm4_once_confirmed`), `set_pairing_reaches_the_xm4`,
  `set_auto_pause_changes_only_auto_pause`,
  `set_multipoint_writes_the_multipoint_general_setting`,
  `set_paired_device_reaches_a_v2_device` and
  `set_paired_device_is_rejected_on_v1_without_sending`.
- `new_commands_deserialize_from_renderer_json`.
- In the `mdr` crate: `packet::tests::*` (2) and
  `tests/packet_callback.rs`.

Speak-to-chat, connection mode, pairing and multipoint assert the exact frame
libmdr emits (`f8 05 01 01` + `fc 05 ...`, `e8 01 00 00`, `34 01 01 00`,
`d8 d2 ...`). `ListedReplay` now takes any capture directory and protocol.

Added 2026-10-13 ([evidence](<evidence/toggle-dropouts-debug.md>)):
`ListedReplay` can close its link after replying to a payload
(`Setup.close_after`, like the XM4 after a connection-quality change) and
refuse reconnects (`Harness.refuse`); a new link resets the responder. Tests:
`xm4_speak_to_chat_notify_libmdr_cannot_parse_does_not_drop_the_link`,
`xm4_dsee_toggle_sends_one_audio_set_param_and_keeps_the_link`,
`connection_mode_change_waits_for_the_users_confirmation`,
`drop_after_a_connection_mode_change_reconnects_even_with_auto_connect_off`,
`no_reconnect_within_the_window_ends_disconnected_with_timeout` and
`a_drop_without_a_setting_change_does_not_reconnect_with_auto_connect_off`.
Added in the 0.1.6 review: `re_picking_the_current_mode_withdraws_the_pending_confirmation`,
`forgetting_another_device_does_not_cancel_the_recovery` (only a `forgetDevice`
naming the link's own address counts as a link change; before, forgetting any
other device cancelled the recovery and left the status on "Reconnecting"
forever with auto-connect off) and
`forgetting_the_recovering_device_ends_disconnected`.
`ready_and_armed` waits for the replay to be fully consumed (a `drained` flag
set by `recv`) and for TX to stop growing before it arms the responder. Once
`Harness::ready_and_armed` has run, it answers like the live device: an ACK for
every DATA frame, plus the recorded reply for a recorded TX payload. That
removes the old limit of one change per test (without ACKs, the second command
waited for the first ACK forever).

`cargo test --workspace --manifest-path src-tauri/Cargo.toml` (2026-10-12,
Tasks 18 and 21, after the review fixes): 47 passed, 1 ignored (engine
crates 22 + app 25); `cargo clippy --workspace --all-targets` clean. New:
`settings::tests::*` (6: missing file, invalid JSON and a non-object,
per-field fallback, round trip, start minimized needs autostart, the
command's JSON), `tray::tests::*` (8: menu model for the XM4, without wind,
Off only, id round trip, tooltip ready, not ready and capped, battery
choice) and `tests::starts_hidden_only_from_autostart_with_both_switches_on`.

Before Task 18: 32 passed, 1 ignored (engine crates 22 + app 10). The app tests in
[engine_service.rs](<../../src-tauri/src/engine_service.rs>) use a factory
returning `ListedReplay`: the recorded `WH-1000XM3-4.5.2` capture
(`ReplayTransport`), listed as connected, refusing the XM5 UUID like the real
XM4 (`SO_ERROR=10049`), and copying TX to a shared buffer; plus a `VecSink`.

| Test | Proves |
|---|---|
| `replayed_xm3_reaches_ready_and_publishes_its_snapshot` | statuses exactly Discovering, Connecting, Initialising, Ready; protocol V1 after the XM5 fallback; a snapshot with `texts.modelName == "WH-1000XM3"`; `noiseView` cancelling |
| `set_dsee_is_staged_and_committed_to_the_transport` | `setDsee{enabled:false}` (the capture has DSEE on) grows TX |
| `disconnect_leads_to_disconnected_and_stays_there` | `Disconnect` -> Disconnected, snapshot cleared, no auto-reconnect |
| `commands_deserialize_from_renderer_json` | the JSON command shape |
| `noise_view::tests::*` (6) | raw 255 / 0 / 7, mode OFF, V2, round trips and clamping |

Proved against broken lines (2026-10-12): mapping V1 level 0 to cancelling made
`v1_raw_0_is_wind` and `v1_requests_round_trip_through_the_view` fail; removing
`request_sync()` on `InitializeComplete` made the three service tests fail
("timed out waiting for Ready"). Both restored.

## Noise control debug (2026-10-12)

The report was "no difference when toggling noise control options". It was
investigated with the packet logger on the live XM4, and compared against
upstream's own client recorded on the same headphones. Every NC / ambient /
level / focus / wind / off change from our UI reached the device. The device
ACKed each frame and notified the new state. Our Off and NC frames are
byte-identical to upstream's.

Upstream's ambient slider sends `ADJUSTMENT_IN_PROGRESS` (0x10). The XM4 ACKs
that frame but never applies it. Our requests always clear
`changing_asm_level`, so they go out as 0x11 / 0x01. That property is now
pinned by tests.

The full bytes, the candidates checked, and what could not be verified (audio,
the tray menu) are in
[noise-control-debug.md](<evidence/noise-control-debug.md>).

## Toggle dropouts debug (2026-10-13)

Report: upscaling, connection quality and Speak-to-Chat changes made the
headphones lose Bluetooth or lose the app. Live XM4 packet logs, the real UI
driven over CDP, and the audio endpoint's status showed:

- Speak-to-Chat: the XM4 follows the change with `SYSTEM_NTFY_PARAM
  [f9 05 02 00]` (`PREVIEW_MODE_ON_OFF`), which libmdr 4c91fe6 rejects as
  malformed; the service treated that poll error as a lost link and closed
  RFCOMM itself. Fixed: such frames are skipped.
- Connection quality: the headset itself drops RFCOMM and A2DP to apply it.
  Fixed: the service asks first and reconnects by itself afterwards.
- Upscaling: never dropped in eight live toggles; not reproduced.

Frames, timings, root causes, the renderer text contract and the regression
tests are in [toggle-dropouts-debug.md](<evidence/toggle-dropouts-debug.md>).
The probe used for it is the example
[toggle_probe.rs](<../../src-tauri/crates/mdr/examples/toggle_probe.rs>).

Open follow-ups from the 0.1.6 integration review (Minor, not fixed):

- A recovery attempt that is still connecting or initialising when
  `recovery_window` ends and then fails reports that attempt's reason (busy /
  refused) rather than `timeout`; `step()` checks the window only while idle.
- Alerts carry no id: the withdrawal rules above cover the known cases, but an
  `id` on `AlertView` matched by `RespondToAlert { id, positive }` would make
  the routing explicit.
- Renderer: the equalizer preset grid uses `aria-pressed` buttons in a
  `role="group"`; a `radiogroup` with roving tabindex and arrow keys would
  match its single-choice meaning, and `aria-disabled` would keep the selected
  preset findable while disabled. `eqCurve.ts` should guard non-finite band
  values (`Number.isFinite`) and key axis ticks by index (duplicate keys when
  the range is flat).

The 0.1.6 live check (dropout fixes, confirmation and auto-reconnect,
upscaling, Equalizer and Windows audio pages) could not reach the device: the
XM4 stayed disconnected for 20 minutes. What was checked and the checklist are
in [live-0.1.6-verification.md](<evidence/live-0.1.6-verification.md>).

The new menus (Speak-to-Chat, connection quality, automatic pause,
multipoint, the ambient slider) are not yet verified live: the 0.1.1 run
found the headphones disconnected. The checklist and how to run it are in
[live-menus-verification.md](<evidence/live-menus-verification.md>).

## Live first contact

Evidence: [live-xm4-first-contact.txt](<evidence/live-xm4-first-contact.txt>)
(the debug binary with `SOUNDCONNECT_DUMP_SNAPSHOT=1`; upstream's per-scan
`[BT]` chatter filtered, everything else verbatim). Recorded fixture:
[xm4-ready.json](<../../tests/fixtures/snapshots/xm4-ready.json>), the
`last-snapshot.json` written by that run after Ready (a real payload, for the
Task 11 mock).

What happened:

1. `[BT] Found device: name="WH-1000XM4" mac=AA:BB:CC:12:34:56 connected=32 ...`
   once the headphones connected to Windows; the service picked it by prefix.
2. XM5 UUID: `SO_ERROR=10049 (The requested address is not valid in its
   context.)` -> legacy UUID connected -> V1.
3. The first session was dropped by the device during initialisation
   (`Unable to receive from the device (No connection has been established)`,
   i.e. `recv` returned 0) seconds after the headset connected to Windows; the
   10 s back-off retry connected and reached Ready:

```text
engine: status Ready device=WH-1000XM4 address=AA:BB:CC:12:34:56 protocol=V1 lastError=-
engine: snapshot model=WH-1000XM4 firmware=2.9.0 protocol=V1 protocolVersion=0x7000 battery=Main=90% noise=Cancelling/20 ready=true features=[AMBIENT_SOUND,ASSIGNABLE_CONTROLS,AUTO_PAUSE,AUTO_POWER_OFF,BATTERY_SINGLE,CONNECTION_MODE,DSEE,EQUALIZER,GENERAL_SETTINGS,IDENTITY,NOISE_CANCELLING,PAIRED_DEVICE_MANAGEMENT,PAIRING_MODE,PLAYBACK_CONTROL,PLAYBACK_METADATA,PLAYBACK_VOLUME,SHUTDOWN,SPEAK_TO_CHAT,VOICE_GUIDANCE,WEARING_DETECTION]
```

What the XM4 reported (from the fixture): model `WH-1000XM4`, firmware
`2.9.0`, unique id `AA:BB:CC:12:34:56`, series `PREMIUM`, colour `BLACK`,
`MDRModel.protocol_version` 28672 (0x7000), codec AAC; battery 90 %, not
charging; noise cancelling (`noiseView` cancelling, `canWind` true); equalizer
preset `bright`, clear bass -1, five bands `[0, 5, 7, 7, 9]`, DSEE HX on;
playing at volume 12; auto-pause on; voice guidance on; connection mode
`stability`; speak-to-chat off. `sourceSwitchControl`, `safeListening` and
`wearingStatus` are null (not supported on V1). Twenty features available (the
list above); compared with the XM3 capture the XM4 adds `ASSIGNABLE_CONTROLS`,
`AUTO_PAUSE`, `PAIRED_DEVICE_MANAGEMENT`, `PAIRING_MODE`, `SHUTDOWN`,
`SPEAK_TO_CHAT` and `WEARING_DETECTION`.

Not yet verified live: sending commands to the XM4 (no renderer wiring yet;
covered by the replay DSEE test).

## Renderer wiring (Task 11)

The renderer now consumes `engine:status`, `engine:snapshot` and
`engine:alert` and sends commands; see the Engine wiring section of
[SoundConnect Desktop - Renderer](<../renderer/SoundConnect Desktop - Renderer.md#engine-wiring>).
No Rust changed. Verified live on 2026-10-12: commands sent from the window
reached the XM4 (`engine_send SetDsee { enabled: false }` then `true`, each
followed by `engine: applied ...`, and `engine:snapshot` events carrying
the new `dseeEnabled`), as did noise mode, volume, preset and auto power
off changes. This closes "Not yet verified live: sending commands" above.

## Commands added 2026-10-12

Six device commands for the Sound, Devices and System menus. The shapes are
exact: tag `type`, camelCase fields, and enum values as the camelCase variant
names from `crates/mdr/src/enums.rs` (a raw number is also accepted). The
renderer codes against these.

```json
{"type": "setSpeakToChat", "enabled": true, "sensitivity": "auto", "timeout": "short"}
{"type": "setConnectionMode", "audioPriority": "quality"}
{"type": "setPairedDevice", "command": "selectPlayback", "deviceId": "00:11:22:33:44:51"}
{"type": "setPairing", "enabled": true}
{"type": "setAutoPause", "enabled": false}
{"type": "setMultipoint", "enabled": false}
```

| type | fields | engine call | XM4 (V1) |
|---|---|---|---|
| `setSpeakToChat` | `enabled`, `sensitivity` (`auto`/`low`/`high`), `timeout` (`short`/`medium`/`long`/`manual`) | `Engine::set_speak_to_chat` with all three fields, as `client/Client.cpp` 1712 passes `gState.mSpeakToChat` | sends |
| `setConnectionMode` | `audioPriority` (`quality`/`stability`) | `set_connection_mode`; V1 maps to `SOUND_QUALITY_PRIOR` / `CONNECTION_QUALITY_PRIOR` | asks first (`CONFIRM_CONNECTION_MODE_CHANGE`, see [Alerts](#alerts)), then sends. Live 2026-10-13: the XM4 ACKs, notifies, then closes RFCOMM and its audio endpoint for 2-7 s; the change sticks; no device alert. The service reconnects by itself ([evidence](<evidence/toggle-dropouts-debug.md>)) |
| `setPairedDevice` | `command` (`connect`/`disconnect`/`selectPlayback`/`unpair`), `deviceId` (the `macAddress` from `pairedDevices`) | `set_paired_device`: `device_id` points at the string's bytes, `device_id_size` is its length with no NUL, like `Client.cpp` 1847-1848 (`action.device_id = mac; action.device_id_size = static_cast<uint32_t>(std::strlen(mac));`). libmdr requires 17 characters | **rejected**: libmdr 4c91fe6 `mdrHeadphonesSetPairedDevice` has `if (h->mProtocolFamily == Headphones::ProtocolFamily::V1) return MDR_RESULT_ERROR_NOT_SUPPORTED;`. Logged and dropped, nothing sent. The renderer should not offer these actions when `status.protocol == "V1"`, even though the XM4 reports `PAIRED_DEVICE_MANAGEMENT` |
| `setPairing` | `enabled` | `set_pairing` | sends |
| `setAutoPause` | `enabled` | reads `power()`, changes only `auto_pause`, clears `shutdown_requested`, `set_power` | sends; auto power off, wearing power and head gesture are unchanged (tested) |
| `setMultipoint` | `enabled` | finds the general setting whose subject is `MULTIPOINT_SETTING` (`MULTIPOINT_SUBJECT`; XM4 index 1, `GENERAL_SETTING2`) and calls `set_general_setting`. A device without one is rejected (`InvalidArgument`) | sends `GENERAL_SETTING_SET_PARAM` `d8 d2 ...` (tested). `setGeneralSetting {index: 1, value}` is equivalent |

`setNoise`, `setAmbientLevel`, `setFocusOnVoice` and the other commands are
unchanged. Replay tests (`engine_service::tests`, see [Tests](#tests)) cover
every new command. Each test plays the real XM4 capture (or the LinkBuds Clip
V2 capture, for `setPairedDevice`) and asserts that the command's frame goes
out.


## Contract changes 2026-10-12 (round 2)

The maintainer's feedback: the app "just automatically is searching" at launch; it
should remember his headphones and say they are not connected. And: the phone
app and this app "were fighting for control". This round makes the service
idle by default, remembers devices, and never writes without a user command.

### Settings

`settings.json` gains `autoConnect: boolean`, default **false**. The service
reads it once at launch (`ServiceConfig::auto_connect`). `settings_write` takes
the old four fields plus an optional `autoConnect`; a payload without it keeps
the stored value, and a changed value is forwarded to the service as
`setAutoConnect`. The engine command `setAutoConnect` also stores it.

- `autoConnect: false`: after launch the service is idle: no socket, no
  `discovering` status. Since 0.1.9 it lists Windows' connected devices every
  3 s for `windowsConnected` (enumeration only; see
  [Contract changes 0.1.9](#contract-changes-019-windowsconnected)). It
  connects only when asked (`connect`, `reconnect`), and a failure is not
  retried.
- `autoConnect: true`: the old behaviour (discover every `discovery_interval`,
  3 s since 0.1.9, retry after 10 s, or at once when Windows starts listing
  the headphones), preferring the most recently seen remembered device.

### Remembered profiles

[profiles.rs](<../../src-tauri/src/profiles.rs>) keeps
`%APPDATA%\dev.soundconnect.desktop\devices.json`:

```json
[
  {
    "address": "00:11:22:33:44:55",
    "name": "WH-1000XM4",
    "modelName": "WH-1000XM4",
    "firmware": "2.9.0",
    "protocol": "V1",
    "lastSeen": 1791808725000
  }
]
```

`lastSeen` is Unix time in milliseconds. A profile is written (or refreshed)
at every Ready, from the Windows name and libmdr's model-name and firmware
texts. A missing or invalid file means no profiles; malformed entries are
dropped.

Names and texts (0.1.4 fix). A `connect {address}` for an address with no
profile (the setup wizard's scan list) used to carry the address as the
target name, so 0.1.3 stored the maintainer's XM4 as
`"name": "AA:BB:CC:12:34:56"` beside `"modelName": "WH-1000XM4"` and the
Status card, which titled itself by `name`, showed the address. Now
`begin_connect` takes the name Windows lists for that address from the
device enumeration it already does, `Profiles::remember` never replaces a
known `name` with an empty or address-only one (nor a known `modelName` or
`firmware` with an empty one), and `refresh_profile` re-records the profile
whenever a later event brings a model name or firmware the stored profile
lacks. Old files are not rewritten; the renderer's title rule
(`rememberedTitle`, see the Renderer doc) ignores an address-shaped name, and
the next connection fills in Windows' name. Tests:
`connect_without_a_profile_remembers_the_windows_name_and_model` (XM3 replay)
and `remember_never_replaces_known_values_with_empty_or_the_address`.

### `engine:status`

```ts
type FailureReason = "notConnectedToWindows" | "busy" | "timeout" | "refused"
                   | "reconnectingAfterSettingChange";
type Profile = { address: string; name: string; modelName: string;
                 firmware: string; protocol: "V1" | "V2"; lastSeen: number };
type Status = {
  state: "disconnected" | "discovering" | "connecting" | "initialising" | "ready";
  deviceName?: string; address?: string; protocol?: "V1" | "V2";
  lastError?: string;
  reason?: FailureReason;     // after a failed connection attempt, or while reconnecting after a setting change
  remembered: Profile | null; // always present
  windowsConnected: boolean;  // always present since 0.1.9
};
```

`remembered` is the profile of `address` when the status names a device,
otherwise the most recently seen profile, otherwise `null`. So the launch
status with a known headset is
`{state: "disconnected", remembered: {...WH-1000XM4...}}`: the renderer can show
"WH-1000XM4 - Not connected" with a Connect button. `engine_status` returns
the same object from the first call (profiles are loaded before the service
returns).

| reason | when |
|---|---|
| `notConnectedToWindows` | `connect` / `reconnect` to an address Windows does not list as connected (headphones off, or connected only to the phone). No socket is opened. Offer "Open Bluetooth settings". |
| `busy` | Windows lists the device as connected but every service UUID's socket connect failed: another controller holds the control channel. |
| `timeout` | a connect attempt or init + sync did not finish in time. |
| `refused` | the device closed the link, or libmdr failed to start, before Ready. |
| `reconnectingAfterSettingChange` | with `connecting` / `initialising`: the headset dropped the link right after a connection-quality (or Speak-to-Chat / DSEE) change and the service is reconnecting by itself (see [State machine](#state-machine)). Not a failure. |

A link that drops after Ready has `lastError` but no `reason`, unless it
dropped right after a setting change (above).

### Commands (`engine_send`)

| type | fields | effect |
|---|---|---|
| `scan` | - | lists the devices Windows has connected -> `engine:devices`. Never connects. Works in every state. |
| `connect` | `address` | drops any link and connects now (works from idle). |
| `forgetDevice` | `address` | deletes the profile; when it is the connected device, also drops the link and stays disconnected. The status is re-published with the new `remembered`. |
| `setAutoConnect` | `enabled` | stores the setting and applies it now: `true` starts discovery at once; `false` stops discovering (an existing link stays). |
| `openBluetoothSettings` | - | opens `ms-settings:bluetooth` through the opener plugin (handled in `commands.rs`, not on the engine thread). |
| `reconnect` | - | connects to the latest remembered profile; without one, one discovery pass (ends in `notConnectedToWindows` when nothing is found and auto-connect is off). |
| `disconnect` | - | as before; pauses auto-connect until `connect` / `reconnect`. |

### `engine:devices`

```ts
type DevicesEvent = { devices: { address: string; name: string; remembered: boolean }[] };
```

Emitted once per `scan`, in the order Windows lists them (every connected
Bluetooth device, not just headphones; the renderer may filter by name).

### Tests

`engine_service::tests`, replaying the XM4 capture:
`launch_with_a_profile_and_auto_connect_off_stays_idle` (no connect, no TX,
only the launch status), `launch_without_profiles_reports_remembered_null`,
`manual_connect_from_idle_reaches_ready_and_learns_the_profile` (model
`WH-1000XM4`, firmware `2.9.0`, saved to the file),
`scan_lists_connected_devices_and_flags_remembered_ones`,
`forget_device_removes_the_profile_and_drops_its_link`,
`connect_to_a_device_windows_does_not_list_is_not_connected_to_windows`,
`a_listed_device_whose_channel_will_not_open_is_busy`,
`set_auto_connect_starts_discovery_from_idle`; plus `profiles::tests` and
`settings::tests::input_without_auto_connect_keeps_the_stored_value`.

## Contract changes 0.1.9: `windowsConnected`

The maintainer saw "Couldn't connect" while the headphones were simply
switched off: a failed attempt stayed on screen however Windows' state
changed. Since 0.1.9 the status says what Windows sees.

- `StatusView.windows_connected` (`windowsConnected`, always serialised): with
  `disconnected` / `discovering`, whether Windows' device list (upstream's
  `mdrConnectionGetDevicesList`, which lists only devices Windows has
  connected) holds the watched device: the status's `address`, else the most
  recently seen profile, else (nothing remembered) any name starting `WH-`,
  `WF-` or `LinkBuds`. `connecting`, `initialising` and `ready` always carry
  `true`. `set_status` fills it from the worker's `windows_listed`, so every
  publish agrees.
- `windows_listed` is updated by the idle check (`check_windows`, every
  `discovery_interval` = 3 s while idle and not auto-discovering), by every
  discovery pass (`scan`) and by `begin_connect`'s own list.
- `note_windows`: when the listed state changes, a `disconnected` status drops
  its `lastError` and `reason` (that failure belonged to the old Windows
  state) and re-publishes; when the headphones appear with auto-connect on
  and not suspended, `next_scan` is set to now, so the same check connects at
  once instead of after `retry_backoff`.
- The idle check is enumeration only: in the tests
  `h.connects` stays empty while the headset is toggled.

The renderer maps this onto five states (Renderer, Connection flow): "Off or
out of range", "Connected to Windows", "Connecting…" / "Reconnecting to …",
"Couldn't connect" (only `busy`, `timeout`, `refused` while listed) and
"Connected".

Tests ([engine_service.rs](<../../src-tauri/src/engine_service.rs>)):
`idle_polling_publishes_windows_connected_transitions` (auto-connect off, a
replay transport whose device list a test toggles: `windowsConnected` goes
false, true, false with no connect; a Connect while off fails with
`notConnectedToWindows`, and switching the headset on clears that failure)
and `auto_connect_connects_when_windows_lists_the_headset` (Discovering with
`windowsConnected: false` until the list holds it, then Ready). The test
helper `states()` now folds repeated states, since a `windowsConnected`
change re-publishes the same state.

## Updates (0.1.9)

The maintainer asked for "a normal app update sequence": a new GitHub release
should install from inside the app. 0.1.9 is the first version that can;
0.1.8 users install 0.1.9 by hand once, after that 0.1.10 and later arrive
in-app.

- **Plugins**: `tauri-plugin-updater =2.13.3` and `tauri-plugin-process
  =2.4.0`, registered in [lib.rs](<../../src-tauri/src/lib.rs>);
  [capabilities/default.json](<../../src-tauri/capabilities/default.json>)
  grants `updater:default` (check, download, install) and
  `process:allow-restart`.
- **Config** ([tauri.conf.json](<../../src-tauri/tauri.conf.json>)):
  `plugins.updater.pubkey` (the minisign public key), `endpoints:
  ["https://github.com/B-Howell/soundconnect-desktop/releases/latest/download/latest.json"]`
  (GitHub redirects `latest` to the newest non-draft release),
  `windows.installMode: "passive"` (the NSIS installer shows progress only),
  and `bundle.createUpdaterArtifacts: true` so the build writes
  `<installer>.sig`.
- **Manifest**: the release job writes `latest.json` (Build Toolchain,
  Releases). The plugin compares its `version` with the running one, downloads
  `platforms.windows-x86_64.url`, and refuses it unless the signature verifies
  against `pubkey`.
- **Flow** (renderer, see Renderer, Updates): a few seconds after launch,
  once a day while "Check for updates automatically" is on (default), or on
  Settings > Updates > Check now, `check()`; a found update shows a banner
  (Install now / Later / Release notes); Install now downloads with a
  progress bar, runs the installer, which closes the app and, by the plugin's
  default, starts it again; `relaunch()` follows in case it did not.
  Offline and signature failures show as plain sentences.
- **Keys**: generated 2026-10-14 with `pnpm tauri signer generate` into
  `%APPDATA%\soundconnect-signing\` on the maintainer's PC, password in
  `PASSWORD.txt` there; both stored as the repository secrets
  `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Never
  in the repository.
- **Rotating the key**: installed apps trust only the `pubkey` they were
  built with. To rotate, generate a new pair, put the new public key in
  `tauri.conf.json`, and ship that version **signed with the old key** (keep
  the old secrets for that one release); once users run it, replace the
  secrets with the new private key and password. If the old key is lost,
  that bridge is impossible: users must download the next installer by hand.

Verification: `pnpm tauri signer verify` does not exist in CLI 2.12; the
check is that the `.sig` in `latest.json` equals the uploaded `.sig` asset
and that the updater accepts it (the app's own install). Tests:
[UpdateBanner.test.tsx](<../../tests/updates/UpdateBanner.test.tsx>) with
the updater api mocked.

## Coexisting with the Sony phone app

Both controllers can write. The XM4 accepts settings from the phone (Sony
Sound Connect, over its own Bluetooth link) and from this app at the same
time; it applies whichever arrives last and notifies every connected
controller with a `*_NTFY_PARAM`. Last writer wins. This app only mirrors
those notifications; it never writes unless the user changed something in
this app (window or tray).

### What was wrong

libmdr keeps three values per property (`libmdr/src/Property.hpp`):
`desired` (staged by a setter), `current` (the device) and `submitted`, plus a
staging revision. A device notification calls `overwrite`, which updates
`desired` only when no un-submitted stage exists:

```cpp
void overwrite(const T& value) { current = value; if (revision == submittedRevision) desired = value; }
```

The service used to commit whenever `is_dirty()` (`desired != current`). A
command that staged an unchanged value (re-clicking the current noise mode in
the window or the tray) bumped the revision but was never committed, because
nothing was dirty. The next time the phone changed that setting, libmdr kept
our stale `desired`, `is_dirty()` turned true, and the loop wrote our old
value back: the fight the maintainer saw. Reproduced on the replay: with the old loop
the regression test below sends `68 02 11 01 02 01 00 00` (NC on) right after
the device reports ambient.

### The rule now

Every path in [engine_service.rs](<../../src-tauri/src/engine_service.rs>)
that can put a frame on the wire:

| path | sends | when |
|---|---|---|
| `request_init` / `request_sync` | GET requests (reads) | once at connect; `request_sync` again only on libmdr's `NeedSync` |
| ACKs | the protocol ACK of each device frame | always (libmdr; the protocol requires it) |
| `commit` | the staged settings | **only** right after `apply_pending` applied a user command (`commit_owed`). Always committed, even when nothing changed, which resynchronises libmdr's revisions so later notifications update `desired` too |
| `respond_to_alert` | the alert answer | the user's answer, or the XM3's `DISCONNECT_CAUSED_BY_CONNECTION_MODE_CHANGE` auto-answer (a reply to the device's own question) |
| tray | nothing by itself | `TraySink::refresh` only rebuilds the tooltip and menu; a menu click sends one `setNoise`, like the window |

There is no periodic commit and no optimistic state in the service: snapshots
are libmdr's `current` values (every getter reads `.current`), so a
notification from the phone is published at once. If libmdr ever reports
dirty state without an owed commit, the service logs `engine: staged state
differs from the device without a command; not writing it` once per link and
leaves it alone.

Tests: `no_tx_for_1000_ticks_after_ready_without_a_command` (not one TX byte
for 1000 live ticks after Ready) and
`a_device_notification_wins_over_a_no_op_command_and_is_never_written_back`
(re-select NC, then the device reports ambient 10 from
`soundconnect-02-rx.cmd-NCASM_NTFY_PARAM-69.bin`; the snapshot shows ambient
10 and over 1000 ticks only ACKs go out). The second test fails on the old
loop.

Live check: `live_xm4_idle_sends_nothing_but_acks` (ignored by default) connects
to a real XM4 through `WindowsTransport`, reaches Ready and idles for
`SOUNDCONNECT_IDLE_SECS` (120) with the packet log on; count the `packet: tx`
lines after `live: Ready`. On 2026-10-12 it could not run: the XM4 was paired
but not connected to Windows (`GetDevicesList returning 0 device(s)`), so the
zero-write claim rests on the replay tests above. Rerun it when the headset is
connected.
