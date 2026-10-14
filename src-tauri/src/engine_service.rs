//! [`EngineService`]: one OS thread that owns the Bluetooth transport and the
//! libmdr [`Engine`], discovers and connects to the headphones, drives the
//! engine's poll loop and publishes status and snapshots through a
//! [`SnapshotSink`].
//!
//! State machine (published as `engine:status`):
//!
//! ```text
//! Disconnected -> Discovering -> Connecting{address, uuid_index, deadline}
//!              -> Initialising -> Ready -> Disconnected(lastError)
//! ```
//!
//! - Idle after launch: unless the `autoConnect` setting is on, the service does
//!   nothing until the renderer sends `connect`, `reconnect` or `scan`; the
//!   status carries the remembered profile (`profiles.rs`) so the window can say
//!   "not connected" without searching.
//! - Discovering (`autoConnect` on): every `discovery_interval` (2 s) list the
//!   devices Windows has connected and pick the most recently remembered one,
//!   else the first whose name starts with `WH-`, `WF-` or `LinkBuds`.
//! - Connecting: like upstream `client/Client.cpp` `StartConnection` /
//!   `TryConnectionAttempt` / `AdvanceConnectionAttempt`: service UUIDs in the
//!   order `{MDR_SERVICE_UUID_XM5, MDR_SERVICE_UUID_LEGACY}`, each attempt with a
//!   `kAttemptTimeoutMs = 10'000` deadline, polled with `mdrConnectionPoll(conn, 0)`.
//!   The UUID that connects fixes the protocol (`ConnectionProtocolVersion`:
//!   LEGACY -> V1, otherwise V2).
//! - Initialising: `Engine::create` + `request_init`; on `InitializeComplete`
//!   `request_sync`; on `SyncComplete` -> Ready.
//! - Ready: each tick (16 ms) polls the engine, publishes a snapshot after any
//!   state-changing event, answers `NeedSync`, applies queued commands once the
//!   engine `is_ready`, and commits only right after applying a user command.
//!   Nothing else writes to the device (see "Coexisting with the Sony phone
//!   app" in the Core Services doc). A frame libmdr cannot parse is skipped,
//!   not treated as a lost link (the XM4's Speak-to-Chat notify, see below).
//! - Setting changes that restart the headset's links (see
//!   `docs/core/evidence/toggle-dropouts-debug.md`): a connection-quality change
//!   is held behind a confirmation (`engine:alert`
//!   [`CONFIRM_CONNECTION_MODE_ALERT`], `requiresChoice`), and a link lost within
//!   [`RECOVERY_TRIGGER`] of a connection-quality, Speak-to-Chat or DSEE command
//!   is reconnected for up to `recovery_window` (20 s) even with `autoConnect`
//!   off, published as `connecting` with reason `reconnectingAfterSettingChange`.
//!
//! See `docs/core/SoundConnect Desktop - Core Services.md`.

use std::collections::VecDeque;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use crossbeam_channel::{bounded, unbounded, RecvTimeoutError, Sender};
use mdr::{
    AlertAction, AssignableControl, AudioPriority, ConnectStatus, ConnectionMode, Engine,
    EqualizerPresetId, Event, PairedDeviceCommand, PlaybackAction, PollStatus, Protocol, Snapshot,
    SpeakTimeout, SpeakToChat, SpeechSensitivity, Transport, WearingPowerMode,
};
use serde::{Deserialize, Serialize};

use crate::profiles::{now_ms, DeviceProfile, Profiles};

use crate::noise_view::{
    noise_request, noise_view, NoiseView, NoiseViewMode, AMBIENT_MAX, AMBIENT_MIN,
    DEFAULT_AMBIENT_LEVEL,
};

/// Creates a fresh, unconnected transport (the Windows RFCOMM backend in the
/// app, a replay in tests).
pub type TransportFactory = Arc<dyn Fn() -> mdr::Result<Box<dyn Transport>> + Send + Sync>;

/// Upstream order: `connectionAttempt.services = {MDR_SERVICE_UUID_XM5, MDR_SERVICE_UUID_LEGACY}`.
pub const SERVICE_ORDER: [Protocol; 2] = [Protocol::V2, Protocol::V1];

/// The alert the XM3 raises when its EQ preset changes; upstream's client answered
/// `NEGATIVE` and the device applied the preset without disconnecting
/// (`docs/device-support/WH-1000XM3.md`).
pub const AUTO_DECLINED_ALERT: &str = "DISCONNECT_CAUSED_BY_CONNECTION_MODE_CHANGE";

/// `engine:alert` message the service raises itself before a connection-quality
/// change: the WH-1000XM4 applies it by closing RFCOMM ~0.1 s after its
/// `AUDIO_NTFY_PARAM` and dropping its A2DP endpoint for ~3 s; it sends no
/// alert of its own. `respondToAlert {positive: true}` sends the change,
/// `false` discards it.
pub const CONFIRM_CONNECTION_MODE_ALERT: &str = "CONFIRM_CONNECTION_MODE_CHANGE";

/// A link lost this soon after a setting command that may restart the
/// headset's links is reconnected automatically (the XM4 dropped 0.1-0.2 s
/// after the command; the margin covers a slow commit).
pub const RECOVERY_TRIGGER: Duration = Duration::from_secs(10);

/// Name prefixes auto-connected to when no address is remembered.
const NAME_PREFIXES: [&str; 3] = ["WH-", "WF-", "LinkBuds"];

/// Engine events drained per tick at most (upstream polls once per frame).
const MAX_EVENTS_PER_TICK: usize = 32;

/// The error of a link that did not finish init + sync in `init_timeout`.
const INIT_TIMEOUT: &str = "initialisation timed out";

/// Timing and options. [`ServiceConfig::default`] is the app's configuration.
#[derive(Clone, Debug)]
pub struct ServiceConfig {
    /// Period of device enumeration while disconnected.
    pub discovery_interval: Duration,
    /// Wait after a failed connection before trying the same device again.
    pub retry_backoff: Duration,
    /// Per-UUID connect deadline (upstream `kAttemptTimeoutMs = 10'000`).
    pub attempt_timeout: Duration,
    /// Engine poll period while connecting or connected.
    pub tick: Duration,
    /// Give up when init + sync has not completed in this time.
    pub init_timeout: Duration,
    /// Discover and connect on start and after a lost link (the `autoConnect`
    /// setting; off by default).
    pub auto_connect: bool,
    /// `devices.json` (remembered profiles); `None` keeps them in memory only.
    pub profiles_path: Option<PathBuf>,
    /// Write every published snapshot payload here (`SOUNDCONNECT_DUMP_SNAPSHOT=1`).
    pub dump_path: Option<PathBuf>,
    /// Log every TX/RX frame to stderr (`SOUNDCONNECT_PACKET_LOG=1`).
    pub packet_log: bool,
    /// How long to keep reconnecting after a drop that followed a setting change.
    pub recovery_window: Duration,
    /// Wait between reconnect attempts in that window.
    pub recovery_retry: Duration,
}

impl Default for ServiceConfig {
    fn default() -> Self {
        Self {
            discovery_interval: Duration::from_secs(2),
            retry_backoff: Duration::from_secs(10),
            attempt_timeout: Duration::from_millis(10_000),
            tick: Duration::from_millis(16),
            init_timeout: Duration::from_secs(30),
            auto_connect: false,
            profiles_path: None,
            dump_path: None,
            packet_log: false,
            recovery_window: Duration::from_secs(20),
            // The live XM4 refused RFCOMM 0.4 s after its drop and accepted it at 1.7 s.
            recovery_retry: Duration::from_secs(1),
        }
    }
}

/// Where the service delivers what the renderer must hear.
pub trait SnapshotSink: Send + Sync + 'static {
    /// `engine:status`
    fn status(&self, status: &StatusView);
    /// `engine:snapshot`
    fn snapshot(&self, payload: &SnapshotPayload);
    /// `engine:alert`
    fn alert(&self, alert: &AlertView);
    /// `engine:devices` (the answer to a `scan` command)
    fn devices(&self, devices: &DevicesView);
}

/// Why the link is not ready (`engine:status.reason`): why the last connection
/// attempt failed (with `disconnected`), or that the service is reconnecting by
/// itself (with `connecting` / `initialising`).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum FailureReason {
    /// Windows does not list the headphones as connected: turn them on or
    /// connect them in Bluetooth settings.
    NotConnectedToWindows,
    /// Windows lists them as connected but the control channel would not open:
    /// another controller (the Sony phone app, another PC) holds it.
    Busy,
    /// The device did not answer in time (connect or initialisation).
    Timeout,
    /// The device closed or rejected the link while initialising.
    Refused,
    /// The headset dropped the link right after a setting change (a
    /// connection-quality change restarts its Bluetooth links); the service is
    /// reconnecting by itself.
    ReconnectingAfterSettingChange,
}

/// Connection state as the renderer sees it.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ConnState {
    Disconnected,
    Discovering,
    Connecting,
    Initialising,
    Ready,
}

/// `engine:status` payload:
/// `{state, deviceName?, address?, protocol?, lastError?, reason?, remembered}`.
/// `remembered` is the profile of the device in `address` when there is one,
/// else the most recently seen profile, else `null`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusView {
    pub state: ConnState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub protocol: Option<Protocol>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<FailureReason>,
    pub remembered: Option<DeviceProfile>,
}

impl StatusView {
    pub fn disconnected(last_error: Option<String>) -> Self {
        Self {
            state: ConnState::Disconnected,
            device_name: None,
            address: None,
            protocol: None,
            last_error,
            reason: None,
            remembered: None,
        }
    }
}

/// One entry of `engine:devices`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScannedDevice {
    pub address: String,
    pub name: String,
    /// A profile exists for this address.
    pub remembered: bool,
}

/// `engine:devices` payload: `{devices: [{address, name, remembered}]}`, the
/// Bluetooth devices Windows lists as connected.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct DevicesView {
    pub devices: Vec<ScannedDevice>,
}

/// `engine:snapshot` payload: the raw [`Snapshot`] plus the normalised noise view
/// (`null` when the device reports no noise control).
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotPayload {
    pub snapshot: Snapshot,
    pub noise_view: Option<NoiseView>,
}

/// `engine:alert` payload: `{message, autoResponse, requiresChoice}`.
/// `autoResponse` is set when the service answered it; `requiresChoice` is true
/// when it waits for `respondToAlert` (a device yes/no alert, or
/// [`CONFIRM_CONNECTION_MODE_ALERT`]).
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlertView {
    pub message: String,
    pub auto_response: Option<AlertAction>,
    pub requires_choice: bool,
}

/// A Bluetooth device the transport can see.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceView {
    pub address: String,
    pub name: String,
}

/// Commands from the renderer (`engine_send`). JSON: `{"type": "setDsee", "enabled": true}`.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum EngineCommand {
    /// Noise control in view terms (see `noise_view.rs`).
    SetNoise {
        mode: NoiseViewMode,
        ambient_level: Option<u8>,
        focus_on_voice: Option<bool>,
    },
    /// Ambient at `level` (1..20).
    SetAmbientLevel { level: u8 },
    /// Focus on voice, keeping the current mode and level.
    SetFocusOnVoice { enabled: bool },
    /// `MDREqualizer.preset` (camelCase name or raw number).
    SetEqualizerPreset { preset: EqualizerPresetId },
    /// `mdrHeadphonesSetEqualizerBands`
    SetEqualizerBands { bands: Vec<i8> },
    /// `MDREqualizer.clear_bass`
    SetClearBass { level: i8 },
    /// `MDREqualizer.dsee_enabled`
    SetDsee { enabled: bool },
    /// play / pause / next / previous
    Playback { action: PlaybackAction },
    /// `MDRPlayback.volume`
    SetVolume { volume: u8 },
    /// `MDRPower` fields; absent ones keep the device's value.
    SetPower {
        auto_power_off_minutes: Option<u32>,
        wearing_power: Option<WearingPowerMode>,
        auto_pause: Option<bool>,
        head_gesture: Option<bool>,
    },
    /// `MDRVoiceGuidance`
    SetVoiceGuidance { enabled: bool, volume: Option<i8> },
    /// `mdrHeadphonesSetGeneralSetting`
    SetGeneralSetting { index: u32, value: bool },
    /// `mdrHeadphonesSetAssignableControls`
    SetAssignableControls { controls: Vec<AssignableControl> },
    /// `MDRPower.shutdown_requested = MDR_TRUE` (Client.cpp 1392).
    PowerOff,
    /// Answer the pending `engine:alert`.
    RespondToAlert { positive: bool },
    /// Drop the link and stop auto-connecting until `reconnect` / `connect`.
    Disconnect,
    /// Drop the link (if any) and connect to the remembered device (else the
    /// first Sony headset Windows lists).
    Reconnect,
    /// Connect to this address now (it is remembered once it reaches Ready).
    Connect { address: String },
    /// List the devices Windows has connected -> `engine:devices`.
    Scan,
    /// Delete the remembered profile (and drop the link if it is this device).
    ForgetDevice { address: String },
    /// The `autoConnect` setting: on = discover and reconnect by itself.
    SetAutoConnect { enabled: bool },
    /// Opens `ms-settings:bluetooth` (handled by the Tauri command layer).
    OpenBluetoothSettings,
    /// `mdrHeadphonesSetSpeakToChat` (all three fields, like client/Client.cpp 1712).
    SetSpeakToChat {
        enabled: bool,
        sensitivity: SpeechSensitivity,
        timeout: SpeakTimeout,
    },
    /// `mdrHeadphonesSetConnectionMode` (sound quality vs connection stability).
    /// A real change waits for the user's `respondToAlert` (see
    /// [`CONFIRM_CONNECTION_MODE_ALERT`]): the headset reconnects to apply it.
    SetConnectionMode { audio_priority: AudioPriority },
    /// `mdrHeadphonesSetPairedDevice`; `deviceId` is the `macAddress` from
    /// `pairedDevices` (17 characters, client/Client.cpp 1843-1849).
    SetPairedDevice {
        command: PairedDeviceCommand,
        device_id: String,
    },
    /// `mdrHeadphonesSetPairing` (pairing mode on/off).
    SetPairing { enabled: bool },
    /// `MDRPower.auto_pause` only; the other power fields keep the device's value.
    SetAutoPause { enabled: bool },
    /// The general setting whose subject is `MULTIPOINT_SETTING`.
    SetMultipoint { enabled: bool },
}

