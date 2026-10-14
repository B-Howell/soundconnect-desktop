//! The notification-area icon: a tooltip with the headphones' name, battery and
//! noise mode, and a menu for quick noise control, showing the window and
//! quitting.
//!
//! [`TraySink`] sits between the engine service and [`TauriSink`]: it forwards
//! every call to the window events unchanged and, from the same status and
//! snapshot, keeps the tooltip and the menu current. The menu is rebuilt only
//! when its model ([`noise_menu_model`]) changes. Labels match the renderer's
//! `src/components/noise/noiseModes.ts`.

use std::sync::{Arc, Mutex};

use mdr::{Battery, BatteryPart};
use tauri::menu::{CheckMenuItem, IsMenuItem, Menu, MenuEvent, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Wry};

use crate::commands::TauriSink;
use crate::engine_service::{
    AlertView, ConnState, DevicesView, EngineCommand, EngineService, FailureReason,
    SnapshotPayload, SnapshotSink, StatusView,
};
use crate::noise_view::{NoiseView, NoiseViewMode};

/// Id of the one tray icon.
pub const TRAY_ID: &str = "main";
const SHOW_ID: &str = "show";
const QUIT_ID: &str = "quit";
const NOISE_ID_PREFIX: &str = "noise:";
/// Windows truncates notification-icon tooltips at 127 characters.
const TOOLTIP_MAX_CHARS: usize = 127;
const APP_NAME: &str = "SoundConnect";

/// The renderer's segment label for a noise mode.
pub fn noise_label(mode: NoiseViewMode) -> &'static str {
    match mode {
        NoiseViewMode::Cancelling => "Noise cancelling",
        NoiseViewMode::Wind => "Wind",
        NoiseViewMode::Ambient => "Ambient",
        NoiseViewMode::Off => "Off",
    }
}

/// The noise mode as a tooltip phrase (a bare "Off" would be ambiguous there).
fn noise_phrase(mode: NoiseViewMode) -> &'static str {
    match mode {
        NoiseViewMode::Cancelling => "Noise cancelling",
        NoiseViewMode::Wind => "Wind noise reduction",
        NoiseViewMode::Ambient => "Ambient sound",
        NoiseViewMode::Off => "Noise control off",
    }
}

fn mode_id(mode: NoiseViewMode) -> &'static str {
    match mode {
        NoiseViewMode::Cancelling => "cancelling",
        NoiseViewMode::Wind => "wind",
        NoiseViewMode::Ambient => "ambient",
        NoiseViewMode::Off => "off",
    }
}

fn mode_from_id(id: &str) -> Option<NoiseViewMode> {
    [
        NoiseViewMode::Cancelling,
        NoiseViewMode::Wind,
        NoiseViewMode::Ambient,
        NoiseViewMode::Off,
    ]
    .into_iter()
    .find(|m| mode_id(*m) == id)
}

/// One noise check item in the tray menu.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct NoiseMenuItem {
    pub mode: NoiseViewMode,
    pub label: &'static str,
    pub checked: bool,
}

/// The noise items for `view`, in the renderer's order (cancelling, wind,
/// ambient, off), without the modes the device lacks; Off is always offered.
/// Empty when there is no noise view (not connected, or no noise control).
pub fn noise_menu_model(view: Option<&NoiseView>) -> Vec<NoiseMenuItem> {
    let Some(v) = view else {
        return Vec::new();
    };
    [
        (NoiseViewMode::Cancelling, v.can_cancel),
        (NoiseViewMode::Wind, v.can_wind),
        (NoiseViewMode::Ambient, v.can_ambient),
        (NoiseViewMode::Off, true),
    ]
    .into_iter()
    .filter(|(_, offered)| *offered)
    .map(|(mode, _)| NoiseMenuItem {
        mode,
        label: noise_label(mode),
        checked: v.mode == mode,
    })
    .collect()
}

