mod commands;
mod engine_service;
mod noise_view;
mod profiles;
mod settings;
mod tray;
mod winaudio_commands;

use std::sync::{Arc, Mutex};

use engine_service::{EngineService, ServiceConfig, TransportFactory};
use settings::SettingsState;
use tauri::{Manager, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_window_state::StateFlags;

/// Label of the one window declared in `tauri.conf.json`.
const MAIN_WINDOW: &str = "main";

/// The argument the autostart entry launches the app with.
pub const MINIMIZED_ARG: &str = "--minimized";

/// Shows, un-minimizes and focuses the window (tray click, tray "Show",
/// a second launch). The window may be hidden to the tray.
pub(crate) fn show_main_window(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        return;
    };
    if let Err(e) = window
        .show()
        .and_then(|()| window.unminimize())
        .and_then(|()| window.set_focus())
    {
        eprintln!("window: show failed: {e}");
    }
}

/// True when this launch should stay in the tray: started by the autostart
/// entry (`--minimized`) and both "Start with Windows" and "Start minimized" on.
fn start_hidden(args: &[String], settings: &settings::AppSettings) -> bool {
    args.iter().any(|a| a == MINIMIZED_ARG) && settings.starts_hidden_at_autostart()
}

/// The live transport: upstream's Windows RFCOMM backend (`mdr-bt-shared.dll`).
#[cfg(windows)]
fn transport_factory() -> TransportFactory {
    Arc::new(|| Ok(Box::new(mdr::WindowsTransport::new()?) as Box<dyn mdr::Transport>))
}

#[cfg(not(windows))]
fn transport_factory() -> TransportFactory {
    Arc::new(|| {
        Err(mdr::Error::Transport(
            "Bluetooth transport is Windows-only".into(),
        ))
    })
}

/// `SOUNDCONNECT_DUMP_SNAPSHOT=1` writes every published snapshot payload to
/// `%LOCALAPPDATA%\SoundConnect Desktop\last-snapshot.json`.
fn snapshot_dump_path() -> Option<std::path::PathBuf> {
    if std::env::var("SOUNDCONNECT_DUMP_SNAPSHOT").ok().as_deref() != Some("1") {
        return None;
    }
    let base = std::env::var_os("LOCALAPPDATA")?;
    Some(
        std::path::PathBuf::from(base)
            .join("SoundConnect Desktop")
            .join("last-snapshot.json"),
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // The elevated Windows-audio helper (`--apply-admin <hex-encoded changes>`) never starts Tauri.
    if let Some(code) = winaudio_commands::admin_entry() {
        std::process::exit(code);
    }
    // No explicit AppUserModelID: with one, the taskbar takes the icon from the
    // Start Menu shortcut carrying that ID, and shows a generic icon whenever that
    // shortcut's target is unreadable (seen 2026-10-12). Grouping by exe path is robust.
    let context = tauri::generate_context!();
    tauri::Builder::default()
        // Single-instance must be registered first so a second launch exits
        // before any other plugin touches the window or its saved state.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // A second autostart launch must not pop the window up.
            if !argv.iter().any(|a| a == MINIMIZED_ARG) {
                show_main_window(app);
            }
        }))
        // Not VISIBLE: a window closed to the tray must not come back hidden.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![MINIMIZED_ARG]),
        ))
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let keep = window
                    .try_state::<SettingsState>()
                    .is_some_and(|s| s.get().keep_running_in_tray);
                if keep && window.label() == MAIN_WINDOW {
                    api.prevent_close();
                    if let Err(e) = window.hide() {
                        eprintln!("window: hide failed: {e}");
                    }
                }
            }
        })
        .setup(|app| {
            let settings = settings::load(app.handle());
            let args: Vec<String> = std::env::args().collect();
            let hidden = start_hidden(&args, &settings);
            eprintln!("settings: {settings:?} start_hidden={hidden}");
            app.manage(SettingsState(Mutex::new(settings.clone())));

            let tray = tray::create(app.handle())?;
            let sink = Arc::new(tray::TraySink::new(app.handle().clone(), tray));
            app.manage(sink.clone());

            // One engine thread for the process; idle until asked unless autoConnect,
            // and reports through `engine:status` / `engine:snapshot` / `engine:alert`.
            let profiles_path = app
                .path()
                .app_config_dir()
                .ok()
                .map(|d| d.join(profiles::FILE_NAME));
            let config = ServiceConfig {
                auto_connect: settings.auto_connect,
                profiles_path,
                dump_path: snapshot_dump_path(),
                packet_log: std::env::var("SOUNDCONNECT_PACKET_LOG").ok().as_deref() == Some("1"),
                ..ServiceConfig::default()
            };
            if let Some(p) = &config.dump_path {
                eprintln!("engine: dumping snapshots to {}", p.display());
            }
            let service = EngineService::start(transport_factory(), sink, config);
            app.manage(Arc::new(service));

            // The window is created hidden (`visible: false`) so a start to the
            // tray never flashes it.
            if !hidden {
                show_main_window(app.handle());
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::engine_status,
            commands::engine_snapshot,
            commands::engine_send,
            commands::engine_devices,
            commands::engine_connect,
            commands::engine_disconnect,
            settings::settings_write,
            winaudio_commands::winaudio_snapshot,
            winaudio_commands::winaudio_fix_preset,
            winaudio_commands::winaudio_apply,
            winaudio_commands::winaudio_apply_admin,
            winaudio_commands::winaudio_restore,
            winaudio_commands::winaudio_restore_point,
            winaudio_commands::winaudio_forget_restore_point,
            winaudio_commands::winaudio_open_settings,
        ])
        .run(context)
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use settings::AppSettings;

    fn args(extra: &[&str]) -> Vec<String> {
        std::iter::once("soundconnect-desktop.exe")
            .chain(extra.iter().copied())
            .map(String::from)
            .collect()
    }

    #[test]
    fn starts_hidden_only_from_autostart_with_both_switches_on() {
        let both = AppSettings {
            start_with_windows: true,
            start_minimized: true,
            ..AppSettings::default()
        };
        assert!(start_hidden(&args(&[MINIMIZED_ARG]), &both));
        assert!(
            !start_hidden(&args(&[]), &both),
            "a manual launch shows the window"
        );
        let no_autostart = AppSettings {
            start_with_windows: false,
            ..both.clone()
        };
        assert!(!start_hidden(&args(&[MINIMIZED_ARG]), &no_autostart));
        assert!(!start_hidden(
            &args(&[MINIMIZED_ARG]),
            &AppSettings::default()
        ));
    }
}
