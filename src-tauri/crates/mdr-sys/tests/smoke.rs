//! Smoke test: the import libraries link and `mdr-shared.dll` loads at test time.

use std::ffi::CStr;

#[test]
fn result_string_for_ok_is_pinned() {
    // SAFETY: mdrResultString returns a pointer to a static NUL-terminated string
    // for every input (libmdr/src/Headphones.cpp `mdrResultString`, `default: return "Unknown"`).
    let s = unsafe { CStr::from_ptr(mdr_sys::mdrResultString(mdr_sys::MDR_RESULT_OK)) };
    let s = s.to_str().expect("utf-8");
    assert!(!s.is_empty());
    assert_eq!(s, "OK");
}
