---
title: "SoundConnect Desktop - Windows Audio Settings Research"
date: 2026-10-13
tags:
  - research
  - windows-audio
project: "SoundConnect Desktop"
area: "research"
---

# SoundConnect Desktop - Windows Audio Settings Research

Design input for a "Windows audio" page that would make SoundConnect Desktop
the one place to get Bluetooth headphone audio right on a Windows PC. This
note lists every Windows-side setting found that changes what reaches a Sony
Bluetooth headphone. For each one it covers what the setting is, how it
changes the sound, where Windows shows it, how a desktop app can read and
change it, whether that needs admin, and whether the change can be undone.
It closes with a proposed page, crate choices, an elevation strategy, risks
and a test plan.

No code was changed. The machine facts below were read-only inspections of
the maintainer's PC on 2026-10-13 (Windows 11 Pro 26H2, build 10.0.26300) with the
WH-1000XM4 connected.

## What the maintainer's PC looks like today (measured)

| Fact | Evidence (read-only) |
| --- | --- |
| XM4 render endpoint `Headphones (WH-1000XM4)`, id `{0.0.0.00000000}.{33F2E282-497A-462E-89E8-70CE4E01FFDC}`, driver `microsoft_bluetooth_a2dp_src.inf` / `BthA2dpSrc` 10.0.26100.1 | `Get-PnpDevice -Class AudioEndpoint`; endpoint property `{83da6326-97a6-4088-9453-a1923f573b29},3` under `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Render\{33F2E282-...}\Properties` |
| **No Hands-Free node and no XM4 microphone endpoint.** The XM4 device nodes are A2DP sink (`{0000110B-...}`, class MEDIA), two AVRCP transports (`110C`, `110E`), and Sony/Airoha/Google/Alexa vendor RFCOMM services. There is no `{0000111E-...}` (Hands-Free) or `{00001108-...}` (Headset) node. | `Get-PnpDevice` filtered on `AABBCC123456` |
| The headphones **do** advertise Hands-Free and Headset: the cached SDP records include "Hands-Free unit" and "Headset". So the Hands-Free Telephony and Headset services were turned off on this PC, not missing on the device. | `HKLM\SYSTEM\CurrentControlSet\Services\BTHPORT\Parameters\Devices\aabbcc123456\DynamicCachedServices` (records `00010000`, `00010001`) |
| Default playback **and** default communications playback = XM4 headphones; default recording **and** communications recording = Blue Snowball USB mic | `Get-AudioDevice -List` (AudioDeviceCmdlets 3.1.0.2) |
| Endpoint device format = 48 000 Hz, 16-bit, 2 channels (`WAVE_FORMAT_EXTENSIBLE`) | `PKEY_AudioEngine_DeviceFormat` `{f19f064d-082c-4e27-bc73-6882a1bb8e4c},0` = `FE FF 02 00 80 BB 00 00 00 EE 02 00 04 00 10 00` |
| The endpoint stores 44 100 and 48 000 Hz as its rate list (key name not identified) | `{74e4357a-7959-47a4-a8b2-feb2ffd48427},2` contains `44 AC 00 00 80 BB 00 00` |
| Audio enhancements **off** for the XM4 endpoint | `PKEY_AudioEndpoint_Disable_SysFx` `{1da5d803-d492-4edd-8c23-e0c0ffee7f0e},5` = 1 in `FxProperties` |
| The endpoint carries the Microsoft "Home Theater Effects" APO chain (the source of loudness equalization, bass boost, virtual surround) | `FxProperties` `{b725f130-...},10` = "Microsoft Audio Home Theater Effects" plus SFX/MFX/EFX CLSIDs under `{d04e05a6-...}` |
| Spatial formats offered: Windows Sonic, Dolby Atmos (two), DTS (two). Which one is active could not be decoded from the registry. | `{a45429a4-aa63-4480-b7f8-3f2552daee93},2..6` |
| Exclusive mode keys absent, so both "Allow exclusive" and "Give exclusive priority" are on (Windows default) | no `{b3f8fa53-0004-438e-9003-51a46e139bfc},3`/`,4` values |
| Communications ducking = **Do nothing** | `HKCU\Software\Microsoft\Multimedia\Audio\UserDuckingPreference` = 3 |
| Absolute volume **on** (default) | `HKLM\SYSTEM\ControlSet001\Control\Bluetooth\Audio\AVRCP\CT\DisableAbsoluteVolume` = 0 |
| Bluetooth adapter: MediaTek Bluetooth Adapter `USB\VID_0489&PID_E0E2&MI_00`, driver 1.1037.0.429, Mediatek Inc., dated 2024-05-07. It is the Bluetooth half of a **MediaTek MT7922 (RZ616) Wi-Fi 6E combo card**. | `Get-PnpDeviceProperty DEVPKEY_Device_DriverVersion/Provider/Date`; `Get-NetAdapter` |
| Wi-Fi is currently **disconnected**; the PC is on 2.5 GbE Ethernet. 2.4 GHz coexistence is not hurting the maintainer right now. | `Get-NetAdapter`, `netsh wlan show interfaces` |
| Adapter power management "Allow the computer to turn off this device" = **on**; USB selective suspend is enabled in the power plan (AC and DC) and the adapter's `DeviceSelectiveSuspended` = 1 | WMI `root\wmi MSPower_DeviceEnable.Enable` = True; `powercfg /q` USB selective suspend index 1; `Enum\USB\VID_0489&PID_E0E2...\Device Parameters` |
| The same radio also carries a Keychron K8 Pro (Classic) and an MX Master 3S (LE) | `Get-PnpDevice -Class Bluetooth` |
| Services: `bthserv` (Bluetooth Support), `BTAGService` (Audio Gateway, the HFP side), `BthAvctpSvc` (AVRCP) all Running, start type Manual (trigger-started) | `Get-CimInstance Win32_Service` |
| Mono audio not set (stereo); Auto Game Mode off | `HKCU\Software\Microsoft\Multimedia\Audio` has no `AccessibilityMonoMixState`; `HKCU\Software\Microsoft\GameBar\AutoGameModeEnabled` = 0 |

