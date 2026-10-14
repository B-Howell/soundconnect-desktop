//! Engine lifecycle, readers and Snapshot over the recorded upstream captures in
//! `upstream/SonyHeadphonesClient/tests/` (MIT, commit 4c91fe6).
//!
//! Every pinned value below was observed on the first green run (printed snapshot
//! JSON), never guessed. See `docs/testing/SoundConnect Desktop - Testing.md`.

mod common;

use common::drive::{replay, Run};
use mdr::*;
use std::collections::BTreeSet;

fn xm3() -> Run {
    replay(&common::capture("WH-1000XM3-4.5.2"), Protocol::V1)
}

#[test]
fn xm3_initializes_and_syncs() {
    let mut run = xm3();
    assert!(run.initialize_complete, "InitializeComplete seen");
    assert!(run.sync_complete, "SyncComplete seen");
    let init = run
        .events
        .iter()
        .position(|e| *e == Event::InitializeComplete)
        .unwrap();
    let sync = run
        .events
        .iter()
        .position(|e| *e == Event::SyncComplete)
        .unwrap();
    assert!(init < sync);
    assert_eq!(
        run.events
            .iter()
            .filter(|e| **e == Event::InitializeComplete)
            .count(),
        1
    );
    // The capture includes the device's connection-mode confirmation request.
    assert!(run.events.contains(&Event::Alert));

    let e = &mut run.engine;
    assert_eq!(e.protocol(), Protocol::V1);
    assert!(e.is_initialized());
    assert!(e.is_ready());
    assert!(!e.is_dirty());
    let replay = e.transport_as::<ReplayTransport>().unwrap();
    assert_eq!(replay.frame_count(), 187);
    assert_eq!(replay.rx_remaining(), 0, "every recorded byte consumed");
    assert!(
        !replay.tx_bytes().is_empty(),
        "libmdr sent its init/sync requests"
    );
}

#[test]
fn xm3_snapshot_pins_observed_values() {
    let run = xm3();
    let s = run.engine.snapshot();

    // Model: protocol_version is the device-reported protocol info (0x4010 for this
    // firmware; first frame payload `01 00 40 10`), not the MDR_PROTOCOL_V1 family.
    let model = s.model.expect("model");
    assert_eq!(model.protocol_version, 0x4010);
    assert_eq!(model.protocol_version, 16400);
    assert_eq!(model.audio_codec, AudioCodec::Ldac);
    assert_eq!(model.model_color, 1);

    assert_eq!(s.texts.model_name.as_deref(), Some("WH-1000XM3"));
    assert_eq!(s.texts.firmware_version.as_deref(), Some("4.5.2"));
    assert_eq!(s.texts.model_series.as_deref(), Some("PREMIUM"));
    assert_eq!(s.texts.model_color.as_deref(), Some("BLACK"));
    // Scrubbed by upstream tooling/scrub-capture.py.
    assert_eq!(s.texts.unique_id.as_deref(), Some("AA:BB:CC:00:00:01"));
    assert_eq!(
        s.texts.last_alert.as_deref(),
        Some("DISCONNECT_CAUSED_BY_CONNECTION_MODE_CHANGE")
    );

    let batteries = s.batteries.expect("batteries");
    assert_eq!(batteries.len(), 1);
    assert_eq!(batteries[0].part, BatteryPart::Main);
    assert!(batteries[0].present);
    assert_eq!(batteries[0].level_percent, 100);
    assert_eq!(batteries[0].charging, ChargingState::No);

    let available: BTreeSet<&str> = s
        .features
        .iter()
        .filter(|(_, a)| **a == Availability::Available)
        .map(|(k, _)| k.as_str())
        .collect();
    let expected: BTreeSet<&str> = [
        "AMBIENT_SOUND",
        "AUTO_POWER_OFF",
        "BATTERY_SINGLE",
        "CONNECTION_MODE",
        "DSEE",
        "EQUALIZER",
        "GENERAL_SETTINGS",
        "IDENTITY",
        "NOISE_CANCELLING",
        "PLAYBACK_CONTROL",
        "PLAYBACK_METADATA",
        "PLAYBACK_VOLUME",
        "VOICE_GUIDANCE",
    ]
    .into_iter()
    .collect();
    assert_eq!(available, expected);
    assert_eq!(s.features.len(), Feature::ALL.len());
    assert!(s
        .features
        .values()
        .all(|a| matches!(a, Availability::Available | Availability::Unavailable)));

    let nc = s.noise_control.expect("noise control");
    assert_eq!(nc.mode, NoiseMode::Cancelling);

    let eq = s.equalizer.expect("equalizer");
    assert_eq!(eq.preset, EqualizerPresetId::Off);
    assert_eq!(eq.band_count, 5);
    assert_eq!(eq.bands, vec![0, 0, 0, 0, 0]);
    assert!(eq.available && eq.dsee_available && eq.dsee_enabled);
    assert_eq!(eq.dsee_type, DseeType::Hx);
    let presets: Vec<EqualizerPresetId> = s
        .equalizer_presets
        .expect("presets")
        .iter()
        .map(|p| p.id)
        .collect();
    assert_eq!(
        presets,
        vec![
            EqualizerPresetId::Off,
            EqualizerPresetId::Bright,
            EqualizerPresetId::Excited,
            EqualizerPresetId::Mellow,
            EqualizerPresetId::Relaxed,
            EqualizerPresetId::Vocal,
            EqualizerPresetId::Treble,
            EqualizerPresetId::Bass,
            EqualizerPresetId::Speech,
            EqualizerPresetId::Custom,
            EqualizerPresetId::User1,
            EqualizerPresetId::User2,
        ]
    );

    let gs = s.general_settings.expect("general settings");
    assert_eq!(gs.len(), 1);
    assert_eq!(gs[0].index, 1);
    assert_eq!(gs[0].subject, "TOUCH_PANEL_SETTING");
    assert!(gs[0].value && gs[0].info.writable);

    assert_eq!(s.power.expect("power").auto_power_off_minutes, 5);
    assert!(s.voice_guidance.expect("voice guidance").enabled);
    assert_eq!(
        s.connection_mode.expect("mode").audio_priority,
        AudioPriority::Quality
    );
    assert_eq!(s.playback.expect("playback").volume, 24);
    // Unsupported on the XM3: libmdr refuses the read, so the snapshot holds null.
    assert!(s.assignable_controls.is_none());
    assert!(s.safe_listening.is_none());
    assert!(s.wearing_status.is_none());
    assert!(s.source_switch_control.is_none());
}

