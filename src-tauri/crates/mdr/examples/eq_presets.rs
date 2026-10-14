//! Records each equalizer preset's band curve from real headphones and writes
//! the renderer fixture `tests/fixtures/eq-presets/<model>-<firmware>.json`.
//!
//! `cargo run -p mdr --example eq_presets -- AA:BB:CC:12:34:56 [out.json]`
//! (from `src-tauri/`; the app must not be running, it holds the RFCOMM channel).
//!
//! Sequence (as `src-tauri/src/engine_service.rs`): RFCOMM connect (V2 UUID, then
//! V1), `Engine::create`, `request_init`, `request_sync` on `InitializeComplete`,
//! Ready on `SyncComplete`. Then per advertised preset: `set_equalizer{preset}` +
//! `commit`, poll until the equalizer reports that preset, read `bands` and
//! `clear_bass`, wait 1 s. Finally the original preset (and, for a custom/user
//! preset, its bands) is restored. The `DISCONNECT_CAUSED_BY_CONNECTION_MODE_CHANGE`
//! alert is answered NEGATIVE, like the service.

#[cfg(windows)]
mod live {
    use mdr::{
        AlertAction, ConnectStatus, Engine, EqualizerPresetId, Event, PollStatus, Protocol,
        Transport, WindowsTransport,
    };
    use std::time::{Duration, Instant};

    const AUTO_DECLINED_ALERT: &str = "DISCONNECT_CAUSED_BY_CONNECTION_MODE_CHANGE";

    /// Upstream's English names (`src/lib/engine/ids.ts` `presetNames`, from
    /// client/I18N/Default.cpp); the XM4 advertises its presets without names.
    fn upstream_name(id: EqualizerPresetId) -> String {
        use EqualizerPresetId::*;
        match id {
            Off => "Off",
            Rock => "Rock",
            Pop => "Pop",
            Jazz => "Jazz",
            Dance => "Dance",
            Edm => "EDM",
            RAndBHipHop => "R&B/Hip-Hop",
            Acoustic => "Acoustic",
            Bright => "Bright",
            Excited => "Excited",
            Mellow => "Mellow",
            Relaxed => "Relaxed",
            Vocal => "Vocal",
            Treble => "Treble",
            Bass => "Bass",
            Speech => "Speech",
            Heavy => "Heavy",
            Clear => "Clear",
            Hard => "Hard",
            Soft => "Soft",
            Gaming => "Gaming",
            Fps1 => "FPS 1",
            Fps2 => "FPS 2",
            Fps3 => "FPS 3",
            Custom => "Custom",
            User1 => "User Setting 1",
            User2 => "User Setting 2",
            User3 => "User Setting 3",
            User4 => "User Setting 4",
            User5 => "User Setting 5",
            _ => return format!("{id:?}"),
        }
        .to_string()
    }

    fn connect(mac: &str) -> (Box<dyn Transport>, Protocol) {
        for protocol in [Protocol::V2, Protocol::V1] {
            let mut t = WindowsTransport::new().expect("mdrConnectionWindowsCreate");
            let uuid = protocol.service_uuid();
            eprintln!("connect {mac} {protocol:?} {uuid}");
            let ok = match t.connect(mac, uuid) {
                Ok(ConnectStatus::Connected) => true,
                Ok(ConnectStatus::InProgress) => {
                    let deadline = Instant::now() + Duration::from_secs(10);
                    let mut ok = false;
                    while Instant::now() < deadline {
                        match t.poll(100) {
                            Ok(PollStatus::Ready) => {
                                ok = true;
                                break;
                            }
                            Ok(_) => {}
                            Err(e) => {
                                eprintln!("  poll failed: {e}");
                                break;
                            }
                        }
                    }
                    ok
                }
                Err(e) => {
                    eprintln!("  connect failed: {e}");
                    false
                }
            };
            if ok {
                return (Box::new(t), protocol);
            }
            t.disconnect();
        }
        panic!("no service UUID answered on {mac}");
    }