So the maintainer's PC already has the "music" setup: no Hands-Free, enhancements
off, ducking off, a separate USB mic. The page's first job is to **show**
that and keep it that way when Windows updates or re-pairing undo it.

## Control levels used below

- **User**: our normal (non-elevated) process can read and change it.
- **Admin**: needs one UAC prompt (an elevated helper).
- **Read-only**: we can show it but cannot change it in a supported way;
  we deep-link to the Windows page instead.
- **Not possible**: no reliable way to read or change it.

## 1. Hands-Free profile (HFP / HSP)

**What.** Classic Bluetooth headphones carry two audio links: A2DP (stereo,
music quality, playback only) and Hands-Free/Headset (HFP/HSP: mono, voice
quality, with the headphone mic). Windows makes two playback endpoints
(`Headphones` = A2DP, `Headset` / `Hands-Free AG Audio` = HFP) and one
capture endpoint (the headphone mic, HFP only).

**How it degrades audio.** When any app opens the headphone mic (Teams,
Discord, a game's voice chat, even a mic-level meter), the headphones must
switch to HFP. Bluetooth Classic cannot carry A2DP and HFP at the same
time, so **all** output drops to mono voice quality: 8 kHz CVSD, or 16 kHz
mSBC if both sides support Wideband Speech. Music sounds like a phone call
until the app releases the mic. DSEE and the EQ still run in the headphones
but have little to work with.

**Where Windows shows it.**
- Control Panel > Hardware and Sound > Devices and Printers (in 24H2+ via
  Settings > Bluetooth & devices > Devices > More devices and printer
  settings) > right-click WH-1000XM4 > Properties > Services > "Handsfree
  Telephony" (and "Headset" on some devices). Unticking removes the device
  driver and the Headset endpoint.
- Device Manager > Sound, video and game controllers / Bluetooth >
  "WH-1000XM4 Hands-Free AG Audio" (or "...Hands-Free") > Disable device.
- Sound control panel (`mmsys.cpl`) > Playback/Recording > right-click the
  Headset endpoint > Disable (endpoint-level only; the profile still exists).

**How an app reads it.**
- Device nodes: `SetupDiGetClassDevs` / `CM_Get_Child` under the device
  container, or WinRT `Windows.Devices.Enumeration.DeviceInformation` with an
  AQS filter on `System.Devices.Aep.ContainerId`, looking for
  `BTHENUM\{0000111E-0000-1000-8000-00805F9B34FB}_...` (HFP) and
  `{00001108-...}` (HSP). Present and enabled = Hands-Free on. This is what
  showed it is off on the maintainer's PC. **User level.**
- Whether the device offers HFP: the cached SDP records under
  `HKLM\SYSTEM\CurrentControlSet\Services\BTHPORT\Parameters\Devices\<addr>\DynamicCachedServices`
  (readable as a user), or `BluetoothEnumerateInstalledServices`
  (bthprops) for the installed list.
- Capture endpoint: `IMMDeviceEnumerator::EnumAudioEndpoints(eCapture,
  DEVICE_STATEMASK_ALL)` and match `PKEY_Device_ContainerId` to the XM4's.

**How an app changes it.**
- **Preferred: `BluetoothSetServiceState(hRadio, &deviceInfo,
  &HandsfreeServiceClass_UUID /* 0000111E-... */, BLUETOOTH_SERVICE_DISABLE)`**
  (bthprops.cpl / BluetoothApis.dll). Microsoft documents that disabling a
  service "removes the corresponding device driver" and enabling installs
  it. It is the same switch as the Services checkbox, so the result looks
  native. Repeat for `HeadsetServiceClass_UUID` (`00001108-...`). Already
  disabled returns `E_INVALIDARG`; treat that as "already in that state".
  Driver install/remove is an admin operation, so plan for **Admin** (the
  docs do not state it; to verify in the first implementation).
- Alternative: `Disable-PnpDevice` / `CM_Disable_DevNode` /
  `SetupDiChangeState(DICS_DISABLE)` on the Hands-Free node. **Admin.**
  Keeps the node but disabled; it can come back after re-pairing.
- Endpoint-only: `IPolicyConfig::SetEndpointVisibility(id, FALSE)` hides the
  Headset endpoint. Weaker: an app that opens the mic by device id can still
  pull the link to HFP.
- **Reversible**: yes, enable the same service again. Re-pairing the
  headphones also brings it back (Windows installs every offered service on
  pair), and forum reports say Windows Update or a restart can re-enable it.
  So the app should **watch** for the node coming back and offer to re-apply.

**Windows 11 24H2+ and LE Audio.** Windows 11 24H2 added LE Audio (LC3)
and in 2025 "super wideband stereo": an LE Audio headset can play stereo
while its mic is in use, and the mic is sampled at 32 kHz. It needs both an
LE Audio-capable adapter driver and an LE Audio headset; the toggle is
"Use LE Audio" under Bluetooth & devices. The **WH-1000XM4 is Bluetooth
Classic only**, so none of this helps it: on the XM4 the choice remains
"stereo or mic". (Newer Sony models such as the WH-1000XM6 do LE Audio;
the page should show the LE Audio toggle state for those only.) The
MediaTek driver here does not expose LE Audio for the XM4.

**Recommendation.** Music: Hands-Free and Headset off; use a separate mic
(the maintainer already uses the Snowball). Calls with the headphone mic: turn
Hands-Free on and accept mono.

**Control level: Admin** (read: User).

## 2. A2DP codec

**What.** The A2DP codec carries the stereo stream. Windows' own A2DP
source driver (`BthA2dpSrc`, measured above) negotiates **SBC** and
**AAC** (AAC since Windows 10 2004 / Windows 11). aptX Classic is
available only on some adapter/driver combinations (mostly Qualcomm); aptX
HD/Adaptive and **LDAC are not native**. LDAC needs a paid third-party
driver (for example Alternative A2DP Driver) or a USB transmitter dongle
that does the encoding in hardware.

**How it changes audio.** The XM4 supports SBC, AAC and LDAC. On Windows it
gets AAC (the headphones report AAC to our app). AAC at about 256-320 kbps
is better than Windows' SBC. Windows' AAC encoder has had reports of
glitches on some machines, where falling back to SBC helps.

**Where Windows shows it.** Nowhere. Windows has no UI that shows the
active codec.

**Read.** Not through any public Windows API. **Our app already reads it
from the headphones** via libmdr (the codec indicator), which is better than
anything Windows offers. **User.**

**Change.** No supported way to choose. A community-reported value,
`HKLM\SYSTEM\CurrentControlSet\Services\BthA2dp\Parameters\BluetoothAacEnable`
(DWORD, 0 = AAC off so it falls back to SBC), is undocumented, found in one
third-party blog only, and needs a Bluetooth off/on. **Admin.** Not
recommended as a default; at most an "AAC is glitching" troubleshooting
switch, behind a warning.

The headphones' own "Bluetooth connection quality" (Priority on sound
quality / stable connection) mostly matters for LDAC, which Windows does
not use. The page should say so next to it.

