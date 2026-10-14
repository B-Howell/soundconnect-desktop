//! Tauri commands over the managed [`EngineService`], plus [`TauriSink`], which
//! turns the service's sink calls into `engine:status` / `engine:snapshot` /
//! `engine:alert` window events.
//!
//! Every command logs one line to stderr so a debug build's console shows the
//! renderer's calls arriving. Argument names are Rust snake_case; Tauri exposes
//! them to `invoke` as camelCase.

use std::sync::Arc;

use tauri::{AppHandle, Emitter, State};
use tauri_plugin_opener::OpenerExt;

use crate::engine_service::{
    AlertView, DeviceView, DevicesView, EngineCommand, EngineService, SnapshotPayload,
    SnapshotSink, StatusView,
};
use crate::settings::{self, SettingsState};

/// Window event carrying a [`StatusView`].
pub const STATUS_EVENT: &str = "engine:status";
/// Window event carrying a [`SnapshotPayload`] (`{snapshot, noiseView}`).
pub const SNAPSHOT_EVENT: &str = "engine:snapshot";
/// Window event carrying an [`AlertView`] (`{message, autoResponse}`).
pub const ALERT_EVENT: &str = "engine:alert";
/// Window event carrying a [`DevicesView`] (`{devices: [{address, name, remembered}]}`).
pub const DEVICES_EVENT: &str = "engine:devices";
/// Windows' Bluetooth settings page, opened by `openBluetoothSettings`.
pub const BLUETOOTH_SETTINGS_URI: &str = "ms-settings:bluetooth";

/// Emits the service's events to every window.
pub struct TauriSink {
    app: AppHandle,
}

impl TauriSink {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }

    fn emit<T: serde::Serialize + Clone>(&self, event: &str, payload: &T) {
        if let Err(e) = self.app.emit(event, payload.clone()) {
            eprintln!("commands: emit {event} failed: {e}");
        }
    }
}

impl SnapshotSink for TauriSink {
    fn status(&self, status: &StatusView) {
        self.emit(STATUS_EVENT, status);
    }

    fn snapshot(&self, payload: &SnapshotPayload) {
        self.emit(SNAPSHOT_EVENT, payload);
    }

    fn alert(&self, alert: &AlertView) {
        self.emit(ALERT_EVENT, alert);
    }

    fn devices(&self, devices: &DevicesView) {
        self.emit(DEVICES_EVENT, devices);
    }
}

type Service<'a> = State<'a, Arc<EngineService>>;

/// The current connection status.
#[tauri::command]
pub fn engine_status(service: Service<'_>) -> StatusView {
    let s = service.status();
    eprintln!("command: engine_status -> {:?}", s.state);
    s
}

/// The latest snapshot payload, or null when not connected.
#[tauri::command]
pub fn engine_snapshot(service: Service<'_>) -> Option<SnapshotPayload> {
    let s = service.snapshot();
    eprintln!(
        "command: engine_snapshot -> {}",
        if s.is_some() { "some" } else { "none" }
    );
    s
}

/// Queues one command (`{"type": "setDsee", "enabled": true}`, ...).
/// `openBluetoothSettings` is handled here (opener plugin); `setAutoConnect`
/// is also stored in `settings.json` so the next launch honours it.
#[tauri::command]
pub fn engine_send(
    app: AppHandle,
    service: Service<'_>,
    settings_state: State<'_, SettingsState>,
    command: EngineCommand,
) -> Result<(), String> {
    eprintln!("command: engine_send {command:?}");
    match &command {
        EngineCommand::OpenBluetoothSettings => {
            return app
                .opener()
                .open_url(BLUETOOTH_SETTINGS_URI, None::<&str>)
                .map_err(|e| format!("open {BLUETOOTH_SETTINGS_URI}: {e}"));
        }
        EngineCommand::SetAutoConnect { enabled } => {
            let mut s = settings_state.get();
            s.auto_connect = *enabled;
            settings::store(&app, &settings_state, s)?;
        }
        _ => {}
    }
    service.send(command)
}

/// Lists the Bluetooth devices Windows has connected.
#[tauri::command]
pub async fn engine_devices(service: Service<'_>) -> Result<Vec<DeviceView>, String> {
    eprintln!("command: engine_devices");
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.devices())
        .await
        .map_err(|e| format!("device list task failed: {e}"))?
}

/// Connects to `address` now and remembers it.
#[tauri::command]
pub fn engine_connect(service: Service<'_>, address: String) -> Result<(), String> {
    eprintln!("command: engine_connect {address}");
    service.send(EngineCommand::Connect { address })
}

/// Drops the link and stops auto-connecting until `engine_send({type: "reconnect"})`.
#[tauri::command]
pub fn engine_disconnect(service: Service<'_>) -> Result<(), String> {
    eprintln!("command: engine_disconnect");
    service.send(EngineCommand::Disconnect)
}
