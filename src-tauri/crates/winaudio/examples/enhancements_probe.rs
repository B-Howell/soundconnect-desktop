//! Live read-back proof for the one write path that is safe to flip on
//! The maintainer's PC: audio enhancements on the stereo endpoint, off -> on -> off,
//! ending on the original value. Prints each step's `ChangeResult`.
//!
//! `cargo run -p winaudio --example enhancements_probe -- AA:BB:CC:12:34:56`

fn main() {
    #[cfg(windows)]
    {
        use winaudio::Change;
        let address = std::env::args()
            .nth(1)
            .expect("usage: enhancements_probe <address>");
        let snap = winaudio::snapshot(&address, None);
        let stereo = snap.stereo.expect("no stereo endpoint for that address");
        let original = snap
            .enhancements_enabled
            .expect("enhancements state unreadable");
        println!(
            "endpoint {} ({}), enhancements on = {original}",
            stereo.name, stereo.id
        );
        for enabled in [!original, original] {
            let results = winaudio::apply(&[Change::SetEnhancements {
                endpoint_id: stereo.id.clone(),
                enabled,
            }]);
            println!("{}", serde_json::to_string(&results).expect("serialise"));
        }
        let after = winaudio::snapshot(&address, None).enhancements_enabled;
        println!("final enhancements on = {after:?} (original {original})");
        assert_eq!(after, Some(original), "did not end on the original value");
    }
}
