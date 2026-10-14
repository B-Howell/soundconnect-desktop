//! Everything that calls Windows. See the crate docs for the API map.

mod adapter;
mod apply;
mod audio;
mod bluetooth;
mod elevate;
mod read;
mod registry;
mod system;

pub use apply::apply;
pub use elevate::{apply_admin, run_admin_cli, ADMIN_ARG, DECLINED};
pub use read::snapshot;