#[test]
fn snapshot_json_keys_are_the_renderer_contract() {
    let run = xm3();
    let v = serde_json::to_value(run.engine.snapshot()).unwrap();
    let mut keys: Vec<&str> = v.as_object().unwrap().keys().map(String::as_str).collect();
    let mut expected = vec![
        "protocol",
        "initialized",
        "ready",
        "dirty",
        "model",
        "batteries",
        "playback",
        "noiseControl",
        "speakToChat",
        "listening",
        "equalizer",
        "equalizerPresets",
        "pairedDevices",
        "pairing",
        "sourceSwitchControl",
        "generalSettings",
        "assignableControls",
        "power",
        "voiceGuidance",
        "connectionMode",
        "safeListening",
        "wearingStatus",
        "features",
        "texts",
    ];
    keys.sort_unstable();
    expected.sort_unstable();
    assert_eq!(keys, expected);
    let texts: BTreeSet<&str> = v["texts"]
        .as_object()
        .unwrap()
        .keys()
        .map(String::as_str)
        .collect();
    assert_eq!(
        texts,
        [
            "modelName",
            "firmwareVersion",
            "uniqueId",
            "modelSeries",
            "modelColor",
            "lastAlert",
            "trackTitle",
            "trackAlbum",
            "trackArtist"
        ]
        .into_iter()
        .collect()
    );
    assert_eq!(v["protocol"], "V1");
    assert_eq!(v["features"]["NOISE_CANCELLING"], "available");
    assert_eq!(v["batteries"][0]["levelPercent"], 100);
    assert_eq!(v["noiseControl"]["mode"], "cancelling");
}

