//! Tauri commands for the Windows audio page over the `winaudio` crate, plus
//! the restore point and the elevated helper's entry.
//!
//! - `winaudio_snapshot` reads the state for the headphones' address.
//! - `winaudio_fix_preset` returns the plan for "Fix for music" / "Fix for
//!   calls" (the renderer previews it, then applies it).
//! - `winaudio_apply` (user changes) and `winaudio_apply_admin` (admin changes,
//!   one UAC prompt) save the restore point first if there is none.
//! - `winaudio_restore` puts the restore point back; `winaudio_restore_point`
//!   reads it; `winaudio_forget_restore_point` deletes it.
//! - `winaudio_open_settings` opens one of two allow-listed Windows Settings
//!   pages for the settings the app can only show (spatial sound, mono).
//!
//! The restore point is `winaudio-before.json` in the app config folder
//! (`%APPDATA%\dev.soundconnect.desktop`): the state before
//! SoundConnect first changed anything. Every command is async and does its
//! Windows work on a blocking thread, so a UAC prompt never freezes the window.

use std::path::PathBuf;

use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;
use winaudio::{Change, ChangeResult, FixKind, Plan, WinAudioSnapshot};

/// The restore point's file name in the app config folder.
pub const RESTORE_POINT_FILE: &str = "winaudio-before.json";

/// The elevated helper: `Some(exit code)` when this launch is
/// `<exe> --apply-admin <hex-encoded changes>`; the caller exits before Tauri starts.
pub fn admin_entry() -> Option<i32> {
    #[cfg(windows)]
    {
        let args: Vec<String> = std::env::args().collect();
        winaudio::run_admin_cli(&args)
    }
    #[cfg(not(windows))]
    None
}

fn restore_point_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|d| d.join(RESTORE_POINT_FILE))
        .map_err(|e| format!("config folder: {e}"))
}

fn read_restore_point(path: &PathBuf) -> Option<WinAudioSnapshot> {
    let bytes = std::fs::read(path).ok()?;
    serde_json::from_slice(&bytes).ok()
}

async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|e| format!("winaudio task: {e}"))?
}

#[cfg(windows)]
fn read(address: &str, codec: Option<String>) -> Result<WinAudioSnapshot, String> {
    Ok(winaudio::snapshot(address, codec))
}

#[cfg(not(windows))]
fn read(_address: &str, _codec: Option<String>) -> Result<WinAudioSnapshot, String> {
    Err("Windows audio settings exist only on Windows".into())
}

/// Saves the current state as the restore point unless one exists.
fn ensure_restore_point(path: &PathBuf, address: &str) -> Result<(), String> {
    if read_restore_point(path).is_some() {
        return Ok(());
    }
    let snap = read(address, None)?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("config folder: {e}"))?;
    }
    let json = serde_json::to_vec_pretty(&snap).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| format!("restore point: {e}"))
}

#[tauri::command]
pub async fn winaudio_snapshot(
    address: String,
    codec: Option<String>,
) -> Result<WinAudioSnapshot, String> {
    blocking(move || read(&address, codec)).await
}

#[tauri::command]
pub async fn winaudio_fix_preset(
    kind: FixKind,
    address: String,
    codec: Option<String>,
) -> Result<Plan, String> {
    eprintln!("winaudio: fix preset {kind:?}");
    blocking(move || read(&address, codec).map(|s| winaudio::plan::fix_plan(kind, &s))).await
}

#[tauri::command]
pub async fn winaudio_apply(
    app: AppHandle,
    address: String,
    changes: Vec<Change>,
) -> Result<Vec<ChangeResult>, String> {
    eprintln!("winaudio: apply {} change(s)", changes.len());
    let path = restore_point_path(&app)?;
    blocking(move || {
        if changes.iter().any(Change::needs_admin) {
            return Err("administrator changes go through winaudio_apply_admin".into());
        }
        ensure_restore_point(&path, &address)?;
        #[cfg(windows)]
        return Ok(winaudio::apply(&changes));
        #[cfg(not(windows))]
        Err("Windows only".into())
    })
    .await
}

#[tauri::command]
pub async fn winaudio_apply_admin(
    app: AppHandle,
    address: String,
    changes: Vec<Change>,
) -> Result<Vec<ChangeResult>, String> {
    eprintln!("winaudio: apply {} admin change(s)", changes.len());
    let path = restore_point_path(&app)?;
    blocking(move || {
        ensure_restore_point(&path, &address)?;
        #[cfg(windows)]
        return winaudio::apply_admin(&changes);
        #[cfg(not(windows))]
        Err("Windows only".into())
    })
    .await
}

#[tauri::command]
pub async fn winaudio_restore(
    app: AppHandle,
    codec: Option<String>,
) -> Result<Vec<ChangeResult>, String> {
    eprintln!("winaudio: restore");
    let path = restore_point_path(&app)?;
    blocking(move || {
        let before = read_restore_point(&path).ok_or("there is no restore point")?;
        #[cfg(windows)]
        return winaudio::restore(&before, codec);
        #[cfg(not(windows))]
        {
            let _ = (before, codec);
            Err("Windows only".into())
        }
    })
    .await
}

#[tauri::command]
pub async fn winaudio_restore_point(app: AppHandle) -> Result<Option<WinAudioSnapshot>, String> {
    let path = restore_point_path(&app)?;
    blocking(move || Ok(read_restore_point(&path))).await
}

#[tauri::command]
pub async fn winaudio_forget_restore_point(app: AppHandle) -> Result<(), String> {
    eprintln!("winaudio: forget restore point");
    let path = restore_point_path(&app)?;
    blocking(move || match std::fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("restore point: {e}")),
    })
    .await
}

/// A Windows Settings page the renderer may open (no free-form URIs).
#[derive(Debug, Clone, Copy, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SettingsPage {
    /// Settings > System > Sound (spatial sound lives under the device).
    Sound,
    /// Settings > Accessibility > Audio (mono audio).
    Accessibility,
}

impl SettingsPage {
    fn uri(self) -> &'static str {
        match self {
            Self::Sound => "ms-settings:sound",
            Self::Accessibility => "ms-settings:easeofaccess-audio",
        }
    }
}

#[tauri::command]
pub fn winaudio_open_settings(app: AppHandle, page: SettingsPage) -> Result<(), String> {
    let uri = page.uri();
    app.opener()
        .open_url(uri, None::<&str>)
        .map_err(|e| format!("open {uri}: {e}"))
}
