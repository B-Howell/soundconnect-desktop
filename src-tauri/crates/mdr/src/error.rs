//! Error type shared by the transport layer and the engine.

use std::ffi::CStr;
use std::fmt;

/// Errors from the engine (an `MDR_RESULT_*` code) or from a Rust transport.
#[derive(Debug)]
pub enum Error {
    /// A libmdr call returned a non-OK `MDR_RESULT_*` code.
    Mdr {
        /// The `MDR_RESULT_*` value.
        code: u32,
        /// The C function that returned it.
        call: &'static str,
        /// `MDR_TEXT_LAST_ERROR` at the time of failure (may be empty).
        detail: String,
    },
    /// A transport implementation failed.
    Transport(String),
    /// Reading a capture or other local file failed.
    Io(std::io::Error),
    /// Input that cannot be represented in the C ABI (interior NUL, too long, ...).
    InvalidArgument(String),
}

impl Error {
    /// The `MDR_RESULT_*` code this error maps to when reported back to libmdr.
    pub fn code(&self) -> u32 {
        match self {
            Error::Mdr { code, .. } => *code,
            Error::Transport(_) => mdr_sys::MDR_RESULT_ERROR_GENERAL,
            Error::Io(_) => mdr_sys::MDR_RESULT_ERROR_NET,
            Error::InvalidArgument(_) => mdr_sys::MDR_RESULT_ERROR_INVALID_ARGUMENT,
        }
    }

    /// True for `MDR_RESULT_INPROGRESS` (the engine is busy with another request).
    pub fn is_in_progress(&self) -> bool {
        matches!(
            self,
            Error::Mdr {
                code: mdr_sys::MDR_RESULT_INPROGRESS,
                ..
            }
        )
    }

    /// True for `MDR_RESULT_ERROR_MALFORMED_PAYLOAD`. From `poll` it means libmdr
    /// could not deserialise one received frame: the frame was already ACKed and
    /// consumed (`Headphones.cpp` `MoveNext` erases it before `Handle`), no state
    /// changed, and the link is intact. Example: the WH-1000XM4 (fw 2.9.0) follows
    /// every Speak-to-Chat change with `SYSTEM_NTFY_PARAM [f9 05 02 00]`
    /// (`PREVIEW_MODE_ON_OFF`), which libmdr validates as `MODE_ON_OFF` and
    /// rejects. See `docs/core/evidence/toggle-dropouts-debug.md`.
    pub fn is_malformed_payload(&self) -> bool {
        matches!(
            self,
            Error::Mdr {
                code: mdr_sys::MDR_RESULT_ERROR_MALFORMED_PAYLOAD,
                ..
            }
        )
    }
}

/// `mdrResultString(code)` as an owned string.
pub fn result_string(code: u32) -> String {
    // SAFETY: mdrResultString returns a static NUL-terminated string for every
    // input, including unknown codes ("Unknown"); see libmdr/src/Headphones.cpp.
    unsafe { CStr::from_ptr(mdr_sys::mdrResultString(code)) }
        .to_string_lossy()
        .into_owned()
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Mdr { code, call, detail } => {
                write!(f, "{call} failed: {} ({code})", result_string(*code))?;
                if !detail.is_empty() {
                    write!(f, ": {detail}")?;
                }
                Ok(())
            }
            Error::Transport(m) => write!(f, "transport error: {m}"),
            Error::Io(e) => write!(f, "io error: {e}"),
            Error::InvalidArgument(m) => write!(f, "invalid argument: {m}"),
        }
    }
}

impl std::error::Error for Error {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Error::Io(e) => Some(e),
            _ => None,
        }
    }
}

impl From<std::io::Error> for Error {
    fn from(e: std::io::Error) -> Self {
        Error::Io(e)
    }
}

/// Result alias for this crate.
pub type Result<T> = std::result::Result<T, Error>;
