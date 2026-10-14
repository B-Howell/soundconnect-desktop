# SoundConnect Desktop - Upstream Issue Draft: Speak-to-Chat Preview Notify

Purpose: ready-to-paste text for an issue on
[mos9527/SonyHeadphonesClient](https://github.com/mos9527/SonyHeadphonesClient).
It reports the libmdr bug that made our app drop the WH-1000XM4 link whenever
Speak-to-Chat was switched. Our app works around it (the malformed-frame skip
in `src-tauri/src/engine_service.rs`, see
[toggle-dropouts-debug.md](<../core/evidence/toggle-dropouts-debug.md>)), so
filing is optional. The maintainer decides whether and when to open it; nothing has been
posted.

Everything below the line is the issue body. The title goes in the issue's
title field.

---

**Title:** libmdr: `HandleSystemParam` rejects the Speak-to-Chat preview notify (`f9 05 02 00`) on WH-1000XM4 2.9.0 and the client disconnects

**Version:** `master` at `4c91fe69711ce638a34e066d9bdcfaff504bbec8` (2026-10-10).
Headphones: WH-1000XM4, firmware 2.9.0, Windows 11, legacy RFCOMM UUID.

### What happens

Turning Speak-to-Chat on or off makes the client show the disconnect modal,
although the headset stays connected to Windows and the RFCOMM link is fine.

Packet log for "Speak-to-Chat on" (payloads only):

```
tx SYSTEM_SET_PARAM  [f8 05 01 01]   SMART_TALKING_MODE, MODE_ON_OFF, ON
rx SYSTEM_NTFY_PARAM [f9 05 01 01]   SMART_TALKING_MODE, MODE_ON_OFF, ON      (handled)
rx SYSTEM_NTFY_PARAM [f9 05 02 00]   SMART_TALKING_MODE, PREVIEW_MODE_ON_OFF, 0
mdrHeadphonesPoll -> Malformed payload (10): Validation failed:
  data.parameterType == SmartTalkingModeParameterType::MODE_ON_OFF
  [libmdr/src/Generated/ProtocolV1T1Validation.cpp:522]
```

"Off" is the same: `[f8 05 01 00]` -> `[f9 05 01 00]`, `[f9 05 02 00]`, then
the same error.

### Why

- `[f9 05 02 00]` is `SYSTEM_NTFY_PARAM` with `SystemInquiredType::SMART_TALKING_MODE`
  (`05`) and `SmartTalkingModeParameterType::PREVIEW_MODE_ON_OFF` (`02`,
  `ProtocolV1T1.hpp`, `enum class SmartTalkingModeParameterType`).
- `HandleSystemParam` (`libmdr/src/HeadphonesV1T1.cpp`, the
  `case SystemInquiredType::SMART_TALKING_MODE:` branch) deserialises every
  4-byte notify of that type as `NotifySystemParamSmartTalkingModeSetNtfyParam`.
- That struct's generated validator requires
  `data.parameterType == SmartTalkingModeParameterType::MODE_ON_OFF`, so the
  preview notify fails and `PollEvents` returns `MDR_RESULT_ERROR_MALFORMED_PAYLOAD`.
- The frame has already been removed from the receive buffer and ACKed, and no
  property was overwritten, so the link is intact. But `client/Client.cpp`
  (around line 2254, `if (pollResult != MDR_RESULT_OK)`) treats every poll error
  as a lost connection and disconnects.

We confirmed the link survives: when the client skips that frame and keeps
polling, the headset next sends `SYSTEM_NTFY_STATUS [f5 05 00 00]` (handled
normally), and further commands (DSEE on/off, Speak-to-Chat off) work on the
same connection.

### Suggested fix

Either of these, ideally both:

1. In `HandleSystemParam`, check the parameter-type byte before deserialising:
   handle `MODE_ON_OFF` as today and ignore (or record) `PREVIEW_MODE_ON_OFF`
   instead of failing.
2. In the client poll loop, treat `MDR_RESULT_ERROR_MALFORMED_PAYLOAD` as
   "skip this frame" rather than a disconnect. Real transport errors already
   come back as other codes (for example "No connection has been
   established"), so a malformed payload does not mean the link is gone.

Happy to share full packet captures if useful.
