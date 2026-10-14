//! Live probe for settings that can drop the headset's links (DSEE / upscaling,
//! Speak-to-Chat, connection quality). Connects over RFCOMM, initialises and
//! syncs like the app's engine service, then applies each scripted action,
//! commits it and watches the link: every TX/RX frame, every engine event,
//! every alert (answered per `--alert`), and whether the RFCOMM read fails.
//! After a drop it lists what Windows still has connected once a second and
//! reconnects when it can, so the time the device needs to come back is logged.
//!
//! `cargo run -p mdr --example toggle_probe -- AA:BB:CC:12:34:56 [--v2]
//!     [--alert negative|positive|none] [--watch 12] [--tolerate-malformed] dsee:on dsee:off stc:on
//!     stc:off cm:stability cm:quality`
//!
//! Evidence written with it: `docs/core/evidence/toggle-dropouts-debug.md`.

#[cfg(windows)]
fn main() {
    use mdr::*;
    use std::time::{Duration, Instant};

    let args: Vec<String> = std::env::args().skip(1).collect();
    let mac = args
        .first()
        .expect("usage: toggle_probe MAC [options] actions...")
        .clone();
    let protocol = if args.iter().any(|a| a == "--v2") {
        Protocol::V2
    } else {
        Protocol::V1
    };
    let opt = |name: &str| {
        args.iter()
            .position(|a| a == name)
            .and_then(|i| args.get(i + 1).cloned())
    };
    let alert_policy = opt("--alert").unwrap_or_else(|| "none".into());
    let watch = Duration::from_secs(opt("--watch").and_then(|s| s.parse().ok()).unwrap_or(12));
    let actions: Vec<String> = args
        .iter()
        .skip(1)
        .filter(|a| a.contains(':'))
        .cloned()
        .collect();

    T0.get_or_init(Instant::now);

    let connect = || -> Option<Engine> {
        let mut t = WindowsTransport::new().expect("transport");
        let listed = t
            .devices()
            .map(|d| d.iter().any(|d| d.mac.eq_ignore_ascii_case(&mac)))
            .unwrap_or(false);
        if !listed {
            println!("{} windows does not list {mac} as connected", ts());
            return None;
        }
        match t.connect(&mac, protocol.service_uuid()) {
            Ok(ConnectStatus::Connected) => {}
            Ok(ConnectStatus::InProgress) => {
                let deadline = Instant::now() + Duration::from_secs(10);
                loop {
                    match t.poll(100) {
                        Ok(PollStatus::Ready) => break,
                        Ok(_) if Instant::now() < deadline => {}
                        other => {
                            println!("{} rfcomm connect failed: {other:?}", ts());
                            return None;
                        }
                    }
                }
            }
            Err(e) => {
                println!("{} rfcomm connect failed: {e}", ts());
                return None;
            }
        }
        let mut e = Engine::create(Box::new(t), protocol).expect("engine");
        e.set_packet_callback(Some(Box::new(move |dir, frame| {
            println!("{} packet: {}", ts(), packet::describe_frame(dir, frame));
        })));
        e.request_init().expect("init");
        let deadline = Instant::now() + Duration::from_secs(30);
        let mut synced = false;
        while !synced && Instant::now() < deadline {
            match e.poll() {
                Ok(Event::InitializeComplete) => e.request_sync().expect("sync"),
                Ok(Event::SyncComplete) => synced = true,
                Ok(Event::None) => std::thread::sleep(Duration::from_millis(16)),
                Ok(_) => {}
                Err(err) => {
                    println!("{} init failed: {err}", ts());
                    return None;
                }
            }
        }
        println!("{} ready={synced}", ts());
        synced.then_some(e)
    };

    let state = |e: &Engine| {
        format!(
            "dsee={:?} stc={:?} connectionMode={:?}",
            e.equalizer().map(|q| q.dsee_enabled).ok(),
            e.speak_to_chat().map(|s| s.enabled).ok(),
            e.connection_mode().map(|c| c.audio_priority).ok()
        )
    };

    let mut engine = connect().expect("initial connect");
    println!("{} state {}", ts(), state(&engine));

    for action in &actions {
        println!(
            "\n{} ===== action {action} (alert policy {alert_policy}) =====",
            ts()
        );
        let staged = match action.as_str() {
            "dsee:on" | "dsee:off" => engine.equalizer().and_then(|mut q| {
                q.dsee_enabled = action.ends_with("on");
                engine.set_equalizer(&q)
            }),
            "stc:on" | "stc:off" => engine.speak_to_chat().and_then(|mut s| {
                s.enabled = action.ends_with("on");
                engine.set_speak_to_chat(&s)
            }),
            "cm:quality" | "cm:stability" => engine.set_connection_mode(&ConnectionMode {
                audio_priority: if action.ends_with("quality") {
                    AudioPriority::Quality
                } else {
                    AudioPriority::Stability
                },
            }),
            other => panic!("unknown action {other}"),
        };
        println!("{} staged {staged:?} dirty={}", ts(), engine.is_dirty());
        let mut committed = false;
        let end = Instant::now() + watch;
        let mut lost = false;
        while Instant::now() < end {
            if !committed && engine.is_ready() {
                match engine.commit() {
                    Ok(()) => {
                        committed = true;
                        println!("{} commit requested", ts());
                    }
                    Err(e) if e.is_in_progress() => {}
                    Err(e) => {
                        println!("{} commit failed: {e}", ts());
                        committed = true;
                    }
                }
            }
            match engine.poll() {
                Ok(Event::None) => std::thread::sleep(Duration::from_millis(16)),
                Ok(Event::Alert) => {
                    let msg = engine.last_alert().unwrap_or_default();
                    println!("{} EVENT Alert message={msg}", ts());
                    let answer = match alert_policy.as_str() {
                        "negative" => Some(AlertAction::Negative),
                        "positive" => Some(AlertAction::Positive),
                        _ => None,
                    };
                    if let Some(a) = answer {
                        while !engine.is_ready() {
                            let _ = engine.poll();
                            std::thread::sleep(Duration::from_millis(5));
                        }
                        println!("{} answering {a:?}: {:?}", ts(), engine.respond_to_alert(a));
                    }
                }
                Ok(Event::NeedSync) => {
                    println!("{} EVENT NeedSync", ts());
                    while !engine.is_ready() {
                        let _ = engine.poll();
                        std::thread::sleep(Duration::from_millis(5));
                    }
                    let _ = engine.request_sync();
                }
                Ok(ev) => println!("{} EVENT {ev:?} -> {}", ts(), state(&engine)),
                Err(e)
                    if e.is_malformed_payload()
                        && args.iter().any(|a| a == "--tolerate-malformed") =>
                {
                    println!("{} UNPARSED FRAME (link kept): {e}", ts());
                }
                Err(e) => {
                    println!("{} LINK LOST (poll error): {e}", ts());
                    lost = true;
                    break;
                }
            }
        }
        println!(
            "{} after {action}: lost={lost} state {}",
            ts(),
            state(&engine)
        );
        if lost {
            drop(engine);
            let mut back = None;
            let deadline = Instant::now() + Duration::from_secs(60);
            while back.is_none() && Instant::now() < deadline {
                let mut t = WindowsTransport::new().expect("transport");
                let listed = t
                    .devices()
                    .map(|d| d.iter().any(|d| d.mac.eq_ignore_ascii_case(&mac)))
                    .unwrap_or(false);
                println!("{} windows lists {mac}: {listed}", ts());
                if listed {
                    back = connect();
                }
                if back.is_none() {
                    std::thread::sleep(Duration::from_secs(1));
                }
            }
            match back {
                Some(e) => {
                    engine = e;
                    println!("{} RECONNECTED state {}", ts(), state(&engine));
                }
                None => {
                    println!("{} did not come back within 60 s", ts());
                    return;
                }
            }
        }
    }
}

#[cfg(windows)]
static T0: std::sync::OnceLock<std::time::Instant> = std::sync::OnceLock::new();

/// Seconds since the probe started (every line carries it).
#[cfg(windows)]
fn ts() -> String {
    let t0 = T0.get_or_init(std::time::Instant::now);
    format!("{:8.3}", t0.elapsed().as_secs_f64())
}

#[cfg(not(windows))]
fn main() {
    eprintln!("the Windows RFCOMM transport is only available on Windows");
}
