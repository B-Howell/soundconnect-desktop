# Contributing to SoundConnect Desktop

Thanks for helping. This file covers how to run, test and check the app, the
rules that keep the tests honest and the repository free of personal data,
and what a pull request needs.

## Run

Prerequisites and the engine DLLs are described in the
[README](README.md#build-from-source). In short:

```powershell
git clone --recurse-submodules https://github.com/B-Howell/soundconnect-desktop
pnpm install
./tools/fetch-engine.ps1      # or ./tools/build-engine.ps1 with VS 2022
pnpm dev                      # the app
$env:VITE_MOCK_ENGINE = '1'; pnpm dev:web   # renderer only, mock engine from a recorded XM4 snapshot
```

## Test and lint

Everything CI runs ([ci.yml](.github/workflows/ci.yml)) must pass locally:

```powershell
pnpm typecheck
pnpm test                     # Vitest (renderer)
pnpm build                    # renderer production build
cd src-tauri
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace        # needs the engine DLLs in engine/bin/RelWithDebInfo
```

Tests that need real headphones are `#[ignore]`d and named `live_*`; run them
with `cargo test -p mdr live_ -- --ignored --nocapture` when you have the
device connected.

## Replay real recordings, never hand-written packets

Protocol tests replay **real captures** recorded from a device, not byte
sequences typed into a test. A hand-written packet tests your understanding of
the protocol; a recording tests the protocol. The same goes for the Windows
audio fixtures (recorded snapshots) and the renderer's mock engine (a recorded
XM4 snapshot).

When you write a test against a new recording, run it first, read what the
engine actually reports, and only then pin the values.

## Recording a capture

1. Record a session with the upstream client:
   `SonyHeadphonesClient.exe --record <folder>`. Connect, let initialisation
   finish, and touch the settings you want covered.
2. Scrub it (see below) with upstream's script:
   `python -I upstream/SonyHeadphonesClient/tooling/scrub-capture.py --scrub-device-address <folder>`
   (try `--dry-run` first).
3. Check what is left: `cat <folder>/*.bin | strings -n 4`.
4. Put it under `src-tauri/fixtures/<MODEL>-<firmware>/`, keeping the
   `mdr-packet-<ms>-<ordinal>-...bin` file names, and add the replay test.

Full details: [Testing](<docs/testing/SoundConnect Desktop - Testing.md>).

## Scrub rule

Nothing personal goes into the repository: not in fixtures, docs, test
strings, screenshots or commit messages. Before committing, check for and
replace:

- Bluetooth addresses (use placeholders such as `AA:BB:CC:12:34:56` or
  `00:11:22:33:44:55`); real addresses appear only in raw evidence logs under
  `docs/*/evidence/`, and only the headset's own;
- names of paired phones, laptops and PCs (use `Desktop-1`, `Laptop-1`,
  `Phone-1`) and the Windows computer name;
- track, album and artist metadata;
- Windows user names and absolute user paths (write `%USERPROFILE%` or
  `<repo>`);
- tokens, keys, `.env` contents.

Screenshots for docs come from the mock engine (`VITE_MOCK_ENGINE=1`), which
already uses placeholder data.

## Documentation contract

Documentation is part of a change, not an afterthought. All project docs start
at [SoundConnect Desktop - Documentation Home](<docs/SoundConnect Desktop - Documentation Home.md>),
which links only the major branches (core, engine, renderer, research,
testing, tooling). Each branch doc explains its files and links them by exact
path. When you add, move or remove a file, update the branch doc that explains
it: what it does, its constraints and why. Doc file names are unique and
descriptive (`SoundConnect Desktop - <Topic>.md`); do not add generic
`README.md` or `index.md` files inside `docs/`.

## Pull requests

- One topic per pull request, with a conventional commit style title
  (`feat(ui): ...`, `fix(core): ...`, `docs: ...`, `ci: ...`).
- CI green: typecheck, Vitest, build, fmt, clippy, cargo test.
- New behaviour has a test that replays a real recording or a recorded
  snapshot.
- UI changes include a before/after screenshot from the mock engine, checked
  in both themes at 1180 x 760.
- Device-side changes say what was verified on real headphones (model and
  firmware), and what was not.
- The docs that explain the changed files are updated in the same pull
  request, and the scrub rule holds.
- Add a line to the "Unreleased" section of [CHANGELOG.md](CHANGELOG.md) for
  anything a user would notice.