    /// Polls the engine (answering init/sync/alerts) until `done` or `timeout`.
    fn pump(
        e: &mut Engine,
        timeout: Duration,
        mut done: impl FnMut(&Engine, Event) -> bool,
    ) -> bool {
        let deadline = Instant::now() + timeout;
        let mut need_sync = false;
        let mut alert: Option<AlertAction> = None;
        while Instant::now() < deadline {
            let ev = e.poll().expect("mdrHeadphonesPoll");
            match ev {
                Event::InitializeComplete => e.request_sync().expect("request_sync"),
                Event::NeedSync => need_sync = true,
                Event::Alert => {
                    let message = e.last_alert().unwrap_or_default();
                    eprintln!("  alert {message}");
                    if message == AUTO_DECLINED_ALERT {
                        alert = Some(AlertAction::Negative);
                    }
                }
                _ => {}
            }
            if need_sync && e.is_ready() && e.request_sync().is_ok() {
                need_sync = false;
            }
            if let Some(a) = alert {
                if e.is_ready() && e.respond_to_alert(a).is_ok() {
                    alert = None;
                }
            }
            if done(e, ev) {
                return true;
            }
            if ev == Event::None {
                std::thread::sleep(Duration::from_millis(20));
            }
        }
        false
    }

    fn wait_ready(e: &mut Engine) {
        assert!(
            pump(e, Duration::from_secs(15), |e, _| e.is_ready()),
            "engine never became ready"
        );
    }

    /// Stages `preset` (keeping DSEE and Clear Bass as reported), commits, and
    /// waits until the device reports it back.
    fn select(e: &mut Engine, preset: EqualizerPresetId) -> mdr::Equalizer {
        wait_ready(e);
        let mut eq = e.equalizer().expect("equalizer");
        eq.preset = preset;
        e.set_equalizer(&eq).expect("set_equalizer");
        e.commit().expect("commit");
        let ok = pump(e, Duration::from_secs(8), |e, ev| {
            ev == Event::None
                && e.is_ready()
                && e.equalizer().map(|q| q.preset == preset).unwrap_or(false)
        });
        assert!(ok, "device never reported preset {preset:?}");
        // Let any trailing band notification land before reading.
        pump(e, Duration::from_millis(400), |_, _| false);
        e.equalizer().expect("equalizer")
    }

    pub fn run(mac: &str, out: Option<&str>) {
        let (transport, protocol) = connect(mac);
        let mut e = Engine::create(transport, protocol).expect("Engine::create");
        e.request_init().expect("request_init");
        assert!(
            pump(&mut e, Duration::from_secs(20), |_, ev| ev
                == Event::SyncComplete),
            "sync never completed"
        );
        wait_ready(&mut e);
        let model = e.model_name().unwrap_or_default();
        let firmware = e.firmware_version().unwrap_or_default();
        let original = e.equalizer().expect("equalizer");
        let presets = e.equalizer_presets().expect("equalizer_presets");
        eprintln!(
            "{model} {firmware}: {} presets, original {:?} bands {:?} clearBass {}",
            presets.len(),
            original.preset,
            original.bands,
            original.clear_bass
        );

        let mut rows = Vec::new();
        for p in &presets {
            let eq = select(&mut e, p.id);
            let name = if p.name.is_empty() {
                upstream_name(p.id)
            } else {
                p.name.clone()
            };
            eprintln!("{:<14} {:?} clearBass {}", name, eq.bands, eq.clear_bass);
            rows.push(serde_json::json!({
                "id": p.id,
                "name": name,
                "bands": eq.bands,
                "clearBass": eq.clear_bass,
            }));
            std::thread::sleep(Duration::from_secs(1));
        }

        // Restore.
        let back = select(&mut e, original.preset);
        if back.bands != original.bands || back.clear_bass != original.clear_bass {
            wait_ready(&mut e);
            let mut eq = e.equalizer().expect("equalizer");
            eq.clear_bass = original.clear_bass;
            e.set_equalizer(&eq).expect("set_equalizer");
            e.set_equalizer_bands(&original.bands)
                .expect("set_equalizer_bands");
            e.commit().expect("commit");
            pump(&mut e, Duration::from_secs(3), |_, _| false);
        }
        let now = e.equalizer().expect("equalizer");
        eprintln!(
            "restored {:?} bands {:?} clearBass {}",
            now.preset, now.bands, now.clear_bass
        );

        let doc = serde_json::json!({
            "model": model,
            "firmware": firmware,
            "bandLabels": ["400", "1k", "2.5k", "6.3k", "16k"],
            "bandRange": [-10, 10],
            "clearBassRange": [-10, 10],
            "presets": rows,
        });
        let text = serde_json::to_string_pretty(&doc).unwrap() + "\n";
        match out {
            Some(path) => std::fs::write(path, text).expect("write fixture"),
            None => print!("{text}"),
        }
    }
}

#[cfg(windows)]
fn main() {
    let args: Vec<String> = std::env::args().collect();
    let mac = args.get(1).expect("usage: eq_presets <MAC> [out.json]");
    live::run(mac, args.get(2).map(String::as_str));
}

#[cfg(not(windows))]
fn main() {
    eprintln!("the Windows RFCOMM transport is only available on Windows");
}
