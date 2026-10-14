//! Prints (or records) the read-only Windows audio snapshot for a headphone
//! address. `--out <file>` writes it with the PC name scrubbed (the fixture
//! `src-tauri/fixtures/winaudio/test-pc.json` was recorded this way):
//!
//! `cargo run -p winaudio --example snapshot -- AA:BB:CC:12:34:56 AAC --out ../fixtures/winaudio/test-pc.json`

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let Some(address) = args.first() else {
        eprintln!("usage: snapshot <address> [codec] [--out <file>]");
        std::process::exit(2);
    };
    let codec = args.get(1).filter(|a| !a.starts_with("--")).cloned();
    let out = args
        .iter()
        .position(|a| a == "--out")
        .and_then(|i| args.get(i + 1));
    #[cfg(windows)]
    {
        let snap = winaudio::snapshot(address, codec);
        let mut json = serde_json::to_string_pretty(&snap).expect("serialise");
        // Scrub the PC name wherever Windows let it into a value.
        if let Ok(pc) = std::env::var("COMPUTERNAME") {
            for form in [pc.clone(), pc.to_lowercase(), pc.to_uppercase()] {
                json = json.replace(&form, "PC-NAME");
            }
        }
        match out {
            Some(path) => std::fs::write(path, json + "\n").expect("write fixture"),
            None => println!("{json}"),
        }
    }
    #[cfg(not(windows))]
    {
        let _ = (address, codec, out);
        eprintln!("Windows only");
    }
}