/// `MDR_TEXT_GENERAL_SETTING_SUBJECT` of the multipoint toggle (XM4 index 1).
pub const MULTIPOINT_SUBJECT: &str = "MULTIPOINT_SETTING";

impl EngineCommand {
    /// Commands that act on the service rather than the device.
    fn is_service_command(&self) -> bool {
        matches!(
            self,
            EngineCommand::Disconnect
                | EngineCommand::Reconnect
                | EngineCommand::Connect { .. }
                | EngineCommand::Scan
                | EngineCommand::ForgetDevice { .. }
                | EngineCommand::SetAutoConnect { .. }
                | EngineCommand::OpenBluetoothSettings
        )
    }
}

enum Msg {
    Command(EngineCommand),
    Devices(Sender<Result<Vec<DeviceView>, String>>),
    Shutdown,
}

struct Shared {
    status: Mutex<StatusView>,
    snapshot: Mutex<Option<SnapshotPayload>>,
    /// Engine ticks run while live (tests count idle ticks with it).
    live_ticks: std::sync::atomic::AtomicU64,
}

/// Handle to the engine thread. Dropping it stops the thread.
pub struct EngineService {
    tx: Sender<Msg>,
    shared: Arc<Shared>,
    thread: Mutex<Option<JoinHandle<()>>>,
}

impl EngineService {
    /// Spawns the engine thread.
    pub fn start(
        factory: TransportFactory,
        sink: Arc<dyn SnapshotSink>,
        config: ServiceConfig,
    ) -> Self {
        let shared = Arc::new(Shared {
            status: Mutex::new(StatusView::disconnected(None)),
            snapshot: Mutex::new(None),
            live_ticks: std::sync::atomic::AtomicU64::new(0),
        });
        let (tx, rx) = unbounded();
        let worker_shared = shared.clone();
        // Load the profiles before returning so `status()` is complete at once.
        let profiles = Profiles::load(config.profiles_path.clone());
        {
            let mut first = StatusView::disconnected(None);
            first.remembered = profiles.latest().cloned();
            *shared.status.lock().expect("status lock") = first;
        }
        let thread = std::thread::Builder::new()
            .name("engine".into())
            .spawn(move || {
                let mut w = Worker::new(factory, sink, config, worker_shared, profiles);
                w.announce();
                loop {
                    let msg = match rx.recv_timeout(w.wait()) {
                        Ok(m) => Some(m),
                        Err(RecvTimeoutError::Timeout) => None,
                        Err(RecvTimeoutError::Disconnected) => break,
                    };
                    let mut msgs: Vec<Msg> = msg.into_iter().collect();
                    msgs.extend(rx.try_iter());
                    let mut stop = false;
                    for m in msgs {
                        match m {
                            Msg::Command(c) => w.command(c),
                            Msg::Devices(reply) => {
                                let _ = reply.send(w.devices());
                            }
                            Msg::Shutdown => stop = true,
                        }
                    }
                    if stop {
                        break;
                    }
                    w.step(Instant::now());
                }
                w.drop_link();
                eprintln!("engine: thread stopped");
            })
            .expect("spawn engine thread");
        Self {
            tx,
            shared,
            thread: Mutex::new(Some(thread)),
        }
    }

    /// The latest status.
    pub fn status(&self) -> StatusView {
        self.shared.status.lock().expect("status lock").clone()
    }

    /// The latest snapshot payload (None until connected, and after a disconnect).
    pub fn snapshot(&self) -> Option<SnapshotPayload> {
        self.shared.snapshot.lock().expect("snapshot lock").clone()
    }

    /// Queues a command for the engine thread.
    pub fn send(&self, command: EngineCommand) -> Result<(), String> {
        self.tx
            .send(Msg::Command(command))
            .map_err(|_| "engine thread is not running".to_string())
    }

    /// Lists the devices the transport can see (blocks up to 10 s).
    pub fn devices(&self) -> Result<Vec<DeviceView>, String> {
        let (reply, rx) = bounded(1);
        self.tx
            .send(Msg::Devices(reply))
            .map_err(|_| "engine thread is not running".to_string())?;
        rx.recv_timeout(Duration::from_secs(10))
            .map_err(|_| "device list timed out".to_string())?
    }

    /// Stops the thread and waits for it (drops the link).
    pub fn shutdown(&self) {
        let _ = self.tx.send(Msg::Shutdown);
        if let Some(t) = self.thread.lock().expect("thread lock").take() {
            let _ = t.join();
        }
    }
}

impl Drop for EngineService {
    fn drop(&mut self) {
        self.shutdown();
    }
}

#[derive(Clone, Debug)]
struct Target {
    address: String,
    name: String,
}

/// Reconnecting by itself after a drop that followed a setting change.
struct Recovery {
    target: Target,
    until: Instant,
}

struct Live {
    engine: Engine,
    target: Target,
    ready: bool,
    since: Instant,
    /// Frames libmdr could not parse and the service skipped on this link.
    malformed_skips: u64,
}

enum Phase {
    /// Disconnected or Discovering (the published status tells which).
    Idle,
    Connecting {
        target: Target,
        uuid_index: usize,
        deadline: Instant,
    },
    Live(Box<Live>),
}

struct Worker {
    factory: TransportFactory,
    sink: Arc<dyn SnapshotSink>,
    cfg: ServiceConfig,
    shared: Arc<Shared>,
    phase: Phase,
    /// The transport used for discovery and connecting (moves into the engine).
    idle: Option<Box<dyn Transport>>,
    /// The `autoConnect` setting.
    auto_connect: bool,
    /// `disconnect` pauses auto-connect until `reconnect` / `connect`.
    suspended: bool,
    profiles: Profiles,
    next_scan: Instant,
    status: StatusView,
    pending: VecDeque<EngineCommand>,
    pending_sync: bool,
    pending_alert: Option<AlertAction>,
    /// A user command was staged; the next possible `commit` sends it. The
    /// only path that writes settings to the device.
    commit_owed: bool,
    /// Logged once per link when libmdr reports staged state no command owns.
    stale_logged: bool,
    last_ambient: u8,
    /// The last snapshot summary logged (to skip identical lines).
    last_log: String,
    /// A connection-quality change waiting for the user's answer.
    confirmation: Option<AudioPriority>,
    /// Publish the snapshot on the next live tick (a declined change must undo
    /// the renderer's optimistic one).
    republish: bool,
    /// When the last command that may restart the headset's links was applied.
    setting_change_at: Option<Instant>,
    recovery: Option<Recovery>,
}

impl Worker {
    fn new(
        factory: TransportFactory,
        sink: Arc<dyn SnapshotSink>,
        cfg: ServiceConfig,
        shared: Arc<Shared>,
        profiles: Profiles,
    ) -> Self {
        let auto_connect = cfg.auto_connect;
        let status = shared.status.lock().expect("status lock").clone();
        Self {
            factory,
            sink,
            cfg,
            shared,
            phase: Phase::Idle,
            idle: None,
            auto_connect,
            suspended: false,
            profiles,
            next_scan: Instant::now(),
            status,
            pending: VecDeque::new(),
            pending_sync: false,
            pending_alert: None,
            commit_owed: false,
            stale_logged: false,
            last_ambient: DEFAULT_AMBIENT_LEVEL,
            last_log: String::new(),
            confirmation: None,
            republish: false,
            setting_change_at: None,
            recovery: None,
        }
    }

    /// How long to wait for a message before the next step.
    fn wait(&self) -> Duration {
        match self.phase {
            Phase::Idle => self
                .next_scan
                .saturating_duration_since(Instant::now())
                .clamp(
                    self.cfg.tick,
                    self.cfg.discovery_interval.max(self.cfg.tick),
                ),
            _ => self.cfg.tick,
        }
    }

    /// Publishes the launch status (Disconnected plus the remembered profile).
    fn announce(&mut self) {
        let status = self.status.clone();
        eprintln!(
            "engine: idle at launch autoConnect={} remembered={}",
            self.auto_connect,
            status
                .remembered
                .as_ref()
                .map(|p| p.address.as_str())
                .unwrap_or("-")
        );
        self.sink.status(&status);
    }

    /// The profile `engine:status` reports for `address` (see [`StatusView`]).
    fn remembered_for(&self, address: Option<&str>) -> Option<DeviceProfile> {
        match address {
            Some(a) => self.profiles.get(a).cloned(),
            None => self.profiles.latest().cloned(),
        }
    }

    /// Re-publishes the current status (the remembered profile changed).
    fn refresh_status(&mut self) {
        let status = self.status.clone();
        self.set_status(status);
    }

    fn set_status(&mut self, mut status: StatusView) {
        status.remembered = self.remembered_for(status.address.as_deref());
        if status == self.status {
            return;
        }
        eprintln!(
            "engine: status {:?} device={} address={} protocol={} lastError={} reason={:?}",
            status.state,
            status.device_name.as_deref().unwrap_or("-"),
            status.address.as_deref().unwrap_or("-"),
            status
                .protocol
                .map(|p| format!("{p:?}"))
                .unwrap_or_else(|| "-".into()),
            status.last_error.as_deref().unwrap_or("-"),
            status.reason,
        );
        self.status = status.clone();
        *self.shared.status.lock().expect("status lock") = status.clone();
        self.sink.status(&status);
    }

    fn status_for(
        &self,
        state: ConnState,
        target: &Target,
        protocol: Option<Protocol>,
    ) -> StatusView {
        StatusView {
            state,
            device_name: Some(target.name.clone()),
            address: Some(target.address.clone()),
            protocol,
            last_error: None,
            reason: self
                .recovery
                .as_ref()
                .map(|_| FailureReason::ReconnectingAfterSettingChange),
            remembered: None,
        }
    }

    fn transport(&mut self) -> Result<&mut Box<dyn Transport>, String> {
        if self.idle.is_none() {
            let t = (self.factory)().map_err(|e| format!("transport unavailable: {e}"))?;
            self.idle = Some(t);
        }
        Ok(self.idle.as_mut().expect("just set"))
    }

    // ---- commands ---------------------------------------------------------

    fn command(&mut self, cmd: EngineCommand) {
        if cmd.is_service_command() {
            let now = Instant::now();
            let changes_link = match &cmd {
                EngineCommand::Scan
                | EngineCommand::SetAutoConnect { .. }
                | EngineCommand::OpenBluetoothSettings => false,
                // Forgetting another device leaves this link (and its recovery) alone.
                EngineCommand::ForgetDevice { address } => self
                    .status
                    .address
                    .as_deref()
                    .is_some_and(|a| a.eq_ignore_ascii_case(address)),
                _ => true,
            };
            if changes_link && self.recovery.take().is_some() {
                eprintln!("engine: reconnect after setting change cancelled by {cmd:?}");
            }
            match cmd {
                EngineCommand::Disconnect => {
                    self.suspended = true;
                    self.drop_link();
                    self.set_status(StatusView::disconnected(None));
                }
                EngineCommand::Reconnect => {
                    self.suspended = false;
                    self.drop_link();
                    match self.profiles.latest().cloned() {
                        Some(p) => self.connect_to(p.address, now),
                        None => self.scan(now),
                    }
                }
                EngineCommand::Connect { address } => {
                    self.suspended = false;
                    self.drop_link();
                    self.connect_to(address, now);
                }
                EngineCommand::Scan => {
                    let view = self.scan_view();
                    eprintln!("engine: scan found {} device(s)", view.devices.len());
                    self.sink.devices(&view);
                }
                EngineCommand::ForgetDevice { address } => {
                    let current = self.status.address.clone();
                    let removed = self.profiles.forget(&address);
                    eprintln!("engine: forget {address} removed={removed}");
                    if current
                        .as_deref()
                        .is_some_and(|a| a.eq_ignore_ascii_case(&address))
                    {
                        self.suspended = true;
                        self.drop_link();
                        self.set_status(StatusView::disconnected(None));
                    } else {
                        self.refresh_status();
                    }
                }
                EngineCommand::SetAutoConnect { enabled } => {
                    eprintln!("engine: autoConnect={enabled}");
                    self.auto_connect = enabled;
                    if enabled {
                        self.suspended = false;
                        self.next_scan = now;
                    } else if self.status.state == ConnState::Discovering {
                        let last_error = self.status.last_error.clone();
                        self.set_status(StatusView::disconnected(last_error));
                    }
                }
                EngineCommand::OpenBluetoothSettings => {
                    // The Tauri command layer opens the settings page.
                }
                _ => unreachable!("service commands only"),
            }
            return;
        }
        let Phase::Live(live) = &self.phase else {
            return eprintln!("engine: ignored {cmd:?}: not connected");
        };
        match cmd {
            EngineCommand::RespondToAlert { positive } if self.confirmation.is_some() => {
                let audio_priority = self.confirmation.take().expect("checked");
                eprintln!("engine: connection-mode change {audio_priority:?} confirmed={positive}");
                if positive {
                    self.pending
                        .push_back(EngineCommand::SetConnectionMode { audio_priority });
                } else {
                    self.republish = true;
                }
            }
            EngineCommand::SetConnectionMode { audio_priority }
                if live.engine.connection_mode().map(|c| c.audio_priority).ok()
                    != Some(audio_priority) =>
            {
                eprintln!("engine: connection-mode change {audio_priority:?} awaits confirmation");
                self.confirmation = Some(audio_priority);
                self.sink.alert(&AlertView {
                    message: CONFIRM_CONNECTION_MODE_ALERT.into(),
                    auto_response: None,
                    requires_choice: true,
                });
            }
            cmd => {
                // Re-picking the current mode withdraws an unanswered
                // confirmation, so a later "OK" cannot apply the older choice.
                if matches!(cmd, EngineCommand::SetConnectionMode { .. })
                    && self.confirmation.take().is_some()
                {
                    eprintln!("engine: connection-mode confirmation withdrawn by {cmd:?}");
                }
                self.pending.push_back(cmd)
            }
        }
    }

