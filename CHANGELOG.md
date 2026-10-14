# Changelog

User-facing changes in each release of SoundConnect Desktop. The release
workflow uses the section matching a tag (`## 0.1.8` for `v0.1.8`) as the
GitHub Release notes.

## Unreleased

- Public README with screenshots, install guide and credits; CONTRIBUTING
  guide; tag-driven release workflow.
- Settings and the remembered device are now stored in a new folder
  (`%APPDATA%\dev.soundconnect.desktop`), so the first launch after updating
  shows the setup wizard once.

## 0.1.8 - 2026-10-14

- Equalizer and Noise control are now sub-pages of Sound, listed under it in
  the left rail with a "Sound ›" breadcrumb; the Sound page shows both at a
  glance.
- Card grids no longer leave a single card stranded on its own row; other
  layout fixes from a full interface audit.

## 0.1.7 - 2026-10-14

- Removed mentions of 360 Reality Audio, which only Sony's phone app can set
  up.

## 0.1.6 - 2026-10-13

- **Fewer dropouts**: a frame the engine cannot parse (the WH-1000XM4's
  Speak-to-Chat preview) is skipped instead of dropping the connection.
  Changing connection quality, DSEE or Speak-to-Chat asks first and then
  reconnects by itself.
- **Equalizer page** with each preset's curve, recorded from the device.
- **Windows audio page**: how Windows treats the headphones' sound, with
  "Fix for music", "Fix for calls" and restore.
- Review fixes: a stale confirmation can no longer apply the wrong mode;
  forgetting another device no longer leaves the status on "Reconnecting".

## 0.1.5 - 2026-10-12

- The app icon is cropped so the headphones fill the taskbar slot.

## 0.1.4 - 2026-10-12

- A remembered device shows its model name instead of its address.

## 0.1.3 - 2026-10-12

- New app icon.

## 0.1.2 - 2026-10-12

- First-run setup wizard; the app remembers your headphones and connects only
  when you press Connect (or automatically, if you turn that on). It never
  writes a setting to the headphones unless you change it.
- Real Sony product images for each model.
- Settings and remembered devices tolerate files saved with a BOM.

## 0.1.1 - 2026-10-12

- Desktop layout with a left navigation rail and card grid.
- Ambient sound control the Sony way (one 22-stop slider), Speak-to-Chat,
  connection quality, automatic pause.
- Devices page: multipoint, paired devices, pairing a new device.

## 0.1.0 - 2026-10-12

- First installer: noise control, equalizer and DSEE, battery, now playing and
  volume, system settings, for headphones supported by the libmdr engine
  (tested on the WH-1000XM4).
- Tray icon with battery and quick noise control; close to tray; start with
  Windows.
- Per-user NSIS installer that bundles the engine DLLs and their MIT licence.