**Control level: Read-only** (via the headphones); forcing SBC is
Admin + undocumented.

## 3. Audio enhancements and spatial sound

**What.** Windows runs Audio Processing Objects (APOs) in the endpoint's
signal path: Microsoft's "Home Theater Effects" (loudness equalization,
bass boost, virtual surround, room correction) on this endpoint, and on
some PCs vendor APOs (Realtek, Dolby, DTS, Nahimic). "Signal enhancements"
is the capture-side equivalent (mic noise suppression, echo cancellation).
Spatial sound (Windows Sonic for Headphones, Dolby Atmos for Headphones,
DTS Headphone:X) is a separate HRTF virtualiser.

**How it changes audio.** Loudness equalization compresses dynamics.
Virtual surround and spatial sound apply HRTF filtering and reverb on top
of the music, which then goes through Sony's DSEE Extreme and EQ inside the
headphones. The two processing chains stack, and Sony's EQ curves are tuned
for an unprocessed stereo source. For music, all of these should be off.

**Where Windows shows it.**
- Settings > System > Sound > Headphones (WH-1000XM4) > Audio enhancements
  (Off / Device default effects) and Spatial sound (Off / Windows Sonic /
  Dolby / DTS). Deep link: `ms-settings:sound` then the device.
- `mmsys.cpl` > Playback > device > Properties > Enhancements / Advanced
  ("Enable audio enhancements") and Spatial sound tab.

**Read.**
- Enhancements: `IMMDevice::OpenPropertyStore(STGM_READ)` and
  `PKEY_AudioEndpoint_Disable_SysFx` (`{1da5d803-d492-4edd-8c23-e0c0ffee7f0e},5`;
  1 = disabled). The maintainer's XM4 = 1. **User.**
- Individual Home Theater effects (loudness, bass boost) are private
  properties of Microsoft's APO; reading them is undocumented.
- Spatial sound: no documented "current format" getter. Best effort:
  `IMMDevice::Activate(ISpatialAudioClient)` and
  `IsAudioObjectFormatSupported` / `GetMaxDynamicObjectCount` (0 dynamic
  objects suggests spatial is off). **User**, best-effort.

