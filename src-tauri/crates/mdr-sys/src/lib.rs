//! Raw FFI declarations for the upstream libmdr C ABI.
//!
//! Transcribed by hand from the headers of `upstream/SonyHeadphonesClient`
//! (commit recorded in `engine/bin/RelWithDebInfo/UPSTREAM_COMMIT.txt`), in
//! header order, with the header file and line on every item:
//!
//! - [`base`] - `libmdr/include/mdr-c/Base.h`
//! - [`connection`] - `libmdr/include/mdr-c/Connection.h`
//! - [`headphones`] - `libmdr/include/mdr-c/Headphones.h`
//! - [`bt_windows`] - `libmdr-bt/include/mdr-bt/ConnectionWindows.h`
//!
//! `tests/layout.rs` checks every struct's size/alignment against the
//! compiler-produced `struct-sizes.txt` and every DLL export against these
//! declarations. See `docs/engine/SoundConnect Desktop - Rust Engine Bindings.md`.
#![allow(non_camel_case_types, non_snake_case, non_upper_case_globals)]

pub mod base;
pub mod bt_windows;
pub mod connection;
pub mod headphones;

pub use base::*;
pub use bt_windows::*;
pub use connection::*;
pub use headphones::*;
