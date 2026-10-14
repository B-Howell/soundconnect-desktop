//! Windows-side audio settings for one pair of Bluetooth headphones.
//!
//! - [`snapshot`] reads a [`WinAudioSnapshot`] (user rights, read-only).
//! - [`plan::fix_plan`] / [`plan::restore_plan`] say what "Stereo audio",
//!   "Mono audio with mic" and "Restore" would change (pure, tested on a recording).
//! - [`apply`] runs user-level changes in this process; [`apply_admin`] runs
//!   the admin ones in an elevated copy of the app (`--apply-admin`, see
//!   [`run_admin_cli`]). Every change is read back (`verified`).
//!
//! Docs: `docs/core/SoundConnect Desktop - Windows Audio.md`.

pub mod model;
pub mod plan;

#[cfg(windows)]
mod sys;

pub use model::*;

#[cfg(windows)]
pub use sys::{apply, apply_admin, run_admin_cli, snapshot, ADMIN_ARG, DECLINED};

/// Applies a whole plan: admin changes first (Hands-Free must exist before
/// its endpoints can become defaults), then the user-level ones.
#[cfg(windows)]
pub fn apply_plan(plan: &Plan) -> Result<Vec<ChangeResult>, String> {
    let (user, admin) = plan.split();
    let mut results = apply_admin(&admin)?;
    results.extend(apply(&user));
    Ok(results)
}

/// Puts `before` back: reads the current state, plans the differences, applies them.
#[cfg(windows)]
pub fn restore(
    before: &WinAudioSnapshot,
    codec: Option<String>,
) -> Result<Vec<ChangeResult>, String> {
    let now = snapshot(&before.address, codec);
    apply_plan(&plan::restore_plan(before, &now))
}