**Change.**
- Enhancements: `IPolicyConfig::SetPropertyValue(id, bFxStore=TRUE,
  PKEY_AudioEndpoint_Disable_SysFx, VT_UI4 1)`. IPolicyConfig is the
  undocumented COM interface that `mmsys.cpl` itself uses; it goes through
  the Audio service, so it works without elevation (the Enhancements
  checkbox does not show UAC). Writing the same value with
  `IPropertyStore::SetValue` on a `STGM_READWRITE` store needs **Admin**,
  and writing `HKLM\...\MMDevices` directly is blocked even for admins
  (the keys are owned by the audio service). **User** via IPolicyConfig.
- Spatial sound: no public setter, and the property that stores it was not
  identified. **Read-only**: show the best-effort state and deep-link to
  Settings > Sound > the device.
- Reversible: yes, set the value back. The app should store the previous
  value before writing.

**Control level: enhancements User (undocumented COM); spatial Read-only.**

## 4. Endpoint format, exclusive mode, ducking, volume, default devices

### 4a. Default format (sample rate / bit depth)

**What.** The shared-mode mix format of the endpoint. Windows resamples
every app to it. **How it matters.** For A2DP it barely matters: the
A2DP driver offers 44.1 and 48 kHz at 16 bit, and the codec (AAC) re-encodes
anyway. 48 kHz avoids a resample for most games and video; 44.1 kHz avoids
one for most music. The maintainer's XM4 = 48 kHz / 16 bit.
**Where.** `mmsys.cpl` > device > Advanced > Default Format; Settings >
Sound > device > Format.
**Read.** `IAudioClient::GetMixFormat`, or
`PKEY_AudioEngine_DeviceFormat` `{f19f064d-...},0`. **User.**
**Change.** `IPolicyConfig::SetDeviceFormat(id, endpointFormat,
mixFormat)`; check first with `IAudioClient::IsFormatSupported(EXCLUSIVE)`.
**User** (undocumented COM). Reversible (`ResetDeviceFormat`).
Recommendation: show it, leave it at 48 kHz unless the user listens mostly
to 44.1 kHz files.

### 4b. Exclusive mode

**What.** "Allow applications to take exclusive control of this device"
and "Give exclusive mode applications priority". **How it matters.** An
exclusive-mode player bypasses the mixer (bit-perfect to the A2DP encoder),
but it also blocks every other sound, including Windows notifications and
calls. Small benefit over Bluetooth; it is mainly a source of "no sound in
app X" confusion.
**Where.** `mmsys.cpl` > device > Advanced > Exclusive Mode.
**Read/Change.** Community-documented endpoint properties
`{b3f8fa53-0004-438e-9003-51a46e139bfc},3` (allow) and `,4` (priority),
read via the property store (**User**), written via
`IPolicyConfig::SetPropertyValue` (**User**, undocumented) or
`IPolicyConfig::SetShareMode`. Absent = on (the maintainer: absent).
Recommendation: show; leave on.

### 4c. Communications ducking

**What.** "When Windows detects communications activity": Mute all other
sounds / Reduce by 80% / Reduce by 50% / Do nothing. **How it degrades
audio.** Music and game sound drop as soon as Teams or Discord opens a
communications stream, and sometimes stay down. **Where.** `mmsys.cpl` >
Communications tab (`control mmsys.cpl,,3`). **Read/Change.**
`HKCU\Software\Microsoft\Multimedia\Audio\UserDuckingPreference` (DWORD):
0 = mute, 1 = 80% (default), 2 = 50%, 3 = do nothing. Several sources agree
on these values; this is not documented by Microsoft as an API. **User**
(HKCU). Takes effect for new communication sessions; some reports say
after sign-out. Reversible. The maintainer = 3.

### 4d. Absolute volume (AVRCP)

**What.** AVRCP 1.4+ absolute volume: the Windows slider sends the
headphones their own volume level, so there is one volume. With it off,
Windows scales the digital signal and the headphones keep a separate
volume. **How it matters.** On: Windows 10% is quiet in the headphones too,
and some headsets jump or beep. Off: two volumes multiply; low Windows
volume throws away bits before the codec. For the XM4 it should stay **on**
(full-resolution signal, and our app's headphone volume slider and Windows'
stay in sync).
**Where.** No UI. **Read.** `HKLM\SYSTEM\ControlSet001\Control\Bluetooth\Audio\AVRCP\CT\DisableAbsoluteVolume`
(0/absent = on). **User** read. **Change.** Same value, 1 = off. **Admin**
(HKLM) plus a restart or Bluetooth off/on. Reported to break some stereo
speaker pairs. Reversible.
**Volume itself.** `IAudioEndpointVolume::GetMasterVolumeLevelScalar` /
`SetMasterVolumeLevelScalar` and `RegisterControlChangeNotify` (**User**,
documented). With absolute volume on, this is the same level the headphones
report through libmdr, so the app should show one slider and check the two
values agree.

### 4e. Default device and default communications device

