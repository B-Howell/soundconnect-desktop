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
//! `autoConnect` (default on since 0.1.11) is read by the engine service at
//! launch: on means the remembered headphones are connected when they appear
//! in Windows' list; off means the service stays idle until the user connects.
//! The renderer may send it in [`settings_write`] or as the engine command
//! `setAutoConnect`; a `settings_write` without it keeps the stored value.
//!
//! `settingsVersion` (absent before 0.1.11, [`SETTINGS_VERSION`] since) runs
//! one migration: a file older than version 2 never recorded a user's choice
//! for `autoConnect` (0.1.10 and earlier wrote the default `false` on every
//! save), so it is turned on once and the file is rewritten with the version.
//! From then on the stored value is the user's and is never changed.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

/// File name inside the app config dir.
pub const FILE_NAME: &str = "settings.json";

const THEMES: [&str; 3] = ["system", "light", "dark"];

/// The settings schema version written since 0.1.11 (see the module doc).
pub const SETTINGS_VERSION: u32 = 2;

fn default_true() -> bool {
    true
}

/// The app settings, camelCase on the wire and on disk.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: String,
    pub start_with_windows: bool,
    pub start_minimized: bool,
    pub keep_running_in_tray: bool,
    /// Connect when the remembered headphones appear (off: idle until "Connect").
    #[serde(default = "default_true")]
    pub auto_connect: bool,
    /// The schema version ([`SETTINGS_VERSION`]); older files are migrated once.
    #[serde(default)]
    pub settings_version: u32,
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
            settings_version: SETTINGS_VERSION,
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
            auto_connect: true,
            settings_version: SETTINGS_VERSION,
        }
    }
}

impl AppSettings {
    /// Like the renderer's `sanitizeSettings`: keeps each known field only when it
    /// has the right type (and a known theme); anything else is the default.
    /// A file older than [`SETTINGS_VERSION`] is migrated: `autoConnect` on.
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
        let version = raw
            .get("settingsVersion")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);
        if version < u64::from(SETTINGS_VERSION) {
            // 0.1.10 and earlier stored no user choice for autoConnect.
            s.auto_connect = true;
        } else {
            // Keep a newer version's number, so a later write never downgrades it.
            s.settings_version = u32::try_from(version).unwrap_or(u32::MAX);
        }
        s
    }

    /// Open to the tray at an automatic start: both switches must be on, because
    /// `startMinimized` stays stored while autostart is off.
    pub fn starts_hidden_at_autostart(&self) -> bool {
        self.start_with_windows && self.start_minimized
    }
}

/// Reads `path`; a missing, unreadable or invalid file gives the defaults. A
/// file from before [`SETTINGS_VERSION`] is migrated and rewritten once, so
/// the migration never runs again and a later user choice is kept.
pub fn load_from(path: &Path) -> AppSettings {
    let Ok(text) = std::fs::read_to_string(path) else {
        return AppSettings::default();
    };
    let settings = AppSettings::from_json(&text);
    if stored_version(&text) < SETTINGS_VERSION {
        eprintln!(
            "settings: migrated {} to version {SETTINGS_VERSION} (autoConnect on)",
            path.display()
        );
        if let Err(e) = save_to(path, &settings) {
            eprintln!("settings: could not rewrite {}: {e}", path.display());
        }
    }
    settings
}

/// The `settingsVersion` a file carries (0 when absent or unreadable).
fn stored_version(text: &str) -> u32 {
    serde_json::from_str::<serde_json::Value>(text.trim_start_matches('\u{feff}'))
        .ok()
        .and_then(|v| v.get("settingsVersion").and_then(|n| n.as_u64()))
        .and_then(|n| u32::try_from(n).ok())
        .unwrap_or(0)
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
            settings_version: SETTINGS_VERSION,
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
        assert!(s.auto_connect, "autoConnect defaults to on");
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
        assert!(AppSettings::from_json(r#"{"autoConnect":true,"settingsVersion":2}"#).auto_connect);
        assert!(
            !AppSettings::from_json(r#"{"autoConnect":false,"settingsVersion":2}"#).auto_connect
        );
        assert!(
            AppSettings::from_json("\u{feff}{\"autoConnect\":false,\"settingsVersion\":2}")
                .settings_version
                == SETTINGS_VERSION,
            "a leading BOM is ignored"
        );
        assert!(
            !AppSettings::from_json("\u{feff}{\"autoConnect\":false,\"settingsVersion\":2}")
                .auto_connect,
            "a leading BOM is ignored"
        );
    }

    /// The file 0.1.10 wrote (no `settingsVersion`, the default `false`).
    const V0110_FILE: &str = r#"{
  "theme": "system",
  "startWithWindows": false,
  "startMinimized": false,
  "keepRunningInTray": true,
  "autoConnect": false
}"#;

    #[test]
    fn migration_turns_auto_connect_on_once_and_keeps_a_later_user_choice() {
        let path = temp_file("migrate");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, V0110_FILE).unwrap();
        let first = load_from(&path);
        assert!(
            first.auto_connect,
            "a 0.1.10 install auto-connects after the update"
        );
        assert!(first.keep_running_in_tray, "the other values are kept");
        let text = std::fs::read_to_string(&path).unwrap();
        assert!(
            text.contains("\"settingsVersion\": 2"),
            "rewritten once: {text}"
        );
        assert!(text.contains("\"autoConnect\": true"), "{text}");

        // The user switches it off (settings_write / setAutoConnect store it).
        let off = AppSettings {
            auto_connect: false,
            ..first
        };
        save_to(&path, &off).unwrap();
        for _ in 0..2 {
            assert!(!load_from(&path).auto_connect, "a user-set false is kept");
        }
        assert_eq!(
            std::fs::read_to_string(&path).unwrap(),
            serde_json::to_string_pretty(&off).unwrap()
        );
    }

    #[test]
    fn a_newer_settings_version_is_kept() {
        let s = AppSettings::from_json(r#"{"autoConnect":false,"settingsVersion":3}"#);
        assert_eq!(s.settings_version, 3);
        assert!(!s.auto_connect);
    }

    #[test]
    fn a_missing_file_auto_connects_and_is_not_created_by_load() {
        let path = temp_file("fresh");
        assert!(load_from(&path).auto_connect);
        assert!(!path.exists(), "the renderer writes it moments later");
    }
}