    /// Connects to `address` now (a user's `connect`, or `reconnect`).
    fn connect_to(&mut self, address: String, now: Instant) {
        let name = self
            .profiles
            .get(&address)
            .map(|p| p.name.clone())
            .unwrap_or_else(|| address.clone());
        self.begin_connect(Target { address, name }, now);
    }

    /// `engine:devices` for a `scan`: what Windows lists as connected, each
    /// flagged when a profile exists.
    fn scan_view(&mut self) -> DevicesView {
        let devices = match self.devices() {
            Ok(d) => d,
            Err(e) => {
                eprintln!("engine: scan failed: {e}");
                Vec::new()
            }
        };
        DevicesView {
            devices: devices
                .into_iter()
                .map(|d| ScannedDevice {
                    remembered: self.profiles.contains(&d.address),
                    address: d.address,
                    name: d.name,
                })
                .collect(),
        }
    }

    fn devices(&mut self) -> Result<Vec<DeviceView>, String> {
        let list = match self.idle.as_mut() {
            Some(t) => t.devices(),
            // Connected: the live transport is inside the engine; listing does not
            // touch a socket, so a fresh transport answers just as well.
            None => (self.factory)().and_then(|mut t| t.devices()),
        }
        .map_err(|e| e.to_string())?;
        Ok(list
            .into_iter()
            .map(|d| DeviceView {
                address: d.mac,
                name: d.name,
            })
            .collect())
    }

    /// Drops the engine and any connection in progress; clears per-link state.
    fn drop_link(&mut self) {
        match std::mem::replace(&mut self.phase, Phase::Idle) {
            Phase::Live(live) => drop(live), // Engine drop destroys the handle, then the transport.
            Phase::Connecting { .. } => {
                if let Some(t) = self.idle.as_mut() {
                    t.disconnect();
                }
            }
            Phase::Idle => {}
        }
        self.pending.clear();
        self.pending_sync = false;
        self.pending_alert = None;
        self.confirmation = None;
        self.republish = false;
        self.setting_change_at = None;
        self.commit_owed = false;
        self.stale_logged = false;
        *self.shared.snapshot.lock().expect("snapshot lock") = None;
    }

    /// The link failed: back to Disconnected with the error and its reason;
    /// auto-connect (if on) retries after `retry_backoff`. While a recovery
    /// window is open it stays `connecting` and retries after `recovery_retry`.
    fn lost(&mut self, error: String, reason: Option<FailureReason>, now: Instant) {
        eprintln!("engine: link lost: {error} ({reason:?})");
        self.drop_link();
        if let Some(r) = &self.recovery {
            if now < r.until {
                let (target, until) = (r.target.clone(), r.until);
                let status = self.status_for(ConnState::Connecting, &target, None);
                self.set_status(status);
                self.next_scan = (now + self.cfg.recovery_retry).min(until);
                return;
            }
            eprintln!("engine: no reconnect within the recovery window");
            self.recovery = None;
        }
        self.set_status(StatusView {
            reason,
            ..StatusView::disconnected(Some(error))
        });
        self.next_scan = now + self.cfg.retry_backoff;
    }

    // ---- state machine ------------------------------------------------------

    fn step(&mut self, now: Instant) {
        match std::mem::replace(&mut self.phase, Phase::Idle) {
            Phase::Idle if self.recovery.is_some() => {
                let (target, until) = {
                    let r = self.recovery.as_ref().expect("checked");
                    (r.target.clone(), r.until)
                };
                if now >= until {
                    self.recovery = None;
                    let error =
                        format!("{} did not reconnect after the setting change", target.name);
                    self.lost(error, Some(FailureReason::Timeout), now);
                } else if now >= self.next_scan {
                    eprintln!(
                        "engine: reconnecting {} after a setting change",
                        target.address
                    );
                    self.begin_connect(target, now);
                }
            }
            Phase::Idle => {
                if self.auto_connect && !self.suspended && now >= self.next_scan {
                    self.next_scan = now + self.cfg.discovery_interval;
                    self.scan(now);
                }
            }
            Phase::Connecting {
                target,
                uuid_index,
                deadline,
            } => self.step_connecting(target, uuid_index, deadline, now),
            Phase::Live(mut live) => {
                self.shared
                    .live_ticks
                    .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                match self.step_live(&mut live, now) {
                    Ok(()) => self.phase = Phase::Live(live),
                    Err(error) => {
                        // After Ready a drop is just "disconnected" (headphones off,
                        // out of range); before it, the device refused or stalled.
                        let reason = match (live.ready, error.as_str()) {
                            (true, _) => None,
                            (false, INIT_TIMEOUT) => Some(FailureReason::Timeout),
                            (false, _) => Some(FailureReason::Refused),
                        };
                        let after_change = self
                            .setting_change_at
                            .is_some_and(|t| now.duration_since(t) <= RECOVERY_TRIGGER);
                        if live.ready && after_change && self.recovery.is_none() {
                            eprintln!(
                                "engine: link lost right after a setting change; reconnecting for {:?}",
                                self.cfg.recovery_window
                            );
                            self.recovery = Some(Recovery {
                                target: live.target.clone(),
                                until: now + self.cfg.recovery_window,
                            });
                        }
                        drop(live);
                        self.lost(error, reason, now);
                    }
                }
            }
        }
    }

    /// One discovery pass: pick the most recently remembered device Windows
    /// lists as connected, else the first Sony-looking name, and connect.
    /// With auto-connect off (a `reconnect` without a profile), finding
    /// nothing ends in Disconnected(notConnectedToWindows) instead of waiting.
    fn scan(&mut self, now: Instant) {
        if self.status.state != ConnState::Discovering {
            let last_error = self.status.last_error.clone();
            self.set_status(StatusView {
                state: ConnState::Discovering,
                ..StatusView::disconnected(last_error)
            });
        }
        let devices = match self
            .transport()
            .and_then(|t| t.devices().map_err(|e| e.to_string()))
        {
            Ok(d) => d,
            Err(e) => {
                eprintln!("engine: device list failed: {e}");
                Vec::new()
            }
        };
        let pick = devices
            .iter()
            .filter(|d| self.profiles.contains(&d.mac))
            .max_by_key(|d| self.profiles.get(&d.mac).map(|p| p.last_seen))
            .or_else(|| {
                devices
                    .iter()
                    .find(|d| NAME_PREFIXES.iter().any(|p| d.name.starts_with(p)))
            });
        match pick {
            Some(d) => {
                eprintln!("engine: discovered {} {}", d.mac, d.name);
                let target = Target {
                    address: d.mac.clone(),
                    name: d.name.clone(),
                };
                self.begin_connect(target, now);
            }
            None if !self.auto_connect => self.set_status(StatusView {
                reason: Some(FailureReason::NotConnectedToWindows),
                ..StatusView::disconnected(Some("no headphones are connected to Windows".into()))
            }),
            None => {}
        }
    }

    /// Starts connecting, unless Windows does not list `target` as connected
    /// (then fails at once with `notConnectedToWindows`, without a socket).
    /// The target takes the name Windows lists for its address (a `connect`
    /// to an address with no profile otherwise carries only the address).
    fn begin_connect(&mut self, mut target: Target, now: Instant) {
        let listed = match self
            .transport()
            .and_then(|t| t.devices().map_err(|e| e.to_string()))
        {
            Ok(list) => match list
                .iter()
                .find(|d| d.mac.eq_ignore_ascii_case(&target.address))
            {
                Some(d) => {
                    if !d.name.trim().is_empty() {
                        target.name = d.name.clone();
                    }
                    true
                }
                None => false,
            },
            Err(e) => {
                eprintln!("engine: device list failed before connecting: {e}");
                true
            }
        };
        if !listed {
            let error = format!("{} is not connected to Windows", target.name);
            return self.lost(error, Some(FailureReason::NotConnectedToWindows), now);
        }
        self.try_attempt(target, 0, None, now);
    }

    /// `TryConnectionAttempt`: start the attempt at `index`, skipping UUIDs whose
    /// connect fails synchronously. All exhausted -> Disconnected.
    ///
    /// `last` is the previous attempt's error and whether it was a timeout.
    /// When every UUID failed, a timeout gives `timeout`; any other failure
    /// gives `busy`, because the device was listed as connected (checked in
    /// [`Self::begin_connect`]) yet its control channel would not open.
    fn try_attempt(
        &mut self,
        target: Target,
        mut index: usize,
        mut last: Option<(String, bool)>,
        now: Instant,
    ) {
        while index < SERVICE_ORDER.len() {
            let protocol = SERVICE_ORDER[index];
            let uuid = protocol.service_uuid();
            eprintln!(
                "engine: connecting {} uuid={uuid} ({protocol:?})",
                target.address
            );
            let t = match self.transport() {
                Ok(t) => t,
                Err(e) => return self.lost(e, None, now),
            };
            match t.connect(&target.address, uuid) {
                Ok(ConnectStatus::Connected) | Ok(ConnectStatus::InProgress) => {
                    let status = self.status_for(ConnState::Connecting, &target, Some(protocol));
                    self.set_status(status);
                    self.phase = Phase::Connecting {
                        target,
                        uuid_index: index,
                        deadline: now + self.cfg.attempt_timeout,
                    };
                    return;
                }
                Err(e) => {
                    eprintln!("engine: connect {uuid} failed: {e}");
                    last = Some((e.to_string(), false));
                    t.disconnect();
                    index += 1;
                }
            }
        }
        let (detail, timed_out) = last.unwrap_or_else(|| ("no service answered".into(), false));
        let reason = if timed_out {
            FailureReason::Timeout
        } else {
            FailureReason::Busy
        };
        let error = format!("could not connect to {} ({detail})", target.address);
        self.lost(error, Some(reason), now);
    }

    fn step_connecting(&mut self, target: Target, index: usize, deadline: Instant, now: Instant) {
        let polled = match self.transport() {
            Ok(t) => t.poll(0),
            Err(e) => return self.lost(e, None, now),
        };
        let failure = match polled {
            Ok(PollStatus::Ready) => return self.connected(target, SERVICE_ORDER[index], now),
            Ok(PollStatus::InProgress) | Ok(PollStatus::TimedOut) if now < deadline => {
                self.phase = Phase::Connecting {
                    target,
                    uuid_index: index,
                    deadline,
                };
                return;
            }
            Ok(_) => ("timed out".to_string(), true),
            Err(e) => (e.to_string(), false),
        };
        // `AdvanceConnectionAttempt`
        eprintln!(
            "engine: attempt {} failed: {}",
            SERVICE_ORDER[index].service_uuid(),
            failure.0
        );
        if let Some(t) = self.idle.as_mut() {
            t.disconnect();
        }
        self.try_attempt(target, index + 1, Some(failure), now);
    }

    fn connected(&mut self, target: Target, protocol: Protocol, now: Instant) {
        let transport = self.idle.take().expect("connecting owns a transport");
        let packet_log = self.cfg.packet_log;
        let engine = Engine::create(transport, protocol).and_then(|mut e| {
            if packet_log {
                e.set_packet_callback(Some(Box::new(|dir, frame| {
                    eprintln!("packet: {}", mdr::packet::describe_frame(dir, frame));
                })));
            }
            e.request_init()?;
            Ok(e)
        });
        match engine {
            Ok(engine) => {
                eprintln!(
                    "engine: connected {} ({protocol:?}), initialising",
                    target.address
                );
                let status = self.status_for(ConnState::Initialising, &target, Some(protocol));
                self.set_status(status);
                self.phase = Phase::Live(Box::new(Live {
                    engine,
                    target,
                    ready: false,
                    since: now,
                    malformed_skips: 0,
                }));
            }
            Err(e) => self.lost(
                format!("engine start failed: {e}"),
                Some(FailureReason::Refused),
                now,
            ),
        }
    }

    fn step_live(&mut self, live: &mut Live, now: Instant) -> Result<(), String> {
        let mut publish = false;
        let mut full_log = false;
        if std::mem::take(&mut self.republish) {
            publish = true;
        }
        for _ in 0..MAX_EVENTS_PER_TICK {
            let ev = match live.engine.poll() {
                Ok(ev) => ev,
                // libmdr already ACKed and consumed the frame and changed no
                // state; the link is fine (see `Error::is_malformed_payload`).
                Err(e) if e.is_malformed_payload() => {
                    live.malformed_skips += 1;
                    let n = live.malformed_skips;
                    // Logged sparsely: a device that keeps sending such frames
                    // must not flood stderr (at most 32 per tick otherwise).
                    if n <= 3 || n.is_multiple_of(100) {
                        eprintln!("engine: skipped a frame libmdr could not parse (#{n} on this link): {e}");
                    }
                    continue;
                }
                Err(e) => return Err(e.to_string()),
            };
            match ev {
                Event::None => break,
                Event::InitializeComplete => {
                    live.engine.request_sync().map_err(|e| e.to_string())?;
                }
                Event::SyncComplete => {
                    if !live.ready {
                        live.ready = true;
                        full_log = true;
                        if self.recovery.take().is_some() {
                            eprintln!("engine: reconnected after the setting change");
                        }
                        self.learn_profile(live);
                        let status = self.status_for(
                            ConnState::Ready,
                            &live.target,
                            Some(live.engine.protocol()),
                        );
                        self.set_status(status);
                    }
                    publish = true;
                }
                Event::NeedSync => self.pending_sync = true,
                Event::Alert => {
                    let message = live.engine.last_alert().unwrap_or_default();
                    let auto = (message == AUTO_DECLINED_ALERT).then_some(AlertAction::Negative);
                    eprintln!("engine: alert {message} auto={auto:?}");
                    if auto.is_some() {
                        self.pending_alert = auto;
                    } else if self.confirmation.take().is_some() {
                        // The device's question replaces the banner, so the
                        // next answer is the device's: drop our own question
                        // and republish so the renderer reverts its choice.
                        eprintln!(
                            "engine: connection-mode confirmation replaced by a device alert"
                        );
                        self.republish = true;
                    }
                    self.sink.alert(&AlertView {
                        message,
                        auto_response: auto,
                        requires_choice: auto.is_none(),
                    });
                    publish = true;
                }
                Event::Unhandled(_) => {}
                _ => publish = true,
            }
        }
        if publish && live.ready {
            self.refresh_profile(live);
        }
        if publish {
            self.publish(&live.engine, full_log);
        }

        if !live.ready && now.duration_since(live.since) > self.cfg.init_timeout {
            return Err(INIT_TIMEOUT.into());
        }
        if self.pending_sync && live.engine.is_ready() {
            match live.engine.request_sync() {
                Ok(()) => self.pending_sync = false,
                Err(e) if e.is_in_progress() => {}
                Err(e) => return Err(e.to_string()),
            }
        }
        if let Some(action) = self.pending_alert {
            if live.engine.is_ready() {
                match live.engine.respond_to_alert(action) {
                    Ok(()) => self.pending_alert = None,
                    Err(e) if e.is_in_progress() => {}
                    Err(e) => {
                        eprintln!("engine: alert response failed: {e}");
                        self.pending_alert = None;
                    }
                }
            }
        }
        if live.ready {
            self.apply_pending(&mut live.engine);
        }
        self.commit_if_owed(&mut live.engine);
        Ok(())
    }

