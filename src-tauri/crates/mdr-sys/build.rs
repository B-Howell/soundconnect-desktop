//! Links the CI-built upstream engine import libraries and stages the DLLs next
//! to every test/binary output so they load at run time.
//!
//! Bin dir: `MDR_ENGINE_BIN`, else `../../../engine/bin/RelWithDebInfo` relative to
//! this crate, i.e. `<repo>/engine/bin/RelWithDebInfo` (populated by
//! `tools/fetch-engine.ps1`). The crate lives in the Tauri workspace at
//! `src-tauri/crates/mdr-sys`.

use std::env;
use std::fs;
use std::path::{Path, PathBuf};

const LIBS: [&str; 2] = ["mdr-shared", "mdr-bt-shared"];

fn main() {
    println!("cargo:rerun-if-env-changed=MDR_ENGINE_BIN");
    println!("cargo:rerun-if-changed=build.rs");

    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR"));
    let bin = match env::var_os("MDR_ENGINE_BIN") {
        Some(p) => PathBuf::from(p),
        None => manifest_dir
            .join("..")
            .join("..")
            .join("..")
            .join("engine")
            .join("bin")
            .join("RelWithDebInfo"),
    };
    let bin = bin.canonicalize().unwrap_or_else(|_| {
        panic!(
            "engine bin dir {} does not exist; run tools/fetch-engine.ps1 (or set MDR_ENGINE_BIN)",
            bin.display()
        )
    });

    for lib in LIBS {
        for ext in ["lib", "dll"] {
            let file = bin.join(format!("{lib}.{ext}"));
            assert!(
                file.is_file(),
                "missing {}; run tools/fetch-engine.ps1 (or set MDR_ENGINE_BIN)",
                file.display()
            );
            println!("cargo:rerun-if-changed={}", file.display());
        }
    }

    println!("cargo:rustc-link-search=native={}", bin.display());
    for lib in LIBS {
        println!("cargo:rustc-link-lib=dylib={lib}");
    }
    // Exposed to dependents as DEP_MDR_SHARED_BIN (links = "mdr-shared").
    println!("cargo:bin={}", bin.display());
    // Lets tests read struct-sizes.txt and the export lists from the same dir.
    println!("cargo:rustc-env=MDR_ENGINE_BIN_DIR={}", bin.display());

    // OUT_DIR = <target>/<profile>/build/mdr-sys-<hash>/out -> <target>/<profile>
    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR"));
    let profile_dir = out_dir
        .ancestors()
        .nth(3)
        .expect("OUT_DIR has the expected <target>/<profile>/build/<pkg>/out shape")
        .to_path_buf();
    for dest in [
        profile_dir.clone(),
        profile_dir.join("deps"),
        profile_dir.join("examples"),
    ] {
        copy_dlls(&bin, &dest);
    }
}

fn copy_dlls(bin: &Path, dest: &Path) {
    fs::create_dir_all(dest).unwrap_or_else(|e| panic!("create {}: {e}", dest.display()));
    for lib in LIBS {
        let src = bin.join(format!("{lib}.dll"));
        let dst = dest.join(format!("{lib}.dll"));
        // A running test may hold the DLL open; an identical copy is fine to keep.
        if let Err(e) = fs::copy(&src, &dst) {
            let same = fs::metadata(&dst).map(|m| m.len()).ok()
                == fs::metadata(&src).map(|m| m.len()).ok();
            assert!(same, "copy {} -> {}: {e}", src.display(), dst.display());
        }
    }
}
