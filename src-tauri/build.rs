//! Tauri build script, plus two checks for the installer (`pnpm dist`):
//!
//! - the engine DLLs that `tauri.conf.json` bundles (`bundle.resources`, from
//!   `../engine/bin/RelWithDebInfo`) must exist; a clear message beats the
//!   bundler's missing-resource error. (`crates/mdr-sys/build.rs` separately
//!   copies them next to the exe in `target/<profile>` for `tauri dev` and tests.)
//! - `gen/THIRD-PARTY-LICENSES.txt`, the installer's licence page
//!   (`bundle.licenseFile`), is generated from upstream's `LICENSE` with a
//!   header naming the bundled DLLs and the upstream commit they were built from.
//!
//! See `docs/tooling/SoundConnect Desktop - Build Toolchain.md` (Installer).

use std::fs;
use std::path::Path;

const ENGINE_BIN: &str = "../engine/bin/RelWithDebInfo";
const BUNDLED_DLLS: [&str; 2] = ["mdr-shared.dll", "mdr-bt-shared.dll"];
const UPSTREAM_LICENSE: &str = "../upstream/SonyHeadphonesClient/LICENSE";
const LICENSES_OUT: &str = "gen/THIRD-PARTY-LICENSES.txt";

fn main() {
    check_engine_dlls();
    write_third_party_licenses();
    tauri_build::build()
}

fn check_engine_dlls() {
    for dll in BUNDLED_DLLS {
        let path = Path::new(ENGINE_BIN).join(dll);
        println!("cargo:rerun-if-changed={}", path.display());
        assert!(
            path.is_file(),
            "missing {} (bundled into the installer by tauri.conf.json bundle.resources); \
             run tools/fetch-engine.ps1 first",
            path.display()
        );
    }
}

fn write_third_party_licenses() {
    println!("cargo:rerun-if-changed={UPSTREAM_LICENSE}");
    let commit_file = Path::new(ENGINE_BIN).join("UPSTREAM_COMMIT.txt");
    println!("cargo:rerun-if-changed={}", commit_file.display());
    let license = fs::read_to_string(UPSTREAM_LICENSE).unwrap_or_else(|e| {
        panic!("read {UPSTREAM_LICENSE}: {e}; is the upstream submodule checked out?")
    });
    let commit = fs::read_to_string(&commit_file)
        .map(|c| c.trim().to_string())
        .unwrap_or_else(|_| "unknown".into());
    let text = format!(
        "SoundConnect Desktop - third-party licences\r\n\
         ===========================================\r\n\
         \r\n\
         SoundConnect Desktop is not affiliated with, endorsed by, or supported by Sony.\r\n\
         \r\n\
         This installer includes mdr-shared.dll and mdr-bt-shared.dll, built from\r\n\
         SonyHeadphonesClient (libmdr and libmdr-bt) at commit {commit}\r\n\
         https://github.com/mos9527/SonyHeadphonesClient\r\n\
         They are distributed under the following licence:\r\n\
         \r\n\
         -------------------------------------------------------------------------------\r\n\
         \r\n\
         {}\r\n",
        license
            .replace("\r\n", "\n")
            .trim_end()
            .replace('\n', "\r\n")
    );
    let out = Path::new(LICENSES_OUT);
    fs::create_dir_all(out.parent().expect("has a parent")).expect("create gen/");
    // Rewrite only on change, so the file's timestamp does not churn.
    if fs::read_to_string(out).ok().as_deref() != Some(text.as_str()) {
        fs::write(out, text).unwrap_or_else(|e| panic!("write {LICENSES_OUT}: {e}"));
    }
}
