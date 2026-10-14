//! Prints the "Stereo audio" / "Mono audio with mic" plan for a recorded snapshot
//! (pure; no Windows calls). The renderer's mock serves these recordings:
//!
//! `cargo run -p winaudio --example fix_plan -- ../fixtures/winaudio/test-pc.json monoMic > ../fixtures/winaudio/plan-mono-mic.json`

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let (Some(path), Some(kind)) = (args.first(), args.get(1)) else {
        eprintln!("usage: fix_plan <snapshot.json> stereo|monoMic");
        std::process::exit(2);
    };
    let snap: winaudio::WinAudioSnapshot =
        serde_json::from_slice(&std::fs::read(path).expect("read snapshot"))
            .expect("parse snapshot");
    let kind = match kind.as_str() {
        "stereo" => winaudio::FixKind::Stereo,
        "monoMic" => winaudio::FixKind::MonoMic,
        other => panic!("unknown kind {other}"),
    };
    let plan = winaudio::plan::fix_plan(kind, &snap);
    println!(
        "{}",
        serde_json::to_string_pretty(&plan).expect("serialise")
    );
}