**What.** Windows has three roles: `eConsole`, `eMultimedia` (together
"Default Device") and `eCommunications` ("Default Communication Device"),
separately for playback and recording. **How it matters.** Music goes to
the default device. Teams/Discord set to "Default communication device"
open that endpoint, and if it is the HFP Headset that is what pulls the XM4
into mono. **Where.** Settings > Sound; `mmsys.cpl` > right-click > Set as
Default Device / Default Communication Device.
**Read.** `IMMDeviceEnumerator::GetDefaultAudioEndpoint(flow, role)` and
`RegisterEndpointNotificationCallback` (`OnDefaultDeviceChanged`). WinRT:
`Windows.Media.Devices.MediaDevice.GetDefaultAudioRenderId(AudioDeviceRole)`
and `DefaultAudioRenderDeviceChanged`. **User**, documented.
**Change.** `IPolicyConfig::SetDefaultEndpoint(id, role)` for each role.
**User**, undocumented (it is what every audio switcher uses; CLSID
`CPolicyConfigClient` `{870af99c-171d-4f9e-af0d-e63df40c2bc9}`, IID
`IPolicyConfig` `{f8679f50-850a-41cf-9c72-430f290290c8}` for Windows 7+;
these come from community headers and must be checked against the build).
Reversible.
**Recommendation.** Music: XM4 `Headphones` (A2DP) as default for all three
playback roles; a non-Bluetooth mic (Snowball) as default and communications
recording. This is the maintainer's current state. Calls with the headphone mic:
`Headset` as default communications playback and the XM4 mic as
communications recording.

## 5. Power management

**What.** Three things can drop or suspend the Bluetooth radio:
"Allow the computer to turn off this device to save power" on the adapter
(Device Manager > Bluetooth > MediaTek Bluetooth Adapter > Power
Management), USB selective suspend (Control Panel > Power Options > plan >
USB settings; the MT7922 Bluetooth is a USB function even though it is an
M.2 card), and the services `bthserv` (Bluetooth Support Service),
`BTAGService` (Audio Gateway, needed for HFP) and `BthAvctpSvc` (AVRCP,
needed for volume and media keys).

**How it degrades audio.** On desktops it is rarely a problem while audio
streams (the stack holds the device active), but suspend can cause slow
reconnects, a dropout when idle, or the headphones disconnecting after
resume. A stopped `BthAvctpSvc` breaks absolute volume and media keys; a
stopped `BTAGService` breaks calls.

**Read.**
- Adapter power: WMI `root\wmi` class `MSPower_DeviceEnable`, `Enable`
  (the maintainer: True). Reading WMI root\wmi works as a user. **User.**
- USB selective suspend: `PowerReadACValueIndex` /
  `PowerReadDCValueIndex` for subgroup `2a737441-1930-4402-8d77-b2bebba308a3`,
  setting `48e6b7a6-50f5-4782-a5d4-53bb8f07e226` (the maintainer: 1 = enabled).
  **User.**
- Services: `OpenSCManager` + `QueryServiceStatusEx` /
  `QueryServiceConfig`. **User.**

**Change.**
- Adapter power: write `MSPower_DeviceEnable.Enable = false` (WMI
  `Put`). **Admin.** Reversible.
- USB selective suspend: `PowerWriteACValueIndex` + `PowerSetActiveScheme`
  (or `powercfg /setacvalueindex`). Treat as **Admin** (it changes the
  machine power plan for all users). Reversible.
- Services: do **not** change start types. They are trigger-started
  (Manual) by design; only show their state and offer "Start" if one is
  stopped (`StartService`, **Admin**).

**Recommendation.** Show all three. Offer "Keep Bluetooth awake" (adapter
power off, selective suspend off on AC) as an Admin action, not part of the
default "Fix for music", because on a laptop it costs battery.

## 6. Driver and radio

**What.** Two layers: the adapter driver (MediaTek 1.1037.0.429, 2024-05-07,
on an MT7922 combo card) and Windows' Bluetooth profile drivers
(`BthA2dp`, `BthHFAud`, `BthAvctpSvc`), which are part of Windows. There is
no "vendor stack vs Windows stack" choice on modern Windows: Toshiba,
Widcomm/Broadcom and Intel profile packs are gone; vendors only ship the
radio driver. (Exception: paid replacement A2DP drivers for LDAC/aptX.)

**How it degrades audio.** A combo card shares one antenna and the 2.4 GHz
band between Wi-Fi and Bluetooth, time-sharing the air. On 2.4 GHz Wi-Fi
under load, A2DP packets are delayed and the audio stutters; moving Wi-Fi to
5 or 6 GHz fixes it in most reports. More Bluetooth links on the same radio
(the maintainer: a Classic keyboard and an LE mouse) also take air time. Older or
OEM-mismatched MediaTek drivers have their own dropout reports.

**Read.**
- Driver version/provider/date: `CM_Get_DevNode_PropertyW` with
  `DEVPKEY_Device_DriverVersion`, `DEVPKEY_Device_DriverProvider`,
  `DEVPKEY_Device_DriverDate` on the radio's devnode (found via
  `GUID_BTHPORT_DEVICE_INTERFACE`). **User.**
- Bluetooth version: `BluetoothGetRadioInfo` (`lmpSubversion`, manufacturer)
  or `HKLM\...\BTHPORT\Parameters\Devices\<addr>\LmpVersion` for the
  headphones. **User.**
