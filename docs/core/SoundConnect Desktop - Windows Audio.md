---
title: "SoundConnect Desktop - Windows Audio"
date: 2026-10-13
tags: [core, rust, windows-audio, bluetooth]
project: "SoundConnect Desktop"
area: "core"
---

# SoundConnect Desktop - Windows Audio

**Status (2026-10-13): built and read live on the maintainer's PC.** The `winaudio`
crate reads every Windows-side setting that changes what reaches the
headphones, builds "Fix for music" / "Fix for calls" / "Restore" plans, and
applies changes one at a time with a read-back of each. Admin changes run in
the app's own exe relaunched elevated. The renderer shows it all on the
"Windows audio" page ([Renderer](<../renderer/SoundConnect Desktop - Renderer.md#windows-audio-page>)).
Design input and the measured facts behind every value:
[Windows Audio Settings Research](<../research/SoundConnect Desktop - Windows Audio Settings Research.md>).

| File | Role |
|---|---|
| [Cargo.toml](<../../src-tauri/crates/winaudio/Cargo.toml>) | The crate: `windows` 0.62.2 and `winreg` 0.56.0 (both already in the lock through Tauri), `windows-core` for the interface macro |
| [lib.rs](<../../src-tauri/crates/winaudio/src/lib.rs>) | Public API: `snapshot`, `apply`, `apply_admin`, `apply_plan` (admin first), `restore`, `run_admin_cli` |
| [model.rs](<../../src-tauri/crates/winaudio/src/model.rs>) | `WinAudioSnapshot`, `Change` (tagged `kind`), `ChangeResult`, `Plan`, preview sentences, `needs_admin` |
| [plan.rs](<../../src-tauri/crates/winaudio/src/plan.rs>) | Pure `fix_plan(kind, snapshot)` and `restore_plan(before, now)` |
| [sys/read.rs](<../../src-tauri/crates/winaudio/src/sys/read.rs>) | Assembles the snapshot; `DeviceEndpoints` finds the device's endpoints by address and container |
| [sys/registry.rs](<../../src-tauri/crates/winaudio/src/sys/registry.rs>) | MMDevices endpoint database, ducking, mono, absolute volume, SDP cache |
| [sys/audio.rs](<../../src-tauri/crates/winaudio/src/sys/audio.rs>) | Core Audio: defaults, volume, spatial (best effort), and the local `IPolicyConfig` for every endpoint write |
| [sys/bluetooth.rs](<../../src-tauri/crates/winaudio/src/sys/bluetooth.rs>) | Hands-Free / Headset services: `BluetoothEnumerateInstalledServices`, `BluetoothSetServiceState` |
| [sys/adapter.rs](<../../src-tauri/crates/winaudio/src/sys/adapter.rs>) | The radio's devnode (SetupAPI) and `MSPower_DeviceEnable` (WMI `root\wmi`) |
| [sys/system.rs](<../../src-tauri/crates/winaudio/src/sys/system.rs>) | `bthserv` state, 2.4 GHz Wi-Fi |
| [sys/apply.rs](<../../src-tauri/crates/winaudio/src/sys/apply.rs>) | Write, then read back; a failed change stops the batch |
| [sys/elevate.rs](<../../src-tauri/crates/winaudio/src/sys/elevate.rs>) | `runas` relaunch with `--apply-admin <hex>` (changes on the command line, no files), the helper's allow-list, exit codes and the unelevated read-back |
| [sys/mod.rs](<../../src-tauri/crates/winaudio/src/sys/mod.rs>) | Module wiring |
| [tests/plans.rs](<../../src-tauri/crates/winaudio/tests/plans.rs>) | Plan and restore tests on the recording |
| [examples/snapshot.rs](<../../src-tauri/crates/winaudio/examples/snapshot.rs>) | Prints or records a snapshot (PC name scrubbed) |
| [examples/fix_plan.rs](<../../src-tauri/crates/winaudio/examples/fix_plan.rs>) | Prints the fix plan for a recorded snapshot (the mock serves these) |
| [examples/enhancements_probe.rs](<../../src-tauri/crates/winaudio/examples/enhancements_probe.rs>) | Live read-back proof: enhancements off -> on -> off |
| [test-pc.json](<../../src-tauri/fixtures/winaudio/test-pc.json>) | The snapshot recorded on the maintainer's PC |
| [plan-music.json](<../../src-tauri/fixtures/winaudio/plan-music.json>), [plan-calls.json](<../../src-tauri/fixtures/winaudio/plan-calls.json>) | The crate's plans for that recording |
| [winaudio_commands.rs](<../../src-tauri/src/winaudio_commands.rs>) | Tauri commands, the restore point file, the helper entry |
| [lib.rs](<../../src-tauri/src/lib.rs>) | Exits into the helper before Tauri starts; registers the commands |

## What is read, and how

All reads are user-level. The endpoint data comes from the registry database
the Audio service keeps (`HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\{Render,Capture}\{guid}`),
which any user can read; the live checks on 2026-10-13 quoted these values
for the XM4 endpoint `{33f2e282-497a-462e-89e8-70ce4e01ffdc}`:

```
{b3f8fa53-0004-438e-9003-51a46e139bfc},2 = {1}.BTHENUM\{0000110B-0000-1000-8000-00805F9B34FB}_VID&0002054C_PID&0D58\B&20AEEBD0&0&AABBCC123456_C00000000
{8c7ed206-3f8a-4827-b3ab-ae9e1faefc6c},2 = 72 0 0 0 1 0 0 0 22 77 151 162 ...   (VT_CLSID container id)
{f19f064d-082c-4e27-bc73-6882a1bb8e4c},0 = 65 0 0 0 1 0 0 0 254 255 2 0 128 187 0 0 ... (WAVEFORMATEXTENSIBLE, 48000 Hz, 16-bit)
FxProperties {1da5d803-d492-4edd-8c23-e0c0ffee7f0e},5 = 1   (Disable_SysFx: enhancements off)
```

| Snapshot field | Source |
|---|---|
| `stereo` | Render endpoint whose instance id (`...,2`) names the address and is A2DP (`{0000110B-...}`); several (a stale one exists on this PC, `DeviceState` 0x22000004 = not present): active first |
| `handsFreeRender`, `handsFreeCapture` | Active Bluetooth endpoints in the same device container (`{8c7ed206-...},2`), not A2DP. HFP endpoints' instance ids (`BTHHFENUM\...`) do not carry the address, hence the container match |
| `handsFreeOffered` | The device's cached SDP records (`BTHPORT\Parameters\Devices\<addr>\DynamicCachedServices`) name "Hands-Free" or "Headset"; on this PC record `00010000` reads `...Hands-Free unit...` |
| `handsFreeEnabled` | `BluetoothEnumerateInstalledServices` lists `0000111E` or `00001108` |
| `default*` | `IMMDeviceEnumerator::GetDefaultAudioEndpoint` (render/capture, `eConsole` and `eCommunications`); `isThisDevice` by the same address/container rule |
| `enhancementsEnabled` | `Disable_SysFx` in FxProperties absent or 0 |
| `defaultFormat` | `PKEY_AudioEngine_DeviceFormat` blob |
| `exclusiveModeAllowed`, `exclusivePriority` | `{b3f8fa53-...},3` / `,4`; absent = on |
| `spatialSound` | Best effort: `ISpatialAudioClient::GetMaxDynamicObjectCount` > 0 on the active endpoint; `unknown` when not active (no public getter exists) |
| `duckingMode`, `monoAudio` | `HKCU\Software\Microsoft\Multimedia\Audio` `UserDuckingPreference` (0-3, absent = 80 %), `AccessibilityMonoMixState` |
| `absoluteVolumeDisabled` | `HKLM\SYSTEM\CurrentControlSet\Control\Bluetooth\Audio\AVRCP\CT\DisableAbsoluteVolume` |
| `windowsVolumePercent` | `IAudioEndpointVolume::GetMasterVolumeLevelScalar` (active endpoint only) |
| `adapter` | First present `GUID_BTHPORT_DEVICE_INTERFACE` devnode: friendly name, `DEVPKEY_Device_DriverVersion`; `powerSavingAllowed` from WMI `MSPower_DeviceEnable.Enable` whose `InstanceName` starts with the devnode's instance id |
| `bluetoothServiceRunning` | `QueryServiceStatus(bthserv)` |
| `wifi24Active` | A connected WLAN interface on channel 1-14 |
| `codec` | Passed in by the renderer from the engine snapshot |

Each failed read leaves its field `null` and adds a line to `errors`.

## Live snapshot on the maintainer's PC (2026-10-13)

`cargo run -p winaudio --example snapshot -- AA:BB:CC:12:34:56 AAC`, recorded
as [test-pc.json](<../../src-tauri/fixtures/winaudio/test-pc.json>). The XM4
was paired but its audio was not connected to Windows at the time, so the stereo endpoint read `unplugged` and the
defaults were the PreSonus Eris speakers and the Snowball mic. Hands-Free
offered but off; enhancements off; 48 kHz / 16-bit; exclusive mode allowed
with priority; ducking "Do nothing"; absolute volume on; mono off; MediaTek
Bluetooth Adapter, driver 1.1037.0.429, power saving allowed; `bthserv`
running; no 2.4 GHz Wi-Fi; `errors` empty. This matches the research note's
table except the connection state.

## Changes, read-back, admin

| `Change` | Write | Read back | Level |
|---|---|---|---|
| `setDefaultEndpoint` (console + multimedia, or communications) | `IPolicyConfig::SetDefaultEndpoint` per role | `GetDefaultAudioEndpoint` | User |
| `useHandsFreeForCommunications` | Waits up to 15 s for the HFP endpoints, then sets both communications defaults | both defaults | User |
| `setEnhancements` | `IPolicyConfig::SetPropertyValue(fx = TRUE, Disable_SysFx, VT_UI4)` | FxProperties value | User |
| `setFormat` | `GetDeviceFormat`, new rate/bits, `SetDeviceFormat` (device and mix) | DeviceFormat blob | User |
| `setExclusiveMode` | `SetPropertyValue(fx = FALSE, ,3 / ,4, VT_BOOL)` | the two values | User |
| `setDucking`, `setMonoAudio` | HKCU DWORD | same value | User |
| `setHandsFree` | `BluetoothSetServiceState` for HFP and HSP (`ERROR_INVALID_PARAMETER` = already so) | installed services, up to 15 s | **Admin** |
| `setAbsoluteVolumeDisabled` | HKLM DWORD | same value | **Admin** |
| `setAdapterPowerSaving` | WMI `Put("Enable")` + `PutInstance(UPDATE_ONLY)` | WMI value | **Admin** |

A write that fails, or whose read-back does not match within 2 s (15 s for
driver work), marks the result `verified: false` and every later change in the
batch is reported "Skipped after an earlier change failed." `apply` refuses
admin changes and `apply_admin` refuses user ones.

### Elevation flow

1. `winaudio_apply_admin` serialises the changes as JSON and hex-encodes it
   (only `0-9a-f`, so no command-line quoting is involved).
2. `ShellExecuteExW("runas", <own exe>, "--apply-admin <hex>", SW_HIDE)`:
   one UAC prompt per batch. A declined prompt (`ERROR_CANCELLED`) returns every
   admin change as "The Windows permission prompt was declined."; the
   renderer's user-level changes still run.
3. In the elevated copy, `run()` calls `winaudio_commands::admin_entry()`
   before any Tauri plugin (single-instance would otherwise hand the launch to
   the running app). The helper decodes the argument (at most 16 KiB of hex),
   parses `Vec<Change>`, refuses an empty list or anything that is not an admin
   kind (exit 2 / 3 / 4), applies with read-back, stops at the first failure
   and exits `0`, or `100 + index` of the change that failed. It reads and
   writes no files.
4. The unelevated side waits up to 120 s for the exit code, then reads every
   reported change back itself (`apply::admin_reads_back`: the Hands-Free
   service state, the absolute-volume registry value and the adapter's
   power-management flag are all readable without admin rights), so the
   results the renderer sees are verified by this process.

Why no files (integration review, 0.1.6): the first version wrote a plan file
to `%TEMP%\SoundConnect Desktop winaudio\` and had the helper write
`<plan>.result.json` there. Any user-level process could rewrite the plan while
the UAC prompt was open, or turn the folder (or the result name) into a
junction / link so the elevated helper wrote a file elsewhere as admin; and
with over-the-shoulder UAC (a different admin account) the helper's `%TEMP%`
differs, so it refused every plan. Passing the changes on the command line and
reading back unelevated removes every admin file access.

Not yet run live: no admin change was made during this task (the maintainer's
Hands-Free and power settings were not to be touched), so the UAC path,
`BluetoothSetServiceState` and the WMI write are unit-checked only (the
helper's argument refusals, exit-code to result mapping, `apply_admin`
refusing user changes, and the `SetFormat` allow-list of 44.1 / 48 / 88.2 /
96 kHz and 16 / 24 / 32 bit, checked before any COM call).

### `IPolicyConfig`

Declared locally in [sys/audio.rs](<../../src-tauri/crates/winaudio/src/sys/audio.rs>)
(IID `f8679f50-850a-41cf-9c72-430f290290c8`, CLSID
`870af99c-171d-4f9e-af0d-e63df40c2bc9`), method order GetMixFormat,
GetDeviceFormat, ResetDeviceFormat, SetDeviceFormat, GetProcessingPeriod,
SetProcessingPeriod, GetShareMode, SetShareMode, GetPropertyValue(device,
bFxStore, key, value), SetPropertyValue(device, bFxStore, key, value),
SetDefaultEndpoint, SetEndpointVisibility. Checked against two independent
public definitions:

1. AudioDeviceCmdlets 3.1.0.2 (installed on this PC), type
   `CoreAudioApi.Interfaces.IPolicyConfig`, read by .NET reflection from
   `AudioDeviceCmdlets.dll`: GUID `f8679f50-850a-41cf-9c72-430f290290c8`, the
   twelve methods in that order, `GetPropertyValue(String pszDeviceName,
   Boolean bFxStore, IntPtr key, IntPtr pv)`; `_PolicyConfigClient` GUID
   `870af99c-171d-4f9e-af0d-e63df40c2bc9`.
2. The community header `IPolicyConfig.h` in
   [tartakynov/audioswitch](https://github.com/tartakynov/audioswitch/blob/master/IPolicyConfig.h):
   the same IID, CLSID and twelve methods in the same order.

EarTrumpet's `IPolicyConfigWin7` agrees on the IID and on slots 9-12 but
omits `bFxStore`; the live probe below settles it: the call with `bFxStore`
wrote FxProperties.

**Live read-back proof** (the one write allowed on the maintainer's PC):
`cargo run -p winaudio --example enhancements_probe -- AA:BB:CC:12:34:56`
flipped enhancements on then off on the XM4 endpoint; both results were
`"applied":true,"verified":true` and the final registry value was back to
`{1da5d803-...},5 = 1` (the original). Exclusive mode, format and default
endpoint writes were not run live.

## Tauri commands and the restore point

[winaudio_commands.rs](<../../src-tauri/src/winaudio_commands.rs>):
`winaudio_snapshot(address, codec)`, `winaudio_fix_preset(kind, address,
codec)` (`kind`: `music` | `calls`, returns the `Plan`),
`winaudio_apply(address, changes)`, `winaudio_apply_admin(address, changes)`,
`winaudio_restore(codec)`, `winaudio_restore_point()`,
`winaudio_forget_restore_point()`, and `winaudio_open_settings(page)` (only
`sound` -> `ms-settings:sound` and `accessibility` ->
`ms-settings:easeofaccess-audio`). All but the last are async and run on a
blocking thread, so a UAC prompt never freezes the window. App commands need
no capability entry (the app defines no command manifest), so
`src-tauri/capabilities/` is unchanged.

The restore point is `winaudio-before.json` in the app config folder
(`%APPDATA%\dev.soundconnect.desktop`): the snapshot taken just
before the first change SoundConnect makes (any apply, fix or single
switch). It is never overwritten; Restore diffs it against a fresh snapshot
(`restore_plan`) and applies the difference (admin first); "Forget restore
point" deletes it. Defaults go back only to endpoints recorded then;
endpoint settings only on the same stereo endpoint id.

## Plans

- **Fix for music**: Hands-Free off (admin) if on; the stereo endpoint as
  default and calls playback, only while it is active (else a note); a
  non-Bluetooth active mic for any default that is the headphones' mic (else
  a note); enhancements off; ducking "Do nothing"; mono off; absolute volume
  on (admin) only if off; a note if spatial reads on. Power saving is not in
  it (it costs battery on a laptop).
- **Fix for calls**: if the headphones offer Hands-Free: Hands-Free on
  (admin) unless on, then `useHandsFreeForCommunications` unless both
  communications defaults already are the HFP endpoints; a note that music
  is mono while a call app uses the mic. Without Hands-Free on offer, only a
  note.

## Risks (from the research, as handled)

- Hands-Free off removes the headphone mic: the calls plan undoes it in one
  click; the preview says so.
- Hands-Free comes back after re-pairing or updates: the page re-reads on
  focus and every 10 s and the row then shows "On" against "Off"; nothing
  re-applies by itself.
- Enabling/disabling the service churns endpoints: `useHandsFreeForCommunications`
  waits for them; not yet observed live.
- `IPolicyConfig` is undocumented: every write is read back; a mismatch stops
  the batch.
- Absolute volume needs a reconnect; it is only in the music fix when off.

## Tests

`cargo test -p winaudio`: 17 (9 in [tests/plans.rs](<../../src-tauri/crates/winaudio/tests/plans.rs>)
on the recording: recorded facts, music while unplugged / connected / after
Windows undid things, calls, restore empty and full, serde tags, raw value
decoding; 2 in `registry.rs` on the recorded format blob and id/key mapping;
5 in `elevate.rs` on the launch check, the helper's refusals of missing,
malformed, oversized, user-level and empty plans, the decoded plan reaching the
apply step with the failing index in the exit code, and the exit-code to result
mapping with the unelevated read-back; 1 in `apply.rs` refusing an unsupported
`SetFormat` before any COM call).
