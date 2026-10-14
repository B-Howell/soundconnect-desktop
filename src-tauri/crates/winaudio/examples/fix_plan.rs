//! Prints the "Fix for music" / "Fix for calls" plan for a recorded snapshot
//! (pure; no Windows calls). The renderer's mock serves these recordings:
//!
//! `cargo run -p winaudio --example fix_plan -- ../fixtures/winaudio/test-pc.json calls > ../fixtures/winaudio/plan-calls.json`

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let (Some(path), Some(kind)) = (args.first(), args.get(1)) else {
        eprintln!("usage: fix_plan <snapshot.json> music|calls");
        std::process::exit(2);
    };
    let snap: winaudio::WinAudioSnapshot =
        serde_json::from_slice(&std::fs::read(path).expect("read snapshot"))
            .expect("parse snapshot");
    let kind = match kind.as_str() {
        "music" => winaudio::FixKind::Music,
        "calls" => winaudio::FixKind::Calls,
        other => panic!("unknown kind {other}"),
    };
    let plan = winaudio::plan::fix_plan(kind, &snap);
    println!(
        "{}",
        serde_json::to_string_pretty(&plan).expect("serialise")
    );
}