/// What the tooltip says, taken from the latest status and snapshot.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TraySummary {
    pub state: ConnState,
    pub device_name: Option<String>,
    pub battery_percent: Option<u8>,
    pub noise: Option<NoiseViewMode>,
    /// Headphones are remembered (set up).
    pub remembered: bool,
    /// Windows lists the remembered headphones as connected.
    pub windows_connected: bool,
    pub reason: Option<FailureReason>,
    /// The status carries an error message (with nothing remembered, a failure even without a reason).
    pub last_error: bool,
    /// The `autoConnect` setting ("Ready to connect" only shows with it off).
    pub auto_connect: bool,
}

impl TraySummary {
    pub fn from_views(status: &StatusView, payload: Option<&SnapshotPayload>) -> Self {
        let snapshot = payload.map(|p| &p.snapshot);
        Self {
            state: status.state,
            device_name: snapshot
                .and_then(|s| s.texts.model_name.clone())
                .filter(|n| !n.is_empty())
                .or_else(|| status.device_name.clone()),
            battery_percent: snapshot
                .and_then(|s| s.batteries.as_deref())
                .and_then(headset_battery),
            noise: payload.and_then(|p| p.noise_view).map(|v| v.mode),
            remembered: status.remembered.is_some(),
            windows_connected: status.windows_connected,
            reason: status.reason,
            last_error: status.last_error.is_some(),
            auto_connect: status.auto_connect,
        }
    }
}

/// The connection state in the renderer's words (`connectionCopy.ts` via
/// `toConnectionView`): one line, no advice. Ready is "Connected" (the menu's
/// idle line for a device without noise control; the tooltip shows the
/// device instead).
pub fn state_label(s: &TraySummary) -> &'static str {
    let listed = s.windows_connected && s.reason != Some(FailureReason::NotConnectedToWindows);
    match s.state {
        ConnState::Ready => "Connected",
        ConnState::Connecting | ConnState::Initialising => {
            if s.reason == Some(FailureReason::ReconnectingAfterSettingChange) {
                "Reconnecting…"
            } else {
                "Connecting…"
            }
        }
        ConnState::Discovering => {
            if !s.remembered {
                "No headphones set up"
            } else if listed {
                "Connecting…"
            } else {
                "Headphones off or disconnected"
            }
        }
        ConnState::Disconnected => {
            let attempt_failed = matches!(
                s.reason,
                Some(FailureReason::Busy | FailureReason::Timeout | FailureReason::Refused)
            );
            if (attempt_failed && listed) || (!s.remembered && (s.reason.is_some() || s.last_error))
            {
                "Connection failed"
            } else if !s.remembered {
                "No headphones set up"
            } else if listed && s.reason == Some(FailureReason::TakenOver) {
                "Another app has control"
            } else if listed && s.auto_connect {
                "Disconnected"
            } else if listed {
                "Ready to connect"
            } else {
                "Headphones off or disconnected"
            }
        }
    }
}

/// The headset's charge: the main battery, else the lower of the earbuds.
pub fn headset_battery(batteries: &[Battery]) -> Option<u8> {
    let present = |part: BatteryPart| {
        batteries
            .iter()
            .find(|b| b.part == part && b.present)
            .map(|b| b.level_percent)
    };
    present(BatteryPart::Main).or_else(|| {
        match (present(BatteryPart::Left), present(BatteryPart::Right)) {
            (Some(l), Some(r)) => Some(l.min(r)),
            (l, r) => l.or(r),
        }
    })
}

/// `WH-1000XM4 · 90% · Noise cancelling` when ready; otherwise the app name
/// and the connection state ([`state_label`]).
pub fn tooltip_text(s: &TraySummary) -> String {
    let device = s.device_name.as_deref().unwrap_or("Headphones");
    let text = match s.state {
        ConnState::Ready => {
            let mut parts = vec![device.to_string()];
            if let Some(b) = s.battery_percent {
                parts.push(format!("{b}%"));
            }
            if let Some(m) = s.noise {
                parts.push(noise_phrase(m).to_string());
            }
            parts.join(" · ")
        }
        _ => format!("{APP_NAME} · {}", state_label(s)),
    };
    text.chars().take(TOOLTIP_MAX_CHARS).collect()
}