    /// Commits only what a user command staged. libmdr's `commit` also
    /// resynchronises every property's staging revision, so a command that
    /// staged an unchanged value (re-clicking the current mode) is committed
    /// too: it sends nothing, and afterwards a device notification (say, the
    /// phone app switching to ambient) updates both libmdr's current and
    /// desired values instead of leaving our stale desired value "dirty" to be
    /// written back. Without an owed commit nothing is written, ever.
    fn commit_if_owed(&mut self, engine: &mut Engine) {
        if !self.commit_owed {
            if engine.is_dirty() && !self.stale_logged {
                eprintln!("engine: staged state differs from the device without a command; not writing it");
                self.stale_logged = true;
            }
            return;
        }
        if !engine.is_ready() {
            return;
        }
        match engine.commit() {
            Ok(()) => {
                eprintln!("engine: commit requested");
                self.commit_owed = false;
            }
            Err(e) if e.is_in_progress() => {}
            Err(e) => {
                eprintln!("engine: commit failed: {e}");
                self.commit_owed = false;
            }
        }
    }

    /// After Ready: re-records the profile when the device now reports a
    /// model name or firmware the stored profile lacks (texts can arrive with
    /// a later identity or sync event than the one that made it Ready).
    fn refresh_profile(&mut self, live: &Live) {
        let model = live.engine.model_name().unwrap_or_default();
        let firmware = live.engine.firmware_version().unwrap_or_default();
        let stale = match self.profiles.get(&live.target.address) {
            Some(p) => {
                (!model.is_empty() && p.model_name != model)
                    || (!firmware.is_empty() && p.firmware != firmware)
            }
            None => true,
        };
        if stale {
            self.learn_profile(live);
            self.refresh_status();
        }
    }

    /// Records (or refreshes) the device's profile at Ready.
    fn learn_profile(&mut self, live: &Live) {
        let profile = DeviceProfile {
            address: live.target.address.clone(),
            name: live.target.name.clone(),
            model_name: live.engine.model_name().unwrap_or_default(),
            firmware: live.engine.firmware_version().unwrap_or_default(),
            protocol: live.engine.protocol(),
            last_seen: now_ms(),
        };
        eprintln!(
            "engine: remembered {} {} fw={}",
            profile.address, profile.model_name, profile.firmware
        );
        self.profiles.remember(profile);
    }

    fn apply_pending(&mut self, engine: &mut Engine) {
        while let Some(cmd) = self.pending.front().cloned() {
            if !engine.is_ready() {
                return;
            }
            match self.apply(engine, &cmd) {
                Ok(()) => {
                    eprintln!("engine: applied {cmd:?}");
                    self.pending.pop_front();
                    self.commit_owed = true;
                    if matches!(
                        cmd,
                        EngineCommand::SetConnectionMode { .. }
                            | EngineCommand::SetSpeakToChat { .. }
                            | EngineCommand::SetDsee { .. }
                    ) {
                        self.setting_change_at = Some(Instant::now());
                    }
                }
                Err(e) if e.is_in_progress() => return,
                Err(e) => {
                    eprintln!("engine: {cmd:?} rejected: {e}");
                    self.pending.pop_front();
                }
            }
        }
    }

    fn apply(&mut self, engine: &mut Engine, cmd: &EngineCommand) -> mdr::Result<()> {
        let fallback = self.last_ambient;
        let noise = |engine: &mut Engine,
                     mode: Option<NoiseViewMode>,
                     level: Option<u8>,
                     focus: Option<bool>|
         -> mdr::Result<()> {
            let protocol = engine.protocol();
            let current = engine.noise_control()?;
            let mode = match mode {
                Some(m) => m,
                None => noise_view(protocol, &current, &engine.features(), fallback).mode,
            };
            let raw = noise_request(protocol, &current, mode, level, focus, fallback)
                .map_err(mdr::Error::InvalidArgument)?;
            engine.set_noise_control(&raw)
        };
        match cmd {
            EngineCommand::SetNoise {
                mode,
                ambient_level,
                focus_on_voice,
            } => noise(engine, Some(*mode), *ambient_level, *focus_on_voice),
            EngineCommand::SetAmbientLevel { level } => {
                if !(AMBIENT_MIN..=AMBIENT_MAX).contains(level) {
                    return Err(mdr::Error::InvalidArgument(format!(
                        "ambient level {level} outside {AMBIENT_MIN}..={AMBIENT_MAX}"
                    )));
                }
                noise(engine, Some(NoiseViewMode::Ambient), Some(*level), None)
            }
            EngineCommand::SetFocusOnVoice { enabled } => noise(engine, None, None, Some(*enabled)),
            EngineCommand::SetEqualizerPreset { preset } => {
                let mut eq = engine.equalizer()?;
                eq.preset = *preset;
                engine.set_equalizer(&eq)
            }
            EngineCommand::SetEqualizerBands { bands } => engine.set_equalizer_bands(bands),
            EngineCommand::SetClearBass { level } => {
                let mut eq = engine.equalizer()?;
                eq.clear_bass = *level;
                engine.set_equalizer(&eq)
            }
            EngineCommand::SetDsee { enabled } => {
                let mut eq = engine.equalizer()?;
                eq.dsee_enabled = *enabled;
                engine.set_equalizer(&eq)
            }
            EngineCommand::Playback { action } => engine.playback(*action),
            EngineCommand::SetVolume { volume } => {
                let mut p = engine.playback_state()?;
                p.volume = *volume;
                engine.set_playback(&p)
            }
            EngineCommand::SetPower {
                auto_power_off_minutes,
                wearing_power,
                auto_pause,
                head_gesture,
            } => {
                let mut p = engine.power()?;
                if let Some(v) = auto_power_off_minutes {
                    p.auto_power_off_minutes = *v;
                }
                if let Some(v) = wearing_power {
                    p.wearing_power = *v;
                }
                if let Some(v) = auto_pause {
                    p.auto_pause = *v;
                }
                if let Some(v) = head_gesture {
                    p.head_gesture = *v;
                }
                p.shutdown_requested = false;
                engine.set_power(&p)
            }
            EngineCommand::SetVoiceGuidance { enabled, volume } => {
                let mut v = engine.voice_guidance()?;
                v.enabled = *enabled;
                if let Some(vol) = volume {
                    v.volume = *vol;
                }
                engine.set_voice_guidance(&v)
            }
            EngineCommand::SetGeneralSetting { index, value } => {
                engine.set_general_setting(*index, *value)
            }
            EngineCommand::SetAssignableControls { controls } => {
                engine.set_assignable_controls(controls)
            }
            EngineCommand::PowerOff => {
                let mut p = engine.power()?;
                p.shutdown_requested = true;
                engine.set_power(&p)
            }
            EngineCommand::RespondToAlert { positive } => {
                self.pending_alert = None;
                engine.respond_to_alert(if *positive {
                    AlertAction::Positive
                } else {
                    AlertAction::Negative
                })
            }
            EngineCommand::SetSpeakToChat {
                enabled,
                sensitivity,
                timeout,
            } => engine.set_speak_to_chat(&SpeakToChat {
                enabled: *enabled,
                sensitivity: *sensitivity,
                timeout: *timeout,
            }),
            EngineCommand::SetConnectionMode { audio_priority } => {
                engine.set_connection_mode(&ConnectionMode {
                    audio_priority: *audio_priority,
                })
            }
            EngineCommand::SetPairedDevice { command, device_id } => {
                engine.set_paired_device(*command, device_id)
            }
            EngineCommand::SetPairing { enabled } => engine.set_pairing(*enabled),
            EngineCommand::SetAutoPause { enabled } => {
                let mut p = engine.power()?;
                p.auto_pause = *enabled;
                p.shutdown_requested = false;
                engine.set_power(&p)
            }
            EngineCommand::SetMultipoint { enabled } => {
                let index = engine
                    .general_settings()?
                    .into_iter()
                    .find(|g| g.subject == MULTIPOINT_SUBJECT)
                    .map(|g| g.index)
                    .ok_or_else(|| {
                        mdr::Error::InvalidArgument(format!(
                            "no {MULTIPOINT_SUBJECT} general setting on this device"
                        ))
                    })?;
                engine.set_general_setting(index, *enabled)
            }
            EngineCommand::Disconnect
            | EngineCommand::Reconnect
            | EngineCommand::Connect { .. }
            | EngineCommand::Scan
            | EngineCommand::ForgetDevice { .. }
            | EngineCommand::SetAutoConnect { .. }
            | EngineCommand::OpenBluetoothSettings => {
                unreachable!("service commands are handled in `command`")
            }
        }
    }

    fn publish(&mut self, engine: &Engine, full_log: bool) {
        let snapshot = engine.snapshot();
        let view = snapshot
            .noise_control
            .as_ref()
            .map(|nc| noise_view(snapshot.protocol, nc, &snapshot.features, self.last_ambient));
        if let Some(v) = view.filter(|v| v.mode == NoiseViewMode::Ambient) {
            self.last_ambient = v.ambient_level;
        }
        let payload = SnapshotPayload {
            snapshot,
            noise_view: view,
        };
        log_snapshot(&payload, full_log, &mut self.last_log);
        if let Some(path) = &self.cfg.dump_path {
            dump(path, &payload);
        }
        *self.shared.snapshot.lock().expect("snapshot lock") = Some(payload.clone());
        self.sink.snapshot(&payload);
    }
}

/// Logs one summary line per publish; repeats of the previous line are skipped
/// unless `full` (the Ready snapshot, which also lists the available features).
fn log_snapshot(p: &SnapshotPayload, full: bool, last_line: &mut String) {
    let s = &p.snapshot;
    let batteries = s
        .batteries
        .as_ref()
        .map(|b| {
            b.iter()
                .map(|b| {
                    format!(
                        "{:?}={}%{}",
                        b.part,
                        b.level_percent,
                        if b.charging == mdr::ChargingState::Yes {
                            "+"
                        } else {
                            ""
                        }
                    )
                })
                .collect::<Vec<_>>()
                .join(",")
        })
        .unwrap_or_else(|| "-".into());
    let noise = p
        .noise_view
        .map(|v| format!("{:?}/{}", v.mode, v.ambient_level))
        .unwrap_or_else(|| "-".into());
    let line = format!(
        "engine: snapshot model={} firmware={} protocol={:?} protocolVersion={} battery={} noise={} ready={}",
        s.texts.model_name.as_deref().unwrap_or("-"),
        s.texts.firmware_version.as_deref().unwrap_or("-"),
        s.protocol,
        s.model
            .map(|m| format!("0x{:x}", m.protocol_version))
            .unwrap_or_else(|| "-".into()),
        batteries,
        noise,
        s.ready,
    );
    if !full && line == *last_line {
        return;
    }
    last_line.clone_from(&line);
    if full {
        let features: Vec<&str> = s
            .features
            .iter()
            .filter(|(_, a)| **a == mdr::Availability::Available)
            .map(|(k, _)| k.as_str())
            .collect();
        eprintln!("{line} features=[{}]", features.join(","));
    } else {
        eprintln!("{line}");
    }
}

