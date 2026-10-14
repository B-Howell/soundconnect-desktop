//! Safe Rust API over the upstream libmdr engine (`mdr-shared.dll`).
//!
//! - [`Transport`] is a byte link to the headphones; [`ConnectionBox`] exposes it
//!   to libmdr as an `MDRConnection` vtable.
//! - [`ReplayTransport`] replays a recorded capture directory (tests).
//! - `WindowsTransport` (Windows only) is the upstream RFCOMM backend from
//!   `mdr-bt-shared.dll`.
//! - [`Engine`] owns an `MDRHeadphones` instance: lifecycle, readers, setters and
//!   [`Snapshot`] (the renderer contract).
//!
//! No public signature is `unsafe`. See
//! `docs/engine/SoundConnect Desktop - Rust Engine Bindings.md`.

mod engine;
mod enums;
mod error;
mod events;
pub mod packet;
mod protocol;
mod replay;
mod snapshot;
mod transport;
#[cfg(windows)]
mod transport_windows;
mod types;

pub use engine::{Engine, PacketCallback};
pub use enums::*;
pub use error::{result_string, Error, Result};
pub use events::Event;
pub use packet::PacketDirection;
pub use protocol::Protocol;
pub use replay::{Frame, ReplayTransport};
pub use snapshot::{Snapshot, Texts};
pub use transport::{ConnectStatus, ConnectionBox, DeviceInfo, PollStatus, Transport};
#[cfg(windows)]
pub use transport_windows::WindowsTransport;
pub use types::*;
