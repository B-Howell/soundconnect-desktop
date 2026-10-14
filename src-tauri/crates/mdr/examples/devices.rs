//! Prints the Bluetooth Classic devices Windows currently has connected, as the
//! upstream RFCOMM backend sees them (`MAC<TAB>name` per line).
//!
//! `cargo run -p mdr --example devices` (from `src-tauri/`).
//!
//! `cargo run -p mdr --example devices -- --probe AA:BB:CC:DD:EE:FF` also tries an
//! RFCOMM connect to that address on each service UUID (XM5 first, then legacy,
//! 10 s each, like upstream client/Client.cpp) and reports which one answered.

#[cfg(windows)]
fn main() {
    let mut t = mdr::WindowsTransport::new().expect("mdrConnectionWindowsCreate");
    match mdr::Transport::devices(&mut t) {
        Ok(devices) => {
            println!("{} connected device(s)", devices.len());
            for d in devices {
                println!("{}\t{}", d.mac, d.name);
            }
        }
        Err(e) => {
            eprintln!("device list failed: {e}");
            std::process::exit(1);
        }
    }
    let args: Vec<String> = std::env::args().collect();
    if let Some(i) = args.iter().position(|a| a == "--probe") {
        let mac = args.get(i + 1).expect("--probe needs an address");
        for protocol in [mdr::Protocol::V2, mdr::Protocol::V1] {
            println!("probe {mac} {protocol:?} {}", protocol.service_uuid());
            println!("  -> {}", probe(&mut t, mac, protocol.service_uuid()));
            mdr::Transport::disconnect(&mut t);
        }
    }
}

#[cfg(windows)]
fn probe(t: &mut mdr::WindowsTransport, mac: &str, uuid: &str) -> String {
    use mdr::{ConnectStatus, PollStatus, Transport};
    use std::time::{Duration, Instant};
    match t.connect(mac, uuid) {
        Err(e) => return format!("connect failed: {e}"),
        Ok(ConnectStatus::Connected) => return "connected".into(),
        Ok(ConnectStatus::InProgress) => {}
    }
    let deadline = Instant::now() + Duration::from_secs(10);
    while Instant::now() < deadline {
        match t.poll(100) {
            Ok(PollStatus::Ready) => return "connected".into(),
            Ok(_) => {}
            Err(e) => return format!("poll failed: {e}"),
        }
    }
    "timed out after 10 s".into()
}

#[cfg(not(windows))]
fn main() {
    eprintln!("the Windows RFCOMM transport is only available on Windows");
}