/// The menu shown for `items`: the noise check items (or a disabled line with
/// the connection state, `idle`), a separator, "Show SoundConnect" and "Quit".
fn build_menu(app: &AppHandle, items: &[NoiseMenuItem], idle: &str) -> tauri::Result<Menu<Wry>> {
    let menu = Menu::new(app)?;
    if items.is_empty() {
        let idle = MenuItem::with_id(app, "idle", idle, false, None::<&str>)?;
        menu.append(&idle)?;
    }
    for item in items {
        let check = CheckMenuItem::with_id(
            app,
            format!("{NOISE_ID_PREFIX}{}", mode_id(item.mode)),
            item.label,
            true,
            item.checked,
            None::<&str>,
        )?;
        menu.append(&check)?;
    }
    let separator = PredefinedMenuItem::separator(app)?;
    let show = MenuItem::with_id(app, SHOW_ID, "Show SoundConnect", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, QUIT_ID, "Quit", true, None::<&str>)?;
    let rest: [&dyn IsMenuItem<Wry>; 3] = [&separator, &show, &quit];
    menu.append_items(&rest)?;
    Ok(menu)
}

fn on_menu_event(app: &AppHandle, event: MenuEvent) {
    let id = event.id().as_ref();
    match id {
        SHOW_ID => crate::show_main_window(app),
        QUIT_ID => {
            eprintln!("tray: quit");
            app.exit(0);
        }
        _ => {
            let Some(mode) = id.strip_prefix(NOISE_ID_PREFIX).and_then(mode_from_id) else {
                return;
            };
            eprintln!("tray: setNoise {mode:?}");
            if let Some(service) = app.try_state::<Arc<EngineService>>() {
                if let Err(e) = service.send(EngineCommand::SetNoise {
                    mode,
                    ambient_level: None,
                    focus_on_voice: None,
                }) {
                    eprintln!("tray: setNoise failed: {e}");
                }
            }
            // Clicking a check item toggles its check mark locally; put the menu
            // back to the device's state (a new snapshot corrects it again once
            // the change is applied). Off the menu-event (main) thread, because
            // rebuilding the menu waits on the main thread.
            if let Some(sink) = app.try_state::<Arc<TraySink>>() {
                let sink = sink.inner().clone();
                std::thread::spawn(move || sink.refresh(true));
            }
        }
    }
}

/// Creates the tray icon (app icon, tooltip "SoundConnect", "Connecting…" menu
/// until the first status).
/// Left click shows the window; right click opens the menu.
pub fn create(app: &AppHandle) -> tauri::Result<TrayIcon<Wry>> {
    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip(APP_NAME)
        .menu(&build_menu(app, &[], "Connecting…")?)
        .show_menu_on_left_click(false)
        .on_menu_event(on_menu_event)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                crate::show_main_window(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)
}

struct TrayState {
    status: StatusView,
    payload: Option<SnapshotPayload>,
    /// The applied menu model: noise items and the idle line.
    menu: Option<(Vec<NoiseMenuItem>, &'static str)>,
    tooltip: Option<String>,
}

/// The engine service's sink: forwards to [`TauriSink`] and keeps the tray
/// tooltip and menu in step with the same status and snapshots.
pub struct TraySink {
    inner: TauriSink,
    app: AppHandle,
    tray: TrayIcon<Wry>,
    state: Mutex<TrayState>,
    /// Held across a whole refresh (compute and apply), so two refreshes from
    /// different threads cannot apply their models out of order.
    apply: Mutex<()>,
}

impl TraySink {
    pub fn new(app: AppHandle, tray: TrayIcon<Wry>) -> Self {
        Self {
            inner: TauriSink::new(app.clone()),
            app,
            tray,
            state: Mutex::new(TrayState {
                status: StatusView::disconnected(None),
                payload: None,
                menu: None,
                tooltip: None,
            }),
            apply: Mutex::new(()),
        }
    }

