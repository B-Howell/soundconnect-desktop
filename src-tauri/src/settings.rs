//! The Rust-readable mirror of the renderer's settings.
//!
//! The source of truth is the renderer's zustand store (`localStorage` key
//! `soundconnect.settings`, see `src/state/settingsStore.ts`). Rust cannot read
//! WebView storage, yet it needs `keepRunningInTray` when the window is closed
//! and `startWithWindows` / `startMinimized` before the window is shown. So the
//! renderer calls [`settings_write`] with its values whenever the store
//! changes (and once at start), and this module keeps them in
//! `<app_config_dir>/settings.json`
//! (`%APPDATA%\dev.soundconnect.desktop\settings.json`), read once at
//! launch by [`load`]. A missing or unreadable file means the defaults, which
//! match `SETTINGS_DEFAULTS` in the store.
//!
//! `autoConnect` (default off) is read by the engine service at launch: off
//! means the service stays idle until the user connects. The renderer may send
//! it in [`settings_write`] or as the engine command `setAutoConnect`; a
//! `settings_write` without it keeps the stored value.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

/// File name inside the app config dir.
pub const FILE_NAME: &str = "settings.json";

const THEMES: [&str; 3] = ["system", "light", "dark"];

/// The app settings, camelCase on the wire and on disk.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String,
    pub start_with_windows: bool,
    pub start_minimized: bool,
    pub keep_running_in_tray: bool,
    /// Discover and connect without being asked (off: idle until "Connect").
    #[serde(default)]
    pub auto_connect: bool,
}

/// What `settings_write` accepts: the renderer's settings, `autoConnect`
/// optional so an older renderer cannot reset it.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsInput {
    pub theme: String,
    pub start_with_windows: bool,
    pub start_minimized: bool,
    pub keep_running_in_tray: bool,
    #[serde(default)]
    pub auto_connect: Option<bool>,
}

impl SettingsInput {
    /// `current` updated with this input.
    pub fn merge(self, current: &AppSettings) -> AppSettings {
        AppSettings {
            theme: self.theme,
            start_with_windows: self.start_with_windows,
            start_minimized: self.start_minimized,
            keep_running_in_tray: self.keep_running_in_tray,
            auto_connect: self.auto_connect.unwrap_or(current.auto_connect),
        }
    }
}

impl Default for AppSettings {
    /// Same as the renderer's `SETTINGS_DEFAULTS`.
    fn default() -> Self {
        Self {
            theme: "system".into(),
            start_with_windows: false,
            start_minimized: false,
            keep_running_in_tray: true,
            auto_connect: false,
        }
    }
}

impl AppSettings {
    /// Like the renderer's `sanitizeSettings`: keeps each known field only when it
    /// has the right type (and a known theme); anything else is the default.
    pub fn from_json(text: &str) -> Self {
        // Windows PowerShell 5.1 writes UTF-8 with a BOM, which serde_json rejects.
        let text = text.trim_start_matches('\u{feff}');
        let mut s = Self::default();
        let Ok(serde_json::Value::Object(raw)) = serde_json::from_str::<serde_json::Value>(text)
        else {
            return s;
        };
        if let Some(t) = raw.get("theme").and_then(|v| v.as_str()) {
            if THEMES.contains(&t) {
                s.theme = t.to_string();
            }
        }
        let flag = |key: &str| raw.get(key).and_then(|v| v.as_bool());
        if let Some(v) = flag("startWithWindows") {
            s.start_with_windows = v;
        }
        if let Some(v) = flag("startMinimized") {
            s.start_minimized = v;
        }
        if let Some(v) = flag("keepRunningInTray") {
            s.keep_running_in_tray = v;
        }
        if let Some(v) = flag("autoConnect") {
            s.auto_connect = v;
        }
        s
    }

    /// Open to the tray at an automatic start: both switches must be on, because
    /// `startMinimized` stays stored while autostart is off.
    pub fn starts_hidden_at_autostart(&self) -> bool {
        self.start_with_windows && self.start_minimized
    }
}

/// Reads `path`; a missing, unreadable or invalid file gives the defaults.
pub fn load_from(path: &Path) -> AppSettings {
    match std::fs::read_to_string(path) {
        Ok(text) => AppSettings::from_json(&text),
        Err(_) => AppSettings::default(),
    }
}

/// Writes `settings` as pretty JSON, creating the directory.
pub fn save_to(path: &Path, settings: &AppSettings) -> std::io::Result<()> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    let json = serde_json::to_string_pretty(settings).map_err(std::io::Error::other)?;
    std::fs::write(path, json)
}

/// `<app_config_dir>/settings.json`.
pub fn file_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join(FILE_NAME))
}

/// The settings at launch (defaults when the file is missing or invalid).
pub fn load(app: &AppHandle) -> AppSettings {
    file_path(app).map(|p| load_from(&p)).unwrap_or_default()
}