fn dump(path: &std::path::Path, payload: &SnapshotPayload) {
    let result = (|| -> std::io::Result<()> {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir)?;
        }
        let json = serde_json::to_string_pretty(payload).map_err(std::io::Error::other)?;
        std::fs::write(path, json + "\n")
    })();
    if let Err(e) = result {
        eprintln!("engine: snapshot dump to {} failed: {e}", path.display());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mdr::{DeviceInfo, ReplayTransport};
    use std::path::Path;

    const XM3_ADDRESS: &str = "00:00:00:00:00:03";

    fn xm3_dir() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../upstream/SonyHeadphonesClient/tests/WH-1000XM3-4.5.2")
    }

    /// RX frames the upstream client recorded from the maintainer's WH-1000XM4 (fw 2.9.0,
    /// `--record`, nightly 5c23c9c) from connect to idle, before any change.
    fn xm4_dir() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("fixtures/WH-1000XM4-2.9.0")
    }

    /// A V2 capture that completes init and sync (the XM5 one stops mid-init).
    fn linkbuds_dir() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../upstream/SonyHeadphonesClient/tests/WF-LC900-2.0.3-equalizer")
    }

    /// Live XM4 NCASM frames: our TX and the device's NTFY reply, plus the
    /// upstream client's TX for the same transitions.
    fn noise_dir() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("fixtures/xm4-noise-control")
    }

    fn fixture(name: &str) -> Vec<u8> {
        std::fs::read(noise_dir().join(name)).unwrap_or_else(|e| panic!("{name}: {e}"))
    }

    fn payload(frame: &[u8]) -> Vec<u8> {
        mdr::packet::decode_frame(frame).expect("frame").payload
    }

    /// Splits a TX byte stream into its frames.
    fn frames(bytes: &[u8]) -> Vec<Vec<u8>> {
        let mut out = Vec::new();
        let mut cur = Vec::new();
        for &b in bytes {
            if b == 0x3E {
                cur.clear();
            }
            cur.push(b);
            if b == 0x3C {
                out.push(std::mem::take(&mut cur));
            }
        }
        out
    }

    /// A replayed device that Windows "lists" as connected. It accepts only its
    /// own protocol's service UUID (the real XM4 refuses the XM5 one with
    /// SO_ERROR=10049), records TX, and once `armed` answers like the live
    /// device: an ACK for every DATA frame, then the recorded reply for that
    /// payload, if any.
    struct ListedReplay {
        inner: ReplayTransport,
        protocol: Protocol,
        name: String,
        tx: Arc<Mutex<Vec<u8>>>,
        armed: Arc<std::sync::atomic::AtomicBool>,
        /// Set once every recorded RX byte has been handed to libmdr.
        drained: Arc<std::sync::atomic::AtomicBool>,
        replies: Vec<(Vec<u8>, Vec<u8>)>,
        /// Bytes the device sends next: replies, and frames a test injects
        /// (a notification caused by another controller).
        queued: Arc<Mutex<VecDeque<u8>>>,
        /// Fails every connect like a channel another controller holds.
        busy: bool,
        /// Windows lists the headset as connected.
        listed: bool,
        /// Every address `connect` was called with.
        connects: Arc<Mutex<Vec<String>>>,
        /// After replying to this payload the device closes the link, like the
        /// live XM4 after `AUDIO_SET_PARAM` connection mode.
        close_after: Option<Vec<u8>>,
        /// This link was closed by the device: `recv` fails once the queue drains.
        closed: bool,
        /// Refuse every connect from now on (the headset is not back yet).
        refuse: Arc<std::sync::atomic::AtomicBool>,
    }

    impl Transport for ListedReplay {
        fn connect(&mut self, mac: &str, uuid: &str) -> mdr::Result<ConnectStatus> {
            self.connects.lock().unwrap().push(mac.to_string());
            if self.busy || self.refuse.load(std::sync::atomic::Ordering::SeqCst) {
                return Err(mdr::Error::Transport("SO_ERROR=10061 (simulated)".into()));
            }
            if uuid != self.protocol.service_uuid() {
                return Err(mdr::Error::Transport("SO_ERROR=10049 (simulated)".into()));
            }
            // A new link replays the capture from the start: the responder waits
            // for the test to re-arm it, and nothing queued on the old link remains.
            self.armed.store(false, std::sync::atomic::Ordering::SeqCst);
            self.drained
                .store(false, std::sync::atomic::Ordering::SeqCst);
            self.queued.lock().unwrap().clear();
            self.inner.connect(mac, uuid)
        }
        fn disconnect(&mut self) {
            self.inner.disconnect()
        }
        fn recv(&mut self, dst: &mut [u8]) -> mdr::Result<Option<usize>> {
            if let Some(n) = self.inner.recv(dst)? {
                return Ok(Some(n));
            }
            self.drained
                .store(true, std::sync::atomic::Ordering::SeqCst);
            let mut queued = self.queued.lock().unwrap();
            if queued.is_empty() {
                if self.closed {
                    return Err(mdr::Error::Transport(
                        "No connection has been established (simulated)".into(),
                    ));
                }
                return Ok(None);
            }
            let n = dst.len().min(queued.len());
            for (d, b) in dst.iter_mut().zip(queued.drain(..n)) {
                *d = b;
            }
            Ok(Some(n))
        }
        fn send(&mut self, src: &[u8]) -> mdr::Result<usize> {
            self.tx.lock().unwrap().extend_from_slice(src);
            if self.armed.load(std::sync::atomic::Ordering::SeqCst) {
                for f in frames(src) {
                    let Some(d) = mdr::packet::decode_frame(&f) else {
                        continue;
                    };
                    if d.data_type == 0x01 {
                        continue; // our ACK of a device frame
                    }
                    let seq = d.seq ^ 1;
                    let mut queued = self.queued.lock().unwrap();
                    queued.extend([0x3E, 0x01, seq, 0, 0, 0, 0, 0x01 + seq, 0x3C]);
                    if let Some((_, reply)) = self.replies.iter().find(|(p, _)| *p == d.payload) {
                        queued.extend(reply.iter().copied());
                    }
                    if self.close_after.as_ref() == Some(&d.payload) {
                        self.closed = true;
                    }
                }
            }
            self.inner.send(src)
        }
        fn poll(&mut self, t: i32) -> mdr::Result<PollStatus> {
            self.inner.poll(t)
        }
        fn devices(&mut self) -> mdr::Result<Vec<DeviceInfo>> {
            let mut list = vec![DeviceInfo {
                name: "Some Keyboard".into(),
                mac: "00:00:00:00:00:01".into(),
            }];
            if self.listed {
                list.push(DeviceInfo {
                    name: self.name.clone(),
                    mac: XM3_ADDRESS.into(),
                });
            }
            Ok(list)
        }
        fn last_error(&self) -> String {
            String::new()
        }
    }

    #[derive(Default)]
    struct VecSink {
        statuses: Mutex<Vec<StatusView>>,
        snapshots: Mutex<Vec<SnapshotPayload>>,
        alerts: Mutex<Vec<AlertView>>,
        devices: Mutex<Vec<DevicesView>>,
    }

    impl SnapshotSink for VecSink {
        fn status(&self, s: &StatusView) {
            self.statuses.lock().unwrap().push(s.clone());
        }
        fn snapshot(&self, p: &SnapshotPayload) {
            self.snapshots.lock().unwrap().push(p.clone());
        }
        fn alert(&self, a: &AlertView) {
            self.alerts.lock().unwrap().push(a.clone());
        }
        fn devices(&self, d: &DevicesView) {
            self.devices.lock().unwrap().push(d.clone());
        }
    }

    struct Harness {
        service: EngineService,
        sink: Arc<VecSink>,
        tx: Arc<Mutex<Vec<u8>>>,
        armed: Arc<std::sync::atomic::AtomicBool>,
        drained: Arc<std::sync::atomic::AtomicBool>,
        queued: Arc<Mutex<VecDeque<u8>>>,
        connects: Arc<Mutex<Vec<String>>>,
        refuse: Arc<std::sync::atomic::AtomicBool>,
    }

    impl Harness {
        /// Waits for Ready, for every recorded RX byte to be consumed and for
        /// TX to stop growing (libmdr has answered the last recorded frame),
        /// then turns the device responder on. Returns the TX length at that point.
        fn ready_and_armed(&self) -> usize {
            wait_for("Ready", || self.service.status().state == ConnState::Ready);
            wait_for("the replay to drain", || {
                self.drained.load(std::sync::atomic::Ordering::SeqCst)
            });
            let mut last = usize::MAX;
            wait_for("TX to settle", || {
                let now = self.tx.lock().unwrap().len();
                let settled = now == last;
                last = now;
                std::thread::sleep(Duration::from_millis(30));
                settled
            });
            self.armed.store(true, std::sync::atomic::Ordering::SeqCst);
            self.tx.lock().unwrap().len()
        }

        fn tx_since(&self, from: usize) -> Vec<Vec<u8>> {
            frames(&self.tx.lock().unwrap()[from..])
        }

        /// Makes the device send `frame` (as if another controller changed it).
        fn device_sends(&self, frame: &[u8]) {
            self.queued.lock().unwrap().extend(frame.iter().copied());
        }

        fn live_ticks(&self) -> u64 {
            self.service
                .shared
                .live_ticks
                .load(std::sync::atomic::Ordering::Relaxed)
        }
    }

    fn start() -> Harness {
        start_capture(xm3_dir(), "WH-1000XM3", Protocol::V1, Vec::new())
    }

    /// How a test's service and replayed device are set up.
    struct Setup {
        dir: PathBuf,
        name: String,
        protocol: Protocol,
        replies: Vec<(Vec<u8>, Vec<u8>)>,
        auto_connect: bool,
        /// Windows lists the headset as connected.
        listed: bool,
        busy: bool,
        profiles_path: Option<PathBuf>,
        close_after: Option<Vec<u8>>,
        recovery_window: Duration,
    }

    impl Setup {
        fn xm4() -> Self {
            Self {
                dir: xm4_dir(),
                name: "WH-1000XM4".into(),
                protocol: Protocol::V1,
                replies: Vec::new(),
                auto_connect: true,
                listed: true,
                busy: false,
                profiles_path: None,
                close_after: None,
                recovery_window: Duration::from_secs(20),
            }
        }
    }

    fn start_capture(
        dir: PathBuf,
        name: &str,
        protocol: Protocol,
        replies: Vec<(Vec<u8>, Vec<u8>)>,
    ) -> Harness {
        start_setup(Setup {
            dir,
            name: name.into(),
            protocol,
            replies,
            ..Setup::xm4()
        })
    }

    fn start_setup(s: Setup) -> Harness {
        let tx = Arc::new(Mutex::new(Vec::new()));
        let armed = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let drained = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let queued = Arc::new(Mutex::new(VecDeque::new()));
        let connects = Arc::new(Mutex::new(Vec::new()));
        let refuse = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let (f_tx, f_armed, f_drained, f_queued, f_connects, f_refuse) = (
            tx.clone(),
            armed.clone(),
            drained.clone(),
            queued.clone(),
            connects.clone(),
            refuse.clone(),
        );
        let Setup {
            dir,
            name,
            protocol,
            replies,
            auto_connect,
            listed,
            busy,
            profiles_path,
            close_after,
            recovery_window,
        } = s;
        let factory: TransportFactory = Arc::new(move || {
            Ok(Box::new(ListedReplay {
                inner: ReplayTransport::from_capture_dir(&dir)?,
                protocol,
                name: name.clone(),
                tx: f_tx.clone(),
                armed: f_armed.clone(),
                drained: f_drained.clone(),
                replies: replies.clone(),
                queued: f_queued.clone(),
                busy,
                listed,
                connects: f_connects.clone(),
                close_after: close_after.clone(),
                closed: false,
                refuse: f_refuse.clone(),
            }) as Box<dyn Transport>)
        });
        let sink = Arc::new(VecSink::default());
        let config = ServiceConfig {
            discovery_interval: Duration::from_millis(5),
            retry_backoff: Duration::from_secs(60),
            tick: Duration::from_millis(1),
            auto_connect,
            profiles_path,
            recovery_window,
            recovery_retry: Duration::from_millis(10),
            ..ServiceConfig::default()
        };
        let service = EngineService::start(factory, sink.clone(), config);
        Harness {
            service,
            sink,
            tx,
            armed,
            drained,
            queued,
            connects,
            refuse,
        }
    }

    fn wait_for(what: &str, mut cond: impl FnMut() -> bool) {
        let deadline = Instant::now() + Duration::from_secs(20);
        while Instant::now() < deadline {
            if cond() {
                return;
            }
            std::thread::sleep(Duration::from_millis(5));
        }
        panic!("timed out waiting for {what}");
    }

    fn states(sink: &VecSink) -> Vec<ConnState> {
        sink.statuses
            .lock()
            .unwrap()
            .iter()
            .map(|s| s.state)
            .collect()
    }

    #[test]
    fn replayed_xm3_reaches_ready_and_publishes_its_snapshot() {
        let h = start();
        wait_for("Ready", || h.service.status().state == ConnState::Ready);
        assert_eq!(
            states(&h.sink),
            vec![
                ConnState::Disconnected,
                ConnState::Discovering,
                ConnState::Connecting,
                ConnState::Initialising,
                ConnState::Ready
            ]
        );
        let ready = h.service.status();
        assert_eq!(ready.device_name.as_deref(), Some("WH-1000XM3"));
        assert_eq!(ready.address.as_deref(), Some(XM3_ADDRESS));
        assert_eq!(ready.protocol, Some(Protocol::V1), "fell back to LEGACY");
        let snaps = h.sink.snapshots.lock().unwrap();
        assert!(snaps
            .iter()
            .any(|p| p.snapshot.texts.model_name.as_deref() == Some("WH-1000XM3")));
        let last = snaps.last().unwrap();
        let view = last.noise_view.expect("noise view");
        assert_eq!(view.mode, NoiseViewMode::Cancelling);
        assert!((1..=20).contains(&view.ambient_level));
        let json = serde_json::to_value(last).unwrap();
        assert!(json.get("snapshot").is_some() && json.get("noiseView").is_some());
    }

    #[test]
    fn set_dsee_is_staged_and_committed_to_the_transport() {
        let h = start();
        wait_for("Ready", || h.service.status().state == ConnState::Ready);
        // Let the replay drain so only our command adds TX.
        std::thread::sleep(Duration::from_millis(100));
        let before = h.tx.lock().unwrap().len();
        // The XM3 capture has DSEE on, so turning it off is a real change.
        h.service
            .send(EngineCommand::SetDsee { enabled: false })
            .unwrap();
        wait_for("TX to grow", || h.tx.lock().unwrap().len() > before);
    }

    #[test]
    fn disconnect_leads_to_disconnected_and_stays_there() {
        let h = start();
        wait_for("Ready", || h.service.status().state == ConnState::Ready);
        h.service.send(EngineCommand::Disconnect).unwrap();
        wait_for("Disconnected", || {
            h.service.status().state == ConnState::Disconnected
        });
        assert!(h.service.snapshot().is_none());
        std::thread::sleep(Duration::from_millis(50));
        assert_eq!(
            h.service.status().state,
            ConnState::Disconnected,
            "no auto-reconnect"
        );
    }

    #[test]
    fn commands_deserialize_from_renderer_json() {
        let c: EngineCommand =
            serde_json::from_str(r#"{"type":"setNoise","mode":"ambient","ambientLevel":7}"#)
                .unwrap();
        assert_eq!(
            c,
            EngineCommand::SetNoise {
                mode: NoiseViewMode::Ambient,
                ambient_level: Some(7),
                focus_on_voice: None
            }
        );
        let c: EngineCommand =
            serde_json::from_str(r#"{"type":"setEqualizerPreset","preset":"bass"}"#).unwrap();
        assert_eq!(
            c,
            EngineCommand::SetEqualizerPreset {
                preset: EqualizerPresetId::Bass
            }
        );
        let c: EngineCommand = serde_json::from_str(r#"{"type":"powerOff"}"#).unwrap();
        assert_eq!(c, EngineCommand::PowerOff);
        let c: EngineCommand =
            serde_json::from_str(r#"{"type":"playback","action":"next"}"#).unwrap();
        assert_eq!(
            c,
            EngineCommand::Playback {
                action: PlaybackAction::Next
            }
        );
    }

    // ---- noise control regression (docs/core/evidence/noise-control-debug.md) ----

    fn noise_mode(h: &Harness) -> Option<(NoiseViewMode, u8)> {
        h.service
            .snapshot()
            .and_then(|p| p.noise_view)
            .map(|v| (v.mode, v.ambient_level))
    }

    /// The DATA (non-ACK) payloads in `frames`.
    fn data_payloads(frames: &[Vec<u8>]) -> Vec<Vec<u8>> {
        frames
            .iter()
            .filter_map(|f| mdr::packet::decode_frame(f))
            .filter(|d| d.data_type != 0x01)
            .map(|d| d.payload)
            .collect()
    }

    /// NCASM_SET_PARAM payloads (`0x68 ...`) in `frames`.
    fn ncasm_sets(frames: &[Vec<u8>]) -> Vec<Vec<u8>> {
        data_payloads(frames)
            .into_iter()
            .filter(|p| p.first() == Some(&0x68))
            .collect()
    }

    #[test]
    fn xm4_nc_to_ambient_10_to_off_to_nc_sends_the_frames_the_live_device_confirmed() {
        let ours = |n: &str| fixture(&format!("soundconnect-{n}"));
        let replies = vec![
            (
                payload(&ours("01-tx.cmd-NCASM_SET_PARAM-68.bin")),
                ours("02-rx.cmd-NCASM_NTFY_PARAM-69.bin"),
            ),
            (
                payload(&ours("03-tx.cmd-NCASM_SET_PARAM-68.bin")),
                ours("04-rx.cmd-NCASM_NTFY_PARAM-69.bin"),
            ),
            (
                payload(&ours("05-tx.cmd-NCASM_SET_PARAM-68.bin")),
                ours("06-rx.cmd-NCASM_NTFY_PARAM-69.bin"),
            ),
        ];
        let h = start_capture(xm4_dir(), "WH-1000XM4", Protocol::V1, replies);
        let from = h.ready_and_armed();
        assert_eq!(noise_mode(&h).map(|m| m.0), Some(NoiseViewMode::Cancelling));

        let noise = |mode| EngineCommand::SetNoise {
            mode,
            ambient_level: None,
            focus_on_voice: None,
        };
        let steps = [
            (
                EngineCommand::SetAmbientLevel { level: 10 },
                (NoiseViewMode::Ambient, 10),
            ),
            (noise(NoiseViewMode::Off), (NoiseViewMode::Off, 10)),
            (
                noise(NoiseViewMode::Cancelling),
                (NoiseViewMode::Cancelling, 10),
            ),
        ];
        for (i, (cmd, want)) in steps.into_iter().enumerate() {
            h.service.send(cmd).unwrap();
            wait_for("the NCASM_SET_PARAM and the device reply", || {
                ncasm_sets(&h.tx_since(from)).len() == i + 1 && noise_mode(&h) == Some(want)
            });
        }
        let sent = ncasm_sets(&h.tx_since(from));
        assert_eq!(
            sent,
            vec![
                payload(&ours("01-tx.cmd-NCASM_SET_PARAM-68.bin")),
                payload(&ours("03-tx.cmd-NCASM_SET_PARAM-68.bin")),
                payload(&ours("05-tx.cmd-NCASM_SET_PARAM-68.bin")),
            ]
        );
        // `68 02 11 01 00 01 00 0a`: ADJUSTMENT_COMPLETION, NC off, ambient 10.
        assert_eq!(sent[0], [0x68, 0x02, 0x11, 0x01, 0x00, 0x01, 0x00, 0x0A]);
        // Off and NC are byte-for-byte what the upstream client sends.
        let up = |n: &str| payload(&fixture(&format!("upstream-5c23c9c-{n}")));
        assert_eq!(
            sent[1],
            up("000324-tx.type-DATA_MDR-0c.seq-00.cmd-NCASM_SET_PARAM-68.bin")
        );
        assert_eq!(
            sent[2],
            up("000328-tx.type-DATA_MDR-0c.seq-01.cmd-NCASM_SET_PARAM-68.bin")
        );
        // Upstream's slider drag sent ADJUSTMENT_IN_PROGRESS (0x10), which the XM4
        // never confirmed; ours must stay a completed change.
        let upstream_ambient = up("000322-tx.type-DATA_MDR-0c.seq-01.cmd-NCASM_SET_PARAM-68.bin");
        assert_eq!(upstream_ambient[2], 0x10);
        assert_eq!(&upstream_ambient[3..], &sent[0][3..]);
    }

    // ---- commands added 2026-10-12 -------------------------------------------

    /// Sends `cmd` to a ready, armed replay and returns the DATA payloads it caused.
    fn data_frames_for(h: &Harness, cmd: EngineCommand) -> Vec<Vec<u8>> {
        let from = h.ready_and_armed();
        h.service.send(cmd).unwrap();
        wait_for("TX to grow", || {
            !data_payloads(&h.tx_since(from)).is_empty()
        });
        data_payloads(&h.tx_since(from))
    }

    fn xm4() -> Harness {
        start_capture(xm4_dir(), "WH-1000XM4", Protocol::V1, Vec::new())
    }

    #[test]
    fn set_speak_to_chat_reaches_the_xm4() {
        let sent = data_frames_for(
            &xm4(),
            EngineCommand::SetSpeakToChat {
                enabled: true,
                sensitivity: SpeechSensitivity::High,
                timeout: SpeakTimeout::Long,
            },
        );
        // SYSTEM_SET_PARAM SMART_TALKING_MODE on, then SYSTEM_SET_EXTENDED_PARAM
        // (sensitivity and timeout), as observed from libmdr 4c91fe6.
        assert_eq!(sent[0], [0xF8, 0x05, 0x01, 0x01], "{sent:02x?}");
        assert!(sent[1].starts_with(&[0xFC, 0x05]), "{sent:02x?}");
    }

    #[test]
    fn set_connection_mode_reaches_the_xm4_once_confirmed() {
        // The capture is in "stability"; "quality" is a change.
        let h = xm4();
        let from = h.ready_and_armed();
        h.service
            .send(EngineCommand::SetConnectionMode {
                audio_priority: AudioPriority::Quality,
            })
            .unwrap();
        wait_for("the confirmation alert", || {
            !h.sink.alerts.lock().unwrap().is_empty()
        });
        h.service
            .send(EngineCommand::RespondToAlert { positive: true })
            .unwrap();
        wait_for("TX to grow", || {
            !data_payloads(&h.tx_since(from)).is_empty()
        });
        // AUDIO_SET_PARAM ... SOUND_QUALITY_PRIOR (0x00).
        assert_eq!(
            data_payloads(&h.tx_since(from)),
            vec![vec![0xE8, 0x01, 0x00, 0x00]]
        );
    }

    #[test]
    fn set_pairing_reaches_the_xm4() {
        let sent = data_frames_for(&xm4(), EngineCommand::SetPairing { enabled: true });
        // Table-2 PERIPHERAL_SET_STATUS (HeadphonesV1.cpp 723-735), pairing mode on.
        assert_eq!(sent, vec![vec![0x34, 0x01, 0x01, 0x00]]);
    }

    #[test]
    fn set_auto_pause_changes_only_auto_pause() {
        let h = xm4();
        wait_for("Ready", || h.service.status().state == ConnState::Ready);
        let before = h.service.snapshot().unwrap().snapshot.power.unwrap();
        assert!(before.auto_pause, "the XM4 capture has auto pause on");
        let sent = data_frames_for(&h, EngineCommand::SetAutoPause { enabled: false });
        assert!(!sent.is_empty());
        wait_for("auto pause off in the snapshot", || {
            h.service
                .snapshot()
                .and_then(|p| p.snapshot.power)
                .is_some_and(|p| !p.auto_pause)
        });
        let after = h.service.snapshot().unwrap().snapshot.power.unwrap();
        assert_eq!(
            (
                after.auto_power_off_minutes,
                after.wearing_power,
                after.head_gesture
            ),
            (
                before.auto_power_off_minutes,
                before.wearing_power,
                before.head_gesture
            )
        );
    }

    #[test]
    fn set_multipoint_writes_the_multipoint_general_setting() {
        let h = xm4();
        wait_for("Ready", || h.service.status().state == ConnState::Ready);
        let gs = h
            .service
            .snapshot()
            .unwrap()
            .snapshot
            .general_settings
            .unwrap();
        let mp = gs.iter().find(|g| g.subject == MULTIPOINT_SUBJECT).unwrap();
        assert_eq!((mp.index, mp.value), (1, true));
        let sent = data_frames_for(&h, EngineCommand::SetMultipoint { enabled: false });
        // GENERAL_SETTING_SET_PARAM for GENERAL_SETTING2 (the XM4's multipoint).
        assert!(
            sent.iter().any(|p| p.starts_with(&[0xD8, 0xD2])),
            "{sent:02x?}"
        );
    }

    #[test]
    fn set_paired_device_reaches_a_v2_device() {
        let h = start_capture(linkbuds_dir(), "LinkBuds Clip", Protocol::V2, Vec::new());
        wait_for("Ready", || h.service.status().state == ConnState::Ready);
        let devices = h
            .service
            .snapshot()
            .unwrap()
            .snapshot
            .paired_devices
            .unwrap_or_default();
        let id = devices
            .first()
            .map(|d| d.mac_address.clone())
            .unwrap_or_else(|| "AA:BB:CC:00:00:02".into());
        let sent = data_frames_for(
            &h,
            EngineCommand::SetPairedDevice {
                command: PairedDeviceCommand::Connect,
                device_id: id,
            },
        );
        assert!(!sent.is_empty());
    }

    #[test]
    fn set_paired_device_is_rejected_on_v1_without_sending() {
        // libmdr 4c91fe6 `mdrHeadphonesSetPairedDevice`: V1 -> NOT_SUPPORTED.
        let h = xm4();
        let from = h.ready_and_armed();
        h.service
            .send(EngineCommand::SetPairedDevice {
                command: PairedDeviceCommand::Disconnect,
                device_id: "00:11:22:33:44:52".into(),
            })
            .unwrap();
        // A later, real change proves the queue moved past the rejected command.
        h.service
            .send(EngineCommand::SetPairing { enabled: true })
            .unwrap();
        wait_for("the pairing frame", || {
            !data_payloads(&h.tx_since(from)).is_empty()
        });
        std::thread::sleep(Duration::from_millis(50));
        let sent = data_payloads(&h.tx_since(from));
        assert_eq!(sent.len(), 1, "only the pairing change: {sent:02x?}");
    }

    #[test]
    fn new_commands_deserialize_from_renderer_json() {
        let parse = |j: &str| serde_json::from_str::<EngineCommand>(j).unwrap();
        assert_eq!(
            parse(
                r#"{"type":"setSpeakToChat","enabled":true,"sensitivity":"auto","timeout":"manual"}"#
            ),
            EngineCommand::SetSpeakToChat {
                enabled: true,
                sensitivity: SpeechSensitivity::Auto,
                timeout: SpeakTimeout::Manual
            }
        );
        assert_eq!(
            parse(r#"{"type":"setConnectionMode","audioPriority":"quality"}"#),
            EngineCommand::SetConnectionMode {
                audio_priority: AudioPriority::Quality
            }
        );
        assert_eq!(
            parse(
                r#"{"type":"setPairedDevice","command":"selectPlayback","deviceId":"00:11:22:33:44:51"}"#
            ),
            EngineCommand::SetPairedDevice {
                command: PairedDeviceCommand::SelectPlayback,
                device_id: "00:11:22:33:44:51".into()
            }
        );
        for (name, want) in [
            ("connect", PairedDeviceCommand::Connect),
            ("disconnect", PairedDeviceCommand::Disconnect),
            ("unpair", PairedDeviceCommand::Unpair),
        ] {
            let j = format!(r#"{{"type":"setPairedDevice","command":"{name}","deviceId":"x"}}"#);
            assert!(
                matches!(parse(&j), EngineCommand::SetPairedDevice { command, .. } if command == want)
            );
        }
        assert_eq!(
            parse(r#"{"type":"setPairing","enabled":false}"#),
            EngineCommand::SetPairing { enabled: false }
        );
        assert_eq!(
            parse(r#"{"type":"setAutoPause","enabled":true}"#),
            EngineCommand::SetAutoPause { enabled: true }
        );
        assert_eq!(
            parse(r#"{"type":"setMultipoint","enabled":false}"#),
            EngineCommand::SetMultipoint { enabled: false }
        );
        for (name, want) in [
            ("low", SpeechSensitivity::Low),
            ("high", SpeechSensitivity::High),
        ] {
            let j = format!(
                r#"{{"type":"setSpeakToChat","enabled":true,"sensitivity":"{name}","timeout":"short"}}"#
            );
            assert!(
                matches!(parse(&j), EngineCommand::SetSpeakToChat { sensitivity, .. } if sensitivity == want)
            );
        }
        for (name, want) in [
            ("medium", SpeakTimeout::Medium),
            ("long", SpeakTimeout::Long),
        ] {
            let j = format!(
                r#"{{"type":"setSpeakToChat","enabled":true,"sensitivity":"auto","timeout":"{name}"}}"#
            );
            assert!(
                matches!(parse(&j), EngineCommand::SetSpeakToChat { timeout, .. } if timeout == want)
            );
        }
        let bad = |j: &str| serde_json::from_str::<EngineCommand>(j).is_err();
        assert!(bad(
            r#"{"type":"setConnectionMode","audioPriority":"loud"}"#
        ));
        assert!(bad(r#"{"type":"setPairedDevice","command":"connect"}"#));
        assert_eq!(parse(r#"{"type":"scan"}"#), EngineCommand::Scan);
        assert_eq!(
            parse(r#"{"type":"forgetDevice","address":"00:11:22:33:44:51"}"#),
            EngineCommand::ForgetDevice {
                address: "00:11:22:33:44:51".into()
            }
        );
        assert_eq!(
            parse(r#"{"type":"setAutoConnect","enabled":true}"#),
            EngineCommand::SetAutoConnect { enabled: true }
        );
        assert_eq!(
            parse(r#"{"type":"openBluetoothSettings"}"#),
            EngineCommand::OpenBluetoothSettings
        );
        assert_eq!(
            parse(r#"{"type":"connect","address":"00:11:22:33:44:51"}"#),
            EngineCommand::Connect {
                address: "00:11:22:33:44:51".into()
            }
        );
    }

    /// Like [`wait_for`] with a longer deadline (tick counts depend on the
    /// OS timer resolution).
    fn wait_long(what: &str, mut cond: impl FnMut() -> bool) {
        let deadline = Instant::now() + Duration::from_secs(90);
        while Instant::now() < deadline {
            if cond() {
                return;
            }
            std::thread::sleep(Duration::from_millis(10));
        }
        panic!("timed out waiting for {what}");
    }

    // ---- remembered profiles, idle launch, scan, forget (round 2) -----------

    fn temp_profiles(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "soundconnect-service-test-{}-{name}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        dir.join(crate::profiles::FILE_NAME)
    }

    fn xm4_profile() -> DeviceProfile {
        DeviceProfile {
            address: XM3_ADDRESS.into(),
            name: "WH-1000XM4".into(),
            model_name: "WH-1000XM4".into(),
            firmware: "2.9.0".into(),
            protocol: Protocol::V1,
            last_seen: 1,
        }
    }

    fn write_profiles(path: &Path, list: &[DeviceProfile]) {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, serde_json::to_string(list).unwrap()).unwrap();
    }

    fn saved_profiles(path: &Path) -> Vec<serde_json::Value> {
        serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap()
    }

    #[test]
    fn launch_with_a_profile_and_auto_connect_off_stays_idle() {
        let path = temp_profiles("idle");
        write_profiles(&path, &[xm4_profile()]);
        let h = start_setup(Setup {
            auto_connect: false,
            profiles_path: Some(path),
            ..Setup::xm4()
        });
        let status = h.service.status();
        assert_eq!(status.state, ConnState::Disconnected);
        assert_eq!(status.remembered, Some(xm4_profile()));
        std::thread::sleep(Duration::from_millis(200));
        assert!(
            h.connects.lock().unwrap().is_empty(),
            "no connection attempt"
        );
        assert!(h.tx.lock().unwrap().is_empty(), "nothing sent");
        assert_eq!(
            states(&h.sink),
            vec![ConnState::Disconnected],
            "only the launch status, never Discovering"
        );
        let json = serde_json::to_value(h.service.status()).unwrap();
        assert_eq!(json["remembered"]["modelName"], "WH-1000XM4");
        assert_eq!(json["remembered"]["address"], XM3_ADDRESS);
        assert_eq!(json["remembered"]["protocol"], "V1");
        assert!(json.get("reason").is_none());
    }

    #[test]
    fn launch_without_profiles_reports_remembered_null() {
        let h = start_setup(Setup {
            auto_connect: false,
            ..Setup::xm4()
        });
        let json = serde_json::to_value(h.service.status()).unwrap();
        assert_eq!(json["state"], "disconnected");
        assert!(json["remembered"].is_null());
    }

    #[test]
    fn manual_connect_from_idle_reaches_ready_and_learns_the_profile() {
        let path = temp_profiles("connect");
        let h = start_setup(Setup {
            auto_connect: false,
            profiles_path: Some(path.clone()),
            ..Setup::xm4()
        });
        std::thread::sleep(Duration::from_millis(50));
        assert!(h.connects.lock().unwrap().is_empty());
        h.service
            .send(EngineCommand::Connect {
                address: XM3_ADDRESS.into(),
            })
            .unwrap();
        wait_for("Ready", || h.service.status().state == ConnState::Ready);
        let p = h.service.status().remembered.expect("learned at Ready");
        assert_eq!(
            (
                p.address.as_str(),
                p.model_name.as_str(),
                p.firmware.as_str(),
                p.protocol
            ),
            (XM3_ADDRESS, "WH-1000XM4", "2.9.0", Protocol::V1)
        );
        assert!(p.last_seen > 0);
        let saved = saved_profiles(&path);
        assert_eq!(saved.len(), 1);
        assert_eq!(saved[0]["modelName"], "WH-1000XM4");
        assert_eq!(
            states(&h.sink),
            vec![
                ConnState::Disconnected,
                ConnState::Connecting,
                ConnState::Initialising,
                ConnState::Ready
            ]
        );
    }

    #[test]
    fn scan_lists_connected_devices_and_flags_remembered_ones() {
        let path = temp_profiles("scan");
        write_profiles(&path, &[xm4_profile()]);
        let h = start_setup(Setup {
            auto_connect: false,
            profiles_path: Some(path),
            ..Setup::xm4()
        });
        h.service.send(EngineCommand::Scan).unwrap();
        wait_for("engine:devices", || {
            !h.sink.devices.lock().unwrap().is_empty()
        });
        let view = h.sink.devices.lock().unwrap()[0].clone();
        assert_eq!(
            view.devices,
            vec![
                ScannedDevice {
                    address: "00:00:00:00:00:01".into(),
                    name: "Some Keyboard".into(),
                    remembered: false
                },
                ScannedDevice {
                    address: XM3_ADDRESS.into(),
                    name: "WH-1000XM4".into(),
                    remembered: true
                },
            ]
        );
        let json = serde_json::to_value(&view).unwrap();
        assert_eq!(json["devices"][1]["remembered"], true);
        std::thread::sleep(Duration::from_millis(50));
        assert!(
            h.connects.lock().unwrap().is_empty(),
            "a scan never connects"
        );
        assert_eq!(h.service.status().state, ConnState::Disconnected);
    }

    #[test]
    fn forget_device_removes_the_profile_and_drops_its_link() {
        let path = temp_profiles("forget");
        let h = start_setup(Setup {
            auto_connect: false,
            profiles_path: Some(path.clone()),
            ..Setup::xm4()
        });
        h.service
            .send(EngineCommand::Connect {
                address: XM3_ADDRESS.into(),
            })
            .unwrap();
        wait_for("Ready", || h.service.status().state == ConnState::Ready);
        assert_eq!(saved_profiles(&path).len(), 1);
        h.service
            .send(EngineCommand::ForgetDevice {
                address: XM3_ADDRESS.into(),
            })
            .unwrap();
        wait_for("Disconnected", || {
            h.service.status().state == ConnState::Disconnected
        });
        assert_eq!(h.service.status().remembered, None);
        assert!(saved_profiles(&path).is_empty());
        std::thread::sleep(Duration::from_millis(50));
        assert_eq!(h.service.status().state, ConnState::Disconnected);
        assert_eq!(h.connects.lock().unwrap().len(), 2, "no reconnect");
    }

    #[test]
    fn connect_to_a_device_windows_does_not_list_is_not_connected_to_windows() {
        let h = start_setup(Setup {
            auto_connect: false,
            listed: false,
            ..Setup::xm4()
        });
        h.service
            .send(EngineCommand::Connect {
                address: XM3_ADDRESS.into(),
            })
            .unwrap();
        wait_for("the failure", || h.service.status().reason.is_some());
        let s = h.service.status();
        assert_eq!(
            (s.state, s.reason),
            (
                ConnState::Disconnected,
                Some(FailureReason::NotConnectedToWindows)
            )
        );
        assert!(
            h.connects.lock().unwrap().is_empty(),
            "no socket was opened"
        );
        assert_eq!(
            serde_json::to_value(&s).unwrap()["reason"],
            "notConnectedToWindows"
        );
    }

    #[test]
    fn a_listed_device_whose_channel_will_not_open_is_busy() {
        let h = start_setup(Setup {
            auto_connect: false,
            busy: true,
            ..Setup::xm4()
        });
        h.service
            .send(EngineCommand::Connect {
                address: XM3_ADDRESS.into(),
            })
            .unwrap();
        wait_for("the failure", || h.service.status().reason.is_some());
        assert_eq!(h.service.status().reason, Some(FailureReason::Busy));
        assert_eq!(h.connects.lock().unwrap().len(), 2, "both service UUIDs");
        std::thread::sleep(Duration::from_millis(50));
        assert_eq!(
            h.connects.lock().unwrap().len(),
            2,
            "no retry with autoConnect off"
        );
    }

    #[test]
    fn set_auto_connect_starts_discovery_from_idle() {
        let h = start_setup(Setup {
            auto_connect: false,
            ..Setup::xm4()
        });
        std::thread::sleep(Duration::from_millis(30));
        assert!(h.connects.lock().unwrap().is_empty());
        h.service
            .send(EngineCommand::SetAutoConnect { enabled: true })
            .unwrap();
        wait_for("Ready", || h.service.status().state == ConnState::Ready);
    }

    // ---- coexisting with another controller (the Sony phone app) -----------

    /// Live check, not run by default: with the XM4 connected to Windows (and
    /// no other SoundConnect running), connect, reach Ready, then stay idle for
    /// `SOUNDCONNECT_IDLE_SECS` (default 120) with the packet log on. Count the
    /// `packet: tx` lines in the output: only ACKs may appear.
    /// `cargo test --lib live_xm4_idle -- --ignored --nocapture 2> idle.log`
    #[cfg(windows)]
    #[test]
    #[ignore]
    fn live_xm4_idle_sends_nothing_but_acks() {
        let factory: TransportFactory =
            Arc::new(|| Ok(Box::new(mdr::WindowsTransport::new()?) as Box<dyn Transport>));
        let sink = Arc::new(VecSink::default());
        let service = EngineService::start(
            factory,
            sink.clone(),
            ServiceConfig {
                auto_connect: true,
                packet_log: true,
                ..ServiceConfig::default()
            },
        );
        wait_long("Ready", || service.status().state == ConnState::Ready);
        eprintln!("live: Ready; idle from here");
        let secs = std::env::var("SOUNDCONNECT_IDLE_SECS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(120);
        std::thread::sleep(Duration::from_secs(secs));
        eprintln!(
            "live: idle done after {secs} s; status {:?}",
            service.status().state
        );
        service.shutdown();
    }

    #[test]
    fn no_tx_for_1000_ticks_after_ready_without_a_command() {
        let h = xm4();
        let from = h.ready_and_armed();
        let start = h.live_ticks();
        wait_long("1000 ticks", || h.live_ticks() >= start + 1000);
        let sent = h.tx_since(from);
        assert!(sent.is_empty(), "no TX at all: {sent:02x?}");
    }

    #[test]
    fn a_device_notification_wins_over_a_no_op_command_and_is_never_written_back() {
        // The "fighting with the phone app" bug: re-selecting the current mode
        // staged NC on without a commit (nothing changed), which left libmdr's
        // staging revision ahead. When the phone then switched to ambient,
        // libmdr updated only its current value, `is_dirty` turned true and the
        // old loop committed our stale "NC on" back to the headphones.
        let h = xm4();
        let from = h.ready_and_armed();
        assert_eq!(noise_mode(&h).map(|m| m.0), Some(NoiseViewMode::Cancelling));
        let t = h.live_ticks();
        h.service
            .send(EngineCommand::SetNoise {
                mode: NoiseViewMode::Cancelling,
                ambient_level: None,
                focus_on_voice: None,
            })
            .unwrap();
        wait_long("the command to be applied", || h.live_ticks() >= t + 50);
        assert!(
            data_payloads(&h.tx_since(from)).is_empty(),
            "an unchanged mode sends nothing"
        );
        // The phone app switches to ambient 10: the device notifies us.
        h.device_sends(&fixture("soundconnect-02-rx.cmd-NCASM_NTFY_PARAM-69.bin"));
        wait_for("the device's mode in the snapshot", || {
            noise_mode(&h) == Some((NoiseViewMode::Ambient, 10))
        });
        let t = h.live_ticks();
        wait_long("1000 ticks", || h.live_ticks() >= t + 1000);
        let sent = h.tx_since(from);
        assert!(
            data_payloads(&sent).is_empty(),
            "only ACKs, never a write: {sent:02x?}"
        );
        assert!(!sent.is_empty(), "the notification was acknowledged");
        assert_eq!(noise_mode(&h), Some((NoiseViewMode::Ambient, 10)));
    }

    /// A `connect` to an address with no profile (as from a scan) used to
    /// carry the address as the name, so `devices.json` stored
    /// `"name": "AC:80:..."`. The profile takes Windows' listed name and the
    /// replayed device's model name.
    #[test]
    fn connect_without_a_profile_remembers_the_windows_name_and_model() {
        let path = temp_profiles("xm3-name");
        let h = start_setup(Setup {
            dir: xm3_dir(),
            name: "WH-1000XM3".into(),
            auto_connect: false,
            profiles_path: Some(path.clone()),
            ..Setup::xm4()
        });
        h.service
            .send(EngineCommand::Connect {
                address: XM3_ADDRESS.into(),
            })
            .unwrap();
        wait_for("Ready", || h.service.status().state == ConnState::Ready);
        assert_eq!(
            h.service.status().device_name.as_deref(),
            Some("WH-1000XM3")
        );
        let saved = saved_profiles(&path);
        assert_eq!(saved.len(), 1);
        assert_eq!(saved[0]["modelName"], "WH-1000XM3");
        assert_eq!(
            saved[0]["name"], "WH-1000XM3",
            "Windows' name, not the address"
        );
        assert_eq!(saved[0]["address"], XM3_ADDRESS);
    }

    // ---- toggle dropouts (docs/core/evidence/toggle-dropouts-debug.md) --------

    /// Live WH-1000XM4 frames (fw 2.9.0, 2026-10-13): our TX for DSEE,
    /// Speak-to-Chat and connection quality, and the device's replies.
    fn toggle(name: &str) -> Vec<u8> {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("fixtures/xm4-toggle-dropouts")
            .join(format!("soundconnect-{name}"));
        std::fs::read(&path).unwrap_or_else(|e| panic!("{}: {e}", path.display()))
    }

    /// The device's recorded reply frames, concatenated.
    fn replies_of(names: &[&str]) -> Vec<u8> {
        names.iter().flat_map(|n| toggle(n)).collect()
    }

    fn speak_to_chat_enabled(h: &Harness) -> Option<bool> {
        h.service
            .snapshot()
            .and_then(|p| p.snapshot.speak_to_chat)
            .map(|s| s.enabled)
    }

    fn all_states_since(h: &Harness, from: usize) -> Vec<(ConnState, Option<FailureReason>)> {
        h.sink.statuses.lock().unwrap()[from..]
            .iter()
            .map(|s| (s.state, s.reason))
            .collect()
    }

    #[test]
    fn xm4_speak_to_chat_notify_libmdr_cannot_parse_does_not_drop_the_link() {
        // After every Speak-to-Chat change the XM4 also sends
        // SYSTEM_NTFY_PARAM [f9 05 02 00] (PREVIEW_MODE_ON_OFF), which libmdr
        // 4c91fe6 rejects as malformed. The app used to treat that as a lost link.
        let on_tx = payload(&toggle("stc-on-01-tx.cmd-SYSTEM_SET_PARAM-f8.bin"));
        let off_tx = payload(&toggle("stc-off-01-tx.cmd-SYSTEM_SET_PARAM-f8.bin"));
        let replies = vec![
            (
                on_tx.clone(),
                replies_of(&[
                    "stc-on-02-rx.cmd-SYSTEM_NTFY_PARAM-f9.bin",
                    "stc-on-03-rx.cmd-SYSTEM_NTFY_PARAM-f9.bin",
                ]),
            ),
            (
                off_tx.clone(),
                replies_of(&[
                    "stc-off-02-rx.cmd-SYSTEM_NTFY_PARAM-f9.bin",
                    "stc-off-03-rx.cmd-SYSTEM_NTFY_PARAM-f9.bin",
                ]),
            ),
        ];
        let h = start_capture(xm4_dir(), "WH-1000XM4", Protocol::V1, replies);
        let from = h.ready_and_armed();
        let statuses_from = h.sink.statuses.lock().unwrap().len();
        let current = h
            .service
            .snapshot()
            .and_then(|p| p.snapshot.speak_to_chat)
            .expect("the XM4 reports Speak-to-Chat");
        assert!(!current.enabled, "the capture has Speak-to-Chat off");
        let set = |enabled| EngineCommand::SetSpeakToChat {
            enabled,
            sensitivity: current.sensitivity,
            timeout: current.timeout,
        };

        h.service.send(set(true)).unwrap();
        wait_for("the on notify", || speak_to_chat_enabled(&h) == Some(true));
        // The unparsable frame follows the notify; the next change must still work.
        h.service.send(set(false)).unwrap();
        wait_for("the off notify", || {
            speak_to_chat_enabled(&h) == Some(false)
        });

        assert_eq!(data_payloads(&h.tx_since(from)), vec![on_tx, off_tx]);
        assert!(
            all_states_since(&h, statuses_from).is_empty(),
            "the link never dropped"
        );
        assert_eq!(h.service.status().state, ConnState::Ready);
        // One connection is two connect calls (the XM5 UUID is refused first).
        assert_eq!(
            h.connects.lock().unwrap().len(),
            2,
            "no reconnect was needed"
        );
    }

    #[test]
    fn xm4_dsee_toggle_sends_one_audio_set_param_and_keeps_the_link() {
        let off_tx = payload(&toggle("dsee-off-01-tx.cmd-AUDIO_SET_PARAM-e8.bin"));
        let replies = vec![(
            off_tx.clone(),
            replies_of(&[
                "dsee-off-02-rx.cmd-AUDIO_NTFY_PARAM-e9.bin",
                "dsee-off-03-rx.cmd-COMMON_NTFY_UPSCALING_EFFECT-17.bin",
            ]),
        )];
        let h = start_capture(xm4_dir(), "WH-1000XM4", Protocol::V1, replies);
        let from = h.ready_and_armed();
        let dsee = |h: &Harness| {
            h.service
                .snapshot()
                .and_then(|p| p.snapshot.equalizer)
                .map(|e| e.dsee_enabled)
        };
        assert_eq!(dsee(&h), Some(true), "the capture has DSEE on");
        h.service
            .send(EngineCommand::SetDsee { enabled: false })
            .unwrap();
        wait_for("the DSEE notify", || dsee(&h) == Some(false));
        std::thread::sleep(Duration::from_millis(50));
        // Only AUDIO_SET_PARAM UPSCALING: no EQ block, no alert answer.
        assert_eq!(data_payloads(&h.tx_since(from)), vec![off_tx]);
        assert!(h.sink.alerts.lock().unwrap().is_empty());
        assert_eq!(h.service.status().state, ConnState::Ready);
    }

    #[test]
    fn connection_mode_change_waits_for_the_users_confirmation() {
        let h = xm4();
        let from = h.ready_and_armed();
        let quality = EngineCommand::SetConnectionMode {
            audio_priority: AudioPriority::Quality,
        };
        h.service.send(quality.clone()).unwrap();
        wait_for("the confirmation alert", || {
            !h.sink.alerts.lock().unwrap().is_empty()
        });
        let alert = h.sink.alerts.lock().unwrap()[0].clone();
        assert_eq!(
            serde_json::to_value(&alert).unwrap(),
            serde_json::json!({
                "message": CONFIRM_CONNECTION_MODE_ALERT,
                "autoResponse": null,
                "requiresChoice": true,
            })
        );
        std::thread::sleep(Duration::from_millis(50));
        assert!(
            data_payloads(&h.tx_since(from)).is_empty(),
            "nothing sent before the answer"
        );

        // "Not now" sends nothing and republishes the device's state, which
        // undoes the renderer's optimistic change.
        let snapshots = h.sink.snapshots.lock().unwrap().len();
        h.service
            .send(EngineCommand::RespondToAlert { positive: false })
            .unwrap();
        wait_for("a republished snapshot", || {
            h.sink.snapshots.lock().unwrap().len() > snapshots
        });
        std::thread::sleep(Duration::from_millis(50));
        assert!(
            data_payloads(&h.tx_since(from)).is_empty(),
            "declined: nothing sent"
        );
        assert_eq!(
            h.service
                .snapshot()
                .and_then(|p| p.snapshot.connection_mode)
                .map(|c| c.audio_priority),
            Some(AudioPriority::Stability)
        );

        // Choosing the current mode needs no confirmation (and sends nothing).
        h.service
            .send(EngineCommand::SetConnectionMode {
                audio_priority: AudioPriority::Stability,
            })
            .unwrap();
        std::thread::sleep(Duration::from_millis(50));
        assert_eq!(h.sink.alerts.lock().unwrap().len(), 1);

        h.service.send(quality).unwrap();
        wait_for("the second alert", || {
            h.sink.alerts.lock().unwrap().len() == 2
        });
        h.service
            .send(EngineCommand::RespondToAlert { positive: true })
            .unwrap();
        wait_for("the change", || {
            !data_payloads(&h.tx_since(from)).is_empty()
        });
        assert_eq!(
            data_payloads(&h.tx_since(from)),
            vec![payload(&toggle(
                "cm-quality-01-tx.cmd-AUDIO_SET_PARAM-e8.bin"
            ))]
        );
    }

    /// The XM4 in the capture, connected by hand (auto-connect off), whose link
    /// the device closes after the connection-quality change to "quality".
    fn xm4_closing_after_connection_mode(recovery_window: Duration) -> Harness {
        let tx = payload(&toggle("cm-quality-01-tx.cmd-AUDIO_SET_PARAM-e8.bin"));
        let h = start_setup(Setup {
            auto_connect: false,
            replies: vec![(
                tx.clone(),
                toggle("cm-quality-02-rx.cmd-AUDIO_NTFY_PARAM-e9.bin"),
            )],
            close_after: Some(tx),
            recovery_window,
            ..Setup::xm4()
        });
        h.service
            .send(EngineCommand::Connect {
                address: XM3_ADDRESS.into(),
            })
            .unwrap();
        h
    }

    fn change_connection_mode_confirmed(h: &Harness) {
        h.service
            .send(EngineCommand::SetConnectionMode {
                audio_priority: AudioPriority::Quality,
            })
            .unwrap();
        wait_for("the confirmation alert", || {
            !h.sink.alerts.lock().unwrap().is_empty()
        });
        h.service
            .send(EngineCommand::RespondToAlert { positive: true })
            .unwrap();
    }

    #[test]
    fn drop_after_a_connection_mode_change_reconnects_even_with_auto_connect_off() {
        let h = xm4_closing_after_connection_mode(Duration::from_secs(20));
        h.ready_and_armed();
        let statuses_from = h.sink.statuses.lock().unwrap().len();
        let connects = h.connects.lock().unwrap().len();
        change_connection_mode_confirmed(&h);
        wait_for("the drop", || h.service.status().state != ConnState::Ready);
        wait_for("Ready again", || {
            h.service.status().state == ConnState::Ready
        });

        let seen = all_states_since(&h, statuses_from);
        let reconnecting = Some(FailureReason::ReconnectingAfterSettingChange);
        assert!(
            !seen.iter().any(|(s, _)| *s == ConnState::Disconnected),
            "never shown as disconnected: {seen:?}"
        );
        assert_eq!(
            seen.first(),
            Some(&(ConnState::Connecting, reconnecting)),
            "{seen:?}"
        );
        assert!(
            seen.contains(&(ConnState::Initialising, reconnecting)),
            "{seen:?}"
        );
        assert_eq!(seen.last(), Some(&(ConnState::Ready, None)), "{seen:?}");
        let json = serde_json::to_value(&h.sink.statuses.lock().unwrap()[statuses_from]).unwrap();
        assert_eq!(json["state"], "connecting");
        assert_eq!(json["reason"], "reconnectingAfterSettingChange");
        assert_eq!(json["address"], XM3_ADDRESS);
        // One reconnect: the XM5 UUID refused, then the legacy one.
        assert_eq!(
            h.connects.lock().unwrap().len(),
            connects + 2,
            "one reconnect"
        );
    }

    #[test]
    fn no_reconnect_within_the_window_ends_disconnected_with_timeout() {
        let h = xm4_closing_after_connection_mode(Duration::from_millis(300));
        h.ready_and_armed();
        h.refuse.store(true, std::sync::atomic::Ordering::SeqCst);
        change_connection_mode_confirmed(&h);
        wait_for("Disconnected", || {
            h.service.status().state == ConnState::Disconnected
        });
        let s = h.service.status();
        assert_eq!(s.reason, Some(FailureReason::Timeout), "{s:?}");
        assert!(h.connects.lock().unwrap().len() > 4, "it kept trying");
        let tries = h.connects.lock().unwrap().len();
        std::thread::sleep(Duration::from_millis(100));
        assert_eq!(
            h.connects.lock().unwrap().len(),
            tries,
            "then stopped (autoConnect off)"
        );
    }

    #[test]
    fn re_picking_the_current_mode_withdraws_the_pending_confirmation() {
        let h = xm4();
        let from = h.ready_and_armed();
        h.service
            .send(EngineCommand::SetConnectionMode {
                audio_priority: AudioPriority::Quality,
            })
            .unwrap();
        wait_for("the confirmation alert", || {
            !h.sink.alerts.lock().unwrap().is_empty()
        });
        // The user changes their mind before answering: back to the current mode.
        h.service
            .send(EngineCommand::SetConnectionMode {
                audio_priority: AudioPriority::Stability,
            })
            .unwrap();
        // A late "OK" on the stale banner must not apply "quality".
        h.service
            .send(EngineCommand::RespondToAlert { positive: true })
            .unwrap();
        std::thread::sleep(Duration::from_millis(150));
        let quality = payload(&toggle("cm-quality-01-tx.cmd-AUDIO_SET_PARAM-e8.bin"));
        assert!(
            !data_payloads(&h.tx_since(from)).contains(&quality),
            "the withdrawn choice was not sent"
        );
        assert_eq!(h.service.status().state, ConnState::Ready);
    }

    #[test]
    fn forgetting_another_device_does_not_cancel_the_recovery() {
        let h = xm4_closing_after_connection_mode(Duration::from_secs(20));
        h.ready_and_armed();
        h.refuse.store(true, std::sync::atomic::Ordering::SeqCst);
        change_connection_mode_confirmed(&h);
        wait_for("Connecting", || {
            h.service.status().state == ConnState::Connecting
        });
        h.service
            .send(EngineCommand::ForgetDevice {
                address: "00:11:22:33:44:55".into(),
            })
            .unwrap();
        h.refuse.store(false, std::sync::atomic::Ordering::SeqCst);
        wait_for("Ready again", || {
            h.service.status().state == ConnState::Ready
        });
        assert_eq!(h.service.status().reason, None);
    }

    #[test]
    fn forgetting_the_recovering_device_ends_disconnected() {
        let h = xm4_closing_after_connection_mode(Duration::from_secs(20));
        h.ready_and_armed();
        h.refuse.store(true, std::sync::atomic::Ordering::SeqCst);
        change_connection_mode_confirmed(&h);
        wait_for("Connecting", || {
            h.service.status().state == ConnState::Connecting
        });
        h.service
            .send(EngineCommand::ForgetDevice {
                address: XM3_ADDRESS.into(),
            })
            .unwrap();
        wait_for("Disconnected", || {
            h.service.status().state == ConnState::Disconnected
        });
        let tries = h.connects.lock().unwrap().len();
        std::thread::sleep(Duration::from_millis(300));
        assert_eq!(h.service.status().state, ConnState::Disconnected);
        assert_eq!(h.connects.lock().unwrap().len(), tries, "no more attempts");
    }

    #[test]
    fn a_drop_without_a_setting_change_does_not_reconnect_with_auto_connect_off() {
        // Pairing mode is not a setting that restarts the links.
        let h = start_setup(Setup {
            auto_connect: false,
            close_after: Some(vec![0x34, 0x01, 0x01, 0x00]),
            ..Setup::xm4()
        });
        h.service
            .send(EngineCommand::Connect {
                address: XM3_ADDRESS.into(),
            })
            .unwrap();
        h.ready_and_armed();
        h.service
            .send(EngineCommand::SetPairing { enabled: true })
            .unwrap();
        wait_for("Disconnected", || {
            h.service.status().state == ConnState::Disconnected
        });
        std::thread::sleep(Duration::from_millis(100));
        assert_eq!(h.service.status().state, ConnState::Disconnected);
        assert_eq!(h.service.status().reason, None);
        assert_eq!(h.connects.lock().unwrap().len(), 2, "no reconnect");
    }
}