    /// Applies the current model to the tray. `force` rebuilds the menu even
    /// when its model is unchanged (after a click toggled a check mark).
    ///
    /// Never call this on the main thread: tray calls post to the main thread
    /// and wait for it. The state lock is released before touching the tray
    /// (the sink's other methods take it); `apply` serialises whole refreshes,
    /// so a model computed earlier is never applied after a newer one.
    pub fn refresh(&self, force: bool) {
        let _apply = self.apply.lock().expect("tray apply lock");
        let (menu, tooltip) = {
            let mut st = self.state.lock().expect("tray lock");
            let payload = match st.status.state {
                ConnState::Ready => st.payload.as_ref(),
                _ => None,
            };
            let summary = TraySummary::from_views(&st.status, payload);
            let model = (
                noise_menu_model(payload.and_then(|p| p.noise_view.as_ref())),
                state_label(&summary),
            );
            let text = tooltip_text(&summary);
            let menu = (force || st.menu.as_ref() != Some(&model)).then(|| model.clone());
            let tooltip = (st.tooltip.as_ref() != Some(&text)).then(|| text.clone());
            st.menu = Some(model);
            st.tooltip = Some(text);
            (menu, tooltip)
        };
        if let Some(text) = tooltip {
            if let Err(e) = self.tray.set_tooltip(Some(&text)) {
                eprintln!("tray: set_tooltip failed: {e}");
            }
        }
        if let Some((items, idle)) = menu {
            match build_menu(&self.app, &items, idle) {
                Ok(m) => {
                    if let Err(e) = self.tray.set_menu(Some(m)) {
                        eprintln!("tray: set_menu failed: {e}");
                    }
                }
                Err(e) => eprintln!("tray: build menu failed: {e}"),
            }
        }
    }
}

impl SnapshotSink for TraySink {
    fn status(&self, status: &StatusView) {
        self.inner.status(status);
        {
            let mut st = self.state.lock().expect("tray lock");
            st.status = status.clone();
            if !matches!(status.state, ConnState::Ready | ConnState::Initialising) {
                // The service clears its snapshot on every disconnect.
                st.payload = None;
            }
        }
        self.refresh(false);
    }

    fn snapshot(&self, payload: &SnapshotPayload) {
        self.inner.snapshot(payload);
        self.state.lock().expect("tray lock").payload = Some(payload.clone());
        self.refresh(false);
    }

    fn alert(&self, alert: &AlertView) {
        self.inner.alert(alert);
    }

