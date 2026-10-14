//! Shared helpers for the replay tests.

#![allow(dead_code)]

pub mod drive;

use std::path::PathBuf;

/// `upstream/SonyHeadphonesClient/tests` (the MIT upstream's recorded captures).
pub fn captures_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../upstream/SonyHeadphonesClient/tests")
}

pub fn capture(name: &str) -> PathBuf {
    captures_root().join(name)
}