- Wi-Fi band and channel: `WlanQueryInterface(wlan_intf_opcode_current_connection)`
  plus the channel number (1-14 = 2.4 GHz). **User.**
- Combo card detection: a Wi-Fi adapter and the Bluetooth radio with the same
  vendor (MediaTek, Intel, Realtek, Qualcomm) and same PCI/USB parent.

**Change.** Not from our app. Driver updates come from Windows Update or
the PC/board maker; we only report the version and date, and the Wi-Fi
band with advice ("You are on 2.4 GHz Wi-Fi with a shared Wi-Fi/Bluetooth
card; use 5 GHz or Ethernet if audio stutters").

**Control level: Read-only.**

## 7. Other settings that matter

| Setting | Effect | Read / change | Level |
| --- | --- | --- | --- |
| **Mono audio** (Settings > Accessibility > Audio) | Sums L+R; music loses stereo | `HKCU\Software\Microsoft\Multimedia\Audio\AccessibilityMonoMixState` (1 = mono). The maintainer: absent (stereo). Takes effect after the audio engine re-reads it; Settings also broadcasts a change. | User (read and write), but prefer deep link `ms-settings:easeofaccess-audio` for the write |
| **Per-app output device** (Settings > Sound > Volume mixer) | An app pinned to another endpoint (or to the Headset) ignores the default | Undocumented `IAudioPolicyConfigFactory` (`Windows.Media.Internal.AudioPolicyConfig`), used by EarTrumpet; versions differ across builds | Read-only (show list); deep link `ms-settings:apps-volume` |
| **Per-app volume** | An app at 20% sounds "quiet" | `IAudioSessionManager2` / `ISimpleAudioVolume`, documented | User |
| **Teams/Discord/Zoom device choice and "auto switch"** | These apps open the Headset endpoint or the headphone mic by their own setting and pull HFP back on | Not exposed by Windows; app settings only | Not possible; the page explains it |
| **Endpoint visibility** (disabled endpoints in `mmsys.cpl`) | A disabled `Headphones` endpoint means no stereo device at all | `DEVICE_STATE_DISABLED` via `EnumAudioEndpoints(DEVICE_STATEMASK_ALL)`; `IPolicyConfig::SetEndpointVisibility` | User (undocumented write) |
| **Game Mode / Xbox Game Bar capture** | No audio quality effect found; Game Bar can open the default mic for party chat, which pulls HFP if the mic is the headphones' | `HKCU\Software\Microsoft\GameBar` | Show only |
| **AVRCP media keys** | Headphone play/pause uses AVRCP (`BthAvctpSvc`) | Service state | Show only |
| **LE Audio toggle** (24H2+) | Stereo + mic on LE Audio headsets | Settings > Bluetooth & devices; no public API found | Read-only, only for LE Audio models |

## Summary: control level per setting

| # | Setting | Read | Change | Safe / reversible |
| --- | --- | --- | --- | --- |
| 1 | Hands-Free / Headset services | User | **Admin** (`BluetoothSetServiceState`) | Yes; re-pair restores it |
| 2 | A2DP codec | User (from headphones) | Not possible (AAC-off switch is Admin + undocumented) | n/a |
| 3a | Audio enhancements | User | User (`IPolicyConfig`, undocumented) | Yes |
| 3b | Spatial sound | Best-effort | Read-only (deep link) | n/a |
| 4a | Default format | User | User (`IPolicyConfig::SetDeviceFormat`) | Yes |
| 4b | Exclusive mode | User | User (`IPolicyConfig`) | Yes |
| 4c | Communications ducking | User | User (HKCU) | Yes |
| 4d | Absolute volume | User | **Admin** (HKLM) + reconnect | Yes |
| 4e | Default / communications devices | User | User (`IPolicyConfig::SetDefaultEndpoint`) | Yes |
| 5a | Adapter "turn off to save power" | User | **Admin** (WMI) | Yes |
| 5b | USB selective suspend | User | **Admin** (power plan) | Yes |
| 5c | Bluetooth services | User | Admin (start only) | Do not change start type |
| 6 | Driver, Wi-Fi band, coexistence | User | Read-only | n/a |
| 7 | Mono audio | User | User (HKCU) or deep link | Yes |

## Proposed "Windows audio" page

A new left-rail page, **Windows audio**, in the existing card grid. One card
per group: *Calls vs music* (Hands-Free, default devices), *Processing*
(enhancements, spatial, mono, ducking), *Format and volume* (format,
exclusive mode, absolute volume), *Connection* (codec from the headphones,
driver, Wi-Fi band, power).

Each row shows: the setting name, the **current state read live**, the
recommended state with a check or a warning dot, a one-line plain
statement of what it does, and either a switch (User), a switch with a
shield icon (Admin, UAC once per batch), or "Open in Windows" (Read-only).
Example statements:

- **Hands-Free (mono call audio)**: "When on, any app that uses the
  headphone mic switches all sound to mono call quality. Turn off for music;
  turn on to use the headphone mic."
- **Audio enhancements**: "Windows effects applied before the sound reaches
  your headphones. Off lets Sony's EQ and DSEE work on the original sound."
- **Spatial sound**: "Virtual surround on top of the music. Off for music."
- **Lower other sounds during calls**: "Windows turns music down when a call
  app starts. 'Do nothing' keeps your volume."
- **Absolute volume**: "One volume for Windows and the headphones. Keep on."

Three buttons at the top:

- **Fix for music** (recommended set): Hands-Free + Headset off (Admin);
  XM4 Headphones as default and default communications playback; a
  non-Bluetooth mic, if one exists, as default and communications recording;
  enhancements off; ducking "Do nothing"; mono off; absolute volume on
  (Admin only if it is currently off). Spatial sound: show "turn off in
  Windows" if it reads as on. Preview the list of changes first; one UAC
  prompt covers all Admin items.
- **Fix for calls**: Hands-Free on (Admin); Headset as default
  communications playback; XM4 mic as communications recording; ducking
  left as the user set it. Note "music will be mono while a call app
  uses the mic".
- **Restore**: puts back the snapshot taken before the first "Fix" (stored
  in the app's settings file), not Windows factory defaults, because Windows
  has no single "defaults" for these. A second link, "Windows defaults",
  sets the documented defaults (enhancements on, ducking 80%, absolute
  volume on, Hands-Free on).

The page listens for changes (`IMMNotificationClient`, device arrival via
`CM_Register_Notification`, `RegNotifyChangeKeyValue` on HKCU audio) and
shows a banner such as "Hands-Free came back after re-pairing. Turn it off
again?" instead of silently re-applying.

## Rust implementation options

- **`windows` crate** (microsoft/windows-rs) for everything: features
  `Win32_Media_Audio`, `Win32_Media_Audio_Endpoints`
  (`IAudioEndpointVolume`), `Win32_System_Com`,
  `Win32_UI_Shell_PropertiesSystem` (`IPropertyStore`, `PROPERTYKEY`),
  `Win32_Devices_Bluetooth` (`BluetoothFindFirstRadio`,
  `BluetoothGetDeviceInfo`, `BluetoothSetServiceState`,
  `BluetoothEnumerateInstalledServices`),
  `Win32_Devices_DeviceAndDriverInstallation` (`CM_*`, `SetupDi*`),
  `Win32_Devices_Properties` (`DEVPKEY_*`), `Win32_System_Power`
  (`PowerRead/WriteACValueIndex`), `Win32_System_Services`,
  `Win32_NetworkManagement_WiFi` (`WlanQueryInterface`),
  `Win32_System_Wmi` (`MSPower_DeviceEnable`), `Media_Devices` (WinRT
  default-device change events). `IPolicyConfig` is not in the crate;
  declare it locally with `#[windows::core::interface("f8679f50-...")]`
  and test the vtable on the running build (the order is: GetMixFormat,
  GetDeviceFormat, ResetDeviceFormat, SetDeviceFormat, GetProcessingPeriod,
  SetProcessingPeriod, GetShareMode, SetShareMode, GetPropertyValue,
  SetPropertyValue, SetDefaultEndpoint, SetEndpointVisibility; from
  community headers).
- **`wasapi` crate**: a convenience layer over the same COM for endpoint
  enumeration, formats and volume. Useful for reading, but it does not cover
  IPolicyConfig, Bluetooth or SetupAPI, so the `windows` crate is needed
  anyway; using only `windows` keeps one dependency.
- **`winreg` crate**: small and clear for the few registry values (ducking,
  mono, absolute volume, SDP cache). The `windows` crate's `Win32_System_Registry`
  can do the same; pick one (`winreg` is simpler to read).
- No crate today: the app's Cargo manifests have no Windows API crate yet
  (the Bluetooth transport lives in the upstream `libmdr-bt` DLL), so this is
  a new dependency. Put it in a separate workspace crate (for example
  `crates/winaudio`) with a read model (`WindowsAudioSnapshot`, serialised to
  the renderer like the existing `Snapshot`) and a small apply API.

## Admin elevation strategy

- The main app stays unelevated (it is a per-user NSIS install and starts
  with Windows; it must not prompt at login).
- Admin changes go to a tiny helper: the same executable started with
  `ShellExecuteExW(lpVerb = "runas", lpFile = <app exe>, lpParameters =
  "--apply-admin <plan.json>")`. It reads a plan that contains only
  allow-listed operations (Hands-Free service on/off for one device address,
  absolute volume 0/1, adapter power on/off, selective suspend on/off), applies
  them, reads each back, writes a result JSON, and exits. No general
  command runner, no shell, no paths from the renderer.
- One UAC prompt per "Fix" action, covering every Admin item in it.
- If the user declines UAC, the User-level items are still applied and the
  page shows the Admin rows as "not changed".

## Risks

1. **Calls break.** Hands-Free off removes the headphone mic. Teams/Discord
   set to the headphone mic will show "no microphone". The page must say this
   and "Fix for calls" must undo it in one click.
2. **Hands-Free comes back.** Re-pairing, a Windows update or a driver update
   re-installs the service. Detect and ask; never loop re-applying.
3. **Device enumeration churn.** Enabling/disabling a Bluetooth service
   removes and re-adds device nodes; the audio endpoint can briefly
   disappear, apps lose their stream, and endpoint IDs of the **Headset**
   endpoint can change. Our own RFCOMM link to the headphones is a separate
   service and should survive, but it must be tested (reconnect logic).
4. **IPolicyConfig is undocumented.** A Windows build could change its IID
   or vtable. Check `QueryInterface` succeeds, read every value back, and
   disable the write paths (keep read-only) if the read-back does not match.
5. **Absolute volume change** needs a restart or reconnect and can break
   some speaker stereo pairs; it is not part of "Fix for music" unless
   currently off.
6. **Power changes** affect the whole PC (battery life on laptops, other USB
   devices for selective suspend).
7. **AAC-off registry value** is undocumented and lowers quality to SBC;
   keep it out of any one-click fix.
8. **Default device changes** surprise users with several outputs (the maintainer has
   PreSonus Eris speakers): "Fix for music" sets the XM4 as default only while
   it is connected, and Restore puts the previous default back.

## Test plan

- **Snapshot before and after** every apply: a JSON of all readable values
  above (endpoint ids, defaults per role, `Disable_SysFx`, device format,
  exclusive keys, ducking, mono, absolute volume, Hands-Free/Headset node
  presence, adapter power, selective suspend, service states, driver
  version, Wi-Fi band). Store both with the change log; diff them in the UI.
- **Read-back after each change**: every write is followed by the matching
  read; a mismatch marks the row failed and stops the batch.
- **Unit tests** on recorded data: capture the snapshot from the maintainer's PC
  (the facts table above is its first instance) as a fixture, and test the
  "recommended vs current" logic and plan building against it, as the
  project's testing rule requires recorded artifacts, not invented shapes.
- **Live checks on the maintainer's PC**, in order: (1) read-only snapshot matches
  this note; (2) User-level toggles (ducking, enhancements, default device)
  flip and restore, verified in `mmsys.cpl`; (3) Hands-Free on via the
  helper: `{0000111E-...}` node appears, a `Headset` playback and an XM4
  capture endpoint appear, our RFCOMM link stays up; then off again and
  confirm they are gone; (4) open the XM4 mic in a test app with Hands-Free
  on and confirm the codec indicator/stream changes, then off and confirm
  A2DP stays; (5) Restore returns the snapshot exactly.
- **Codex review** of the helper's allow-list before shipping.

## Sources

- Microsoft Learn, [BluetoothSetServiceState](https://learn.microsoft.com/en-us/windows/win32/api/bluetoothapis/nf-bluetoothapis-bluetoothsetservicestate)
  (enable installs and disable removes the device driver; error codes).
- Microsoft Learn, [ISpatialAudioClient](https://learn.microsoft.com/en-us/windows/win32/api/spatialaudioclient/nn-spatialaudioclient-ispatialaudioclient)
  and [Spatial sound for app developers](https://learn.microsoft.com/en-us/windows/win32/coreaudio/spatial-sound).
- Microsoft Q&A, [Bluetooth codecs supported in Windows 11](https://learn.microsoft.com/en-us/answers/questions/5560825/bluetooth-codecs-supported-in-windows-11)
  (SBC and AAC native; LDAC and aptX HD/Adaptive not native).
- Microsoft Q&A, [Disabling hands-free telephony permanently on Windows 11](https://learn.microsoft.com/en-us/answers/questions/4012096/disabling-handsfree-telephony-permanently-with-blu)
  (setting re-enabled after restart).
- Windows OS Platform blog via [KitGuru](https://www.kitguru.net/channel/generaltech/joao-silva/windows-11-adds-super-wideband-stereo-for-bluetooth-le-audio-streaming/)
  and [PCWorld](https://www.pcworld.com/article/2892340/microsoft-improves-bluetooth-audio-in-windows-11-while-using-a-mic.html)
  (LE Audio super wideband stereo, LC3, 32 kHz mic, "Use LE Audio").
- ElevenForum, [Bluetooth absolute volume](https://www.elevenforum.com/t/enable-or-disable-bluetooth-absolute-volume-in-windows-11.44938/)
  (`DisableAbsoluteVolume`, admin, restart).
- ElevenForum, [Adaptive communication sound levels](https://www.elevenforum.com/t/change-adaptive-communication-sound-levels-in-windows-11.47293/)
  (`UserDuckingPreference` 0-3).
- Microsoft Tech Community, [Bluetooth audio stutters on 2.4 GHz Wi-Fi](https://techcommunity.microsoft.com/discussions/windows11/win11-bluetooth-audio-stutters-when-wi-fi-is-active-on-2-4-ghz-band/4547692);
  Framework forum, [MT7922 Wi-Fi/Bluetooth](https://community.frame.work/t/mt7922-mediatek-wifi-card-wifi-bluetooth-issue/76019).
- manjubox.net, [Disable Bluetooth AAC on Windows 11](https://www.manjubox.net/memo/disable_bluetooth_aac_coder_on_windows11)
  (`BluetoothAacEnable`; single third-party source, unverified).
- Not verified online (from community headers and prior knowledge, to be
  checked in code): `IPolicyConfig` IID/CLSID and vtable order; exclusive-mode
  property ids `{b3f8fa53-...},3/4`; `AccessibilityMonoMixState`.