    fn devices(&self, devices: &DevicesView) {
        self.inner.devices(devices);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mdr::ChargingState;

    fn view(mode: NoiseViewMode, can_wind: bool) -> NoiseView {
        NoiseView {
            mode,
            ambient_level: 20,
            focus_on_voice: false,
            can_cancel: true,
            can_ambient: true,
            can_wind,
            can_focus_on_voice: true,
        }
    }

    fn labels(items: &[NoiseMenuItem]) -> Vec<(&str, bool)> {
        items.iter().map(|i| (i.label, i.checked)).collect()
    }

    #[test]
    fn menu_model_for_the_xm4_in_noise_cancelling() {
        let items = noise_menu_model(Some(&view(NoiseViewMode::Cancelling, true)));
        assert_eq!(
            labels(&items),
            [
                ("Noise cancelling", true),
                ("Wind", false),
                ("Ambient", false),
                ("Off", false)
            ]
        );
    }

    #[test]
    fn menu_model_omits_wind_without_can_wind_and_checks_the_mode() {
        let items = noise_menu_model(Some(&view(NoiseViewMode::Ambient, false)));
        assert_eq!(
            labels(&items),
            [
                ("Noise cancelling", false),
                ("Ambient", true),
                ("Off", false)
            ]
        );
    }

    #[test]
    fn menu_model_keeps_off_when_nothing_else_is_offered() {
        let mut v = view(NoiseViewMode::Off, false);
        v.can_cancel = false;
        v.can_ambient = false;
        assert_eq!(labels(&noise_menu_model(Some(&v))), [("Off", true)]);
        assert!(noise_menu_model(None).is_empty());
    }

    #[test]
    fn menu_ids_round_trip() {
        for m in [
            NoiseViewMode::Cancelling,
            NoiseViewMode::Wind,
            NoiseViewMode::Ambient,
            NoiseViewMode::Off,
        ] {
            assert_eq!(mode_from_id(mode_id(m)), Some(m));
        }
        assert_eq!(mode_from_id("loud"), None);
    }

    fn ready(name: &str, battery: Option<u8>, noise: Option<NoiseViewMode>) -> TraySummary {
        TraySummary {
            state: ConnState::Ready,
            device_name: Some(name.into()),
            battery_percent: battery,
            noise,
            remembered: true,
            windows_connected: true,
            reason: None,
            last_error: false,
            auto_connect: false,
        }
    }

    #[test]
    fn tooltip_when_ready() {
        assert_eq!(
            tooltip_text(&ready(
                "WH-1000XM4",
                Some(90),
                Some(NoiseViewMode::Cancelling)
            )),
            "WH-1000XM4 · 90% · Noise cancelling"
        );
        assert_eq!(
            tooltip_text(&ready("WH-1000XM4", None, Some(NoiseViewMode::Off))),
            "WH-1000XM4 · Noise control off"
        );
        assert_eq!(
            tooltip_text(&ready("WF-1000XM5", Some(5), None)),
            "WF-1000XM5 · 5%"
        );
    }

    #[test]
    fn tooltip_when_not_ready() {
        let mut s = ready("WH-1000XM4", None, None);
        s.state = ConnState::Connecting;
        assert_eq!(tooltip_text(&s), "SoundConnect · Connecting…");
        s.reason = Some(FailureReason::ReconnectingAfterSettingChange);
        assert_eq!(tooltip_text(&s), "SoundConnect · Reconnecting…");
        s.reason = None;
        s.state = ConnState::Disconnected;
        assert_eq!(tooltip_text(&s), "SoundConnect · Ready to connect");
        // "Ready to connect" only with auto-connect off.
        s.auto_connect = true;
        assert_eq!(tooltip_text(&s), "SoundConnect · Disconnected");
        s.reason = Some(FailureReason::TakenOver);
        assert_eq!(tooltip_text(&s), "SoundConnect · Another app has control");
        s.auto_connect = false;
        assert_eq!(tooltip_text(&s), "SoundConnect · Another app has control");
        s.reason = None;
        s.windows_connected = false;
        assert_eq!(
            tooltip_text(&s),
            "SoundConnect · Headphones off or disconnected"
        );
        s.state = ConnState::Discovering;
        assert_eq!(
            tooltip_text(&s),
            "SoundConnect · Headphones off or disconnected"
        );
        s.windows_connected = true;
        assert_eq!(tooltip_text(&s), "SoundConnect · Connecting…");
        s.state = ConnState::Disconnected;
        s.reason = Some(FailureReason::Busy);
        assert_eq!(tooltip_text(&s), "SoundConnect · Connection failed");
        s.reason = Some(FailureReason::NotConnectedToWindows);
        assert_eq!(
            tooltip_text(&s),
            "SoundConnect · Headphones off or disconnected"
        );
        s.reason = None;
        s.remembered = false;
        assert_eq!(tooltip_text(&s), "SoundConnect · No headphones set up");
        // Nothing remembered and only an error message: a failure, as in the window.
        s.last_error = true;
        assert_eq!(tooltip_text(&s), "SoundConnect · Connection failed");
        // Ready: the menu's idle line (a device without noise control) says Connected.
        s.state = ConnState::Ready;
        assert_eq!(state_label(&s), "Connected");
    }

    #[test]
    fn tooltip_is_capped_for_windows() {
        let s = ready(&"X".repeat(300), Some(90), None);
        assert_eq!(tooltip_text(&s).chars().count(), TOOLTIP_MAX_CHARS);
    }

    fn battery(part: BatteryPart, present: bool, level: u8) -> Battery {
        Battery {
            part,
            present,
            level_percent: level,
            update_threshold_percent: 255,
            charging: ChargingState::No,
        }
    }

    #[test]
    fn headset_battery_prefers_main_then_the_lower_earbud() {
        assert_eq!(
            headset_battery(&[battery(BatteryPart::Main, true, 90)]),
            Some(90)
        );
        assert_eq!(
            headset_battery(&[
                battery(BatteryPart::Left, true, 60),
                battery(BatteryPart::Right, true, 40),
                battery(BatteryPart::Case, true, 100),
            ]),
            Some(40)
        );
        assert_eq!(
            headset_battery(&[battery(BatteryPart::Main, false, 0)]),
            None
        );
        assert_eq!(headset_battery(&[]), None);
    }
}