/// The current settings, managed as Tauri state: loaded at launch, replaced by
/// every [`settings_write`].
pub struct SettingsState(pub Mutex<AppSettings>);

impl SettingsState {
    pub fn get(&self) -> AppSettings {
        self.0.lock().expect("settings lock").clone()
    }
}

/// Replaces the settings in memory and in `settings.json`; returns the
/// previous value.
pub fn store(
    app: &AppHandle,
    state: &SettingsState,
    settings: AppSettings,
) -> Result<AppSettings, String> {
    let previous = std::mem::replace(
        &mut *state.0.lock().expect("settings lock"),
        settings.clone(),
    );
    let path = file_path(app).ok_or("no app config dir")?;
    save_to(&path, &settings).map_err(|e| format!("write {}: {e}", path.display()))?;
    Ok(previous)
}

/// Mirrors the renderer's settings into memory and `settings.json`. A changed
/// `autoConnect` is passed on to the engine service.
#[tauri::command]
pub fn settings_write(
    app: AppHandle,
    state: State<'_, SettingsState>,
    settings: SettingsInput,
) -> Result<(), String> {
    eprintln!("command: settings_write {settings:?}");
    let merged = settings.merge(&state.get());
    let previous = store(&app, &state, merged.clone())?;
    if previous.auto_connect != merged.auto_connect {
        if let Some(service) =
            app.try_state::<std::sync::Arc<crate::engine_service::EngineService>>()
        {
            service.send(crate::engine_service::EngineCommand::SetAutoConnect {
                enabled: merged.auto_connect,
            })?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_file(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "soundconnect-settings-test-{}-{name}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        dir.join(FILE_NAME)
    }

    #[test]
    fn missing_file_gives_defaults() {
        let path = temp_file("missing");
        assert!(!path.exists());
        assert_eq!(load_from(&path), AppSettings::default());
        assert!(load_from(&path).keep_running_in_tray);
    }

    #[test]
    fn invalid_json_gives_defaults() {
        let path = temp_file("invalid");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, "{ not json").unwrap();
        assert_eq!(load_from(&path), AppSettings::default());
        std::fs::write(&path, "[1, 2]").unwrap();
        assert_eq!(load_from(&path), AppSettings::default());
    }

    #[test]
    fn wrongly_typed_fields_fall_back_one_by_one() {
        let s = AppSettings::from_json(
            r#"{"theme":"sepia","startWithWindows":"yes","startMinimized":true,"keepRunningInTray":false}"#,
        );
        assert_eq!(s.theme, "system");
        assert!(!s.start_with_windows);
        assert!(s.start_minimized);
        assert!(!s.keep_running_in_tray);
    }

    #[test]
    fn valid_file_round_trips() {
        let path = temp_file("valid");
        let written = AppSettings {
            theme: "dark".into(),
            start_with_windows: true,
            start_minimized: true,
            keep_running_in_tray: false,
            auto_connect: true,
        };
        save_to(&path, &written).unwrap();
        let text = std::fs::read_to_string(&path).unwrap();
        assert!(text.contains("\"keepRunningInTray\": false"), "{text}");
        assert_eq!(load_from(&path), written);
        assert!(written.starts_hidden_at_autostart());
    }

    #[test]
    fn start_minimized_needs_autostart() {
        let s = AppSettings {
            start_minimized: true,
            ..AppSettings::default()
        };
        assert!(!s.starts_hidden_at_autostart());
    }

    #[test]
    fn command_payload_deserializes_from_renderer_json() {
        let s: AppSettings = serde_json::from_str(
            r#"{"theme":"light","startWithWindows":false,"startMinimized":false,"keepRunningInTray":true}"#,
        )
        .unwrap();
        assert_eq!(s.theme, "light");
        assert!(s.keep_running_in_tray);
        assert!(!s.auto_connect, "autoConnect defaults to off");
    }

    #[test]
    fn input_without_auto_connect_keeps_the_stored_value() {
        let input: SettingsInput = serde_json::from_str(
            r#"{"theme":"dark","startWithWindows":true,"startMinimized":false,"keepRunningInTray":true}"#,
        )
        .unwrap();
        let current = AppSettings {
            auto_connect: true,
            ..AppSettings::default()
        };
        let merged = input.clone().merge(&current);
        assert!(merged.auto_connect);
        assert_eq!(merged.theme, "dark");
        let with: SettingsInput = serde_json::from_str(
            r#"{"theme":"dark","startWithWindows":true,"startMinimized":false,"keepRunningInTray":true,"autoConnect":false}"#,
        )
        .unwrap();
        assert!(!with.merge(&current).auto_connect);
        assert!(AppSettings::from_json(r#"{"autoConnect":true}"#).auto_connect);
        assert!(!AppSettings::from_json("{}").auto_connect);
        assert!(
            AppSettings::from_json("\u{feff}{\"autoConnect\":true}").auto_connect,
            "a leading BOM is ignored"
        );
    }
}