#[test]
fn xm3_setters_stage_and_commit() {
    let mut run = xm3();
    let e = &mut run.engine;
    let tx_before = e
        .transport_as::<ReplayTransport>()
        .unwrap()
        .tx_bytes()
        .len();
    let mut nc = e.noise_control().unwrap();
    nc.mode = NoiseMode::Ambient;
    nc.ambient_level = 10;
    e.set_noise_control(&nc).unwrap();
    assert!(e.is_dirty(), "set_* stages a change");
    e.commit().unwrap();
    // Drive the commit coroutine: it sends the request (no reply is recorded).
    for _ in 0..16 {
        e.poll().unwrap();
    }
    let tx_after = e
        .transport_as::<ReplayTransport>()
        .unwrap()
        .tx_bytes()
        .len();
    assert!(tx_after > tx_before, "commit sent a request");
}

/// What each upstream capture supports, observed by replaying it. A new capture
/// folder fails `every_capture_replays_without_error` until it is added here.
struct Expect {
    folder: &'static str,
    protocol: Protocol,
    model_name: &'static str,
    initialize_complete: bool,
    sync_complete: bool,
}

const CAPTURES: &[Expect] = &[
    // Init's last request is LOG_SET_STATUS (0xC4, HeadphonesV2.cpp RequestInitV2);
    // the capture stops before its ACK (last init reply ordinal 138; 801-802 are
    // later PERI frames), so init cannot complete from this recording.
    Expect {
        folder: "WF-1000XM5-6.1.0",
        protocol: Protocol::V2,
        model_name: "WF-1000XM5",
        initialize_complete: false,
        sync_complete: false,
    },
    // Recording ends after init, before the sync replies.
    Expect {
        folder: "WF-LC900-2.0.3",
        protocol: Protocol::V2,
        model_name: "LinkBuds Clip",
        initialize_complete: true,
        sync_complete: false,
    },
    Expect {
        folder: "WF-LC900-2.0.3-equalizer",
        protocol: Protocol::V2,
        model_name: "LinkBuds Clip",
        initialize_complete: true,
        sync_complete: true,
    },
    Expect {
        folder: "WF-LC900-2.0.3-listening",
        protocol: Protocol::V2,
        model_name: "LinkBuds Clip",
        initialize_complete: true,
        sync_complete: true,
    },
    Expect {
        folder: "WH-1000XM3-4.5.2",
        protocol: Protocol::V1,
        model_name: "WH-1000XM3",
        initialize_complete: true,
        sync_complete: true,
    },
];

#[test]
fn every_capture_replays_without_error() {
    let mut folders: Vec<String> = std::fs::read_dir(common::captures_root())
        .unwrap()
        .map(|e| e.unwrap())
        .filter(|e| e.path().is_dir())
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .collect();
    folders.sort();
    let listed: Vec<&str> = CAPTURES.iter().map(|c| c.folder).collect();
    assert_eq!(folders, listed, "capture folders changed; update CAPTURES");

    for c in CAPTURES {
        let dir = common::capture(c.folder);
        // Protocol inferred from CONNECT_RET_PROTOCOL_INFO like upstream Replay.cpp.
        let detected = ReplayTransport::from_capture_dir(&dir)
            .unwrap()
            .detect_protocol();
        assert_eq!(detected, c.protocol, "{}", c.folder);
        // `replay` panics on any poll error.
        let mut run = replay(&dir, detected);
        assert_eq!(
            run.initialize_complete, c.initialize_complete,
            "{} init",
            c.folder
        );
        assert_eq!(run.sync_complete, c.sync_complete, "{} sync", c.folder);
        assert_eq!(
            run.engine.is_initialized(),
            c.initialize_complete,
            "{}",
            c.folder
        );
        let replay_t = run.engine.transport_as::<ReplayTransport>().unwrap();
        assert_eq!(replay_t.rx_remaining(), 0, "{} consumed", c.folder);
        // Upstream Replay.cpp's own assertion: identity readable, protocol selected.
        let model = run.engine.model().expect("model");
        assert_ne!(model.protocol_version, 0, "{}", c.folder);
        assert_eq!(
            run.engine.model_name().unwrap(),
            c.model_name,
            "{}",
            c.folder
        );
    }
}

#[test]
fn instance_is_uninitialized_until_request_init() {
    let t = ReplayTransport::from_capture_dir(common::capture("WH-1000XM3-4.5.2")).unwrap();
    let e = Engine::create(Box::new(t), Protocol::V1).unwrap();
    assert!(!e.is_initialized());
    // Drop destroys the handle, then the transport.
    drop(e);
}
