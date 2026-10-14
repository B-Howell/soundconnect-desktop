//! Plan building and restore diffing against the snapshot recorded on the maintainer's
//! PC with the crate's own `snapshot()` (`examples/snapshot.rs`). Variants are
//! the recording with one or two fields changed, as a fix or Windows would.

use winaudio::plan::{fix_plan, restore_plan, NOTE_CALLS_MONO, NOTE_NOT_CONNECTED, NOTE_SPATIAL};
use winaudio::{
    Change, DefaultEndpoint, DuckingMode, Endpoint, EndpointState, FixKind, Flow, WinAudioSnapshot,
};

const FIXTURE: &str = include_str!("../../../fixtures/winaudio/test-pc.json");

fn recorded() -> WinAudioSnapshot {
    serde_json::from_str(FIXTURE).expect("fixture parses as WinAudioSnapshot")
}

fn stereo(s: &WinAudioSnapshot) -> Endpoint {
    s.stereo
        .clone()
        .expect("recording has the XM4 stereo endpoint")
}

/// The recording with the headphones' stereo endpoint active (connected to Windows).
fn connected() -> WinAudioSnapshot {
    let mut s = recorded();
    if let Some(e) = s.stereo.as_mut() {
        e.state = EndpointState::Active;
    }
    s
}

fn as_default(e: &Endpoint) -> DefaultEndpoint {
    DefaultEndpoint {
        id: e.id.clone(),
        name: e.name.clone(),
        is_this_device: true,
    }
}

fn changes(plan: &winaudio::Plan) -> Vec<Change> {
    plan.changes.iter().map(|c| c.change.clone()).collect()
}

#[test]
fn recording_matches_the_research_facts() {
    let s = recorded();
    assert_eq!(s.address, "AA:BB:CC:12:34:56");
    assert_eq!(stereo(&s).name, "Headphones (WH-1000XM4)");
    assert!(
        s.hands_free_offered,
        "the XM4 advertises Hands-Free in its SDP cache"
    );
    assert_eq!(
        s.hands_free_enabled,
        Some(false),
        "Hands-Free turned off on this PC"
    );
    assert_eq!(s.enhancements_enabled, Some(false));
    assert_eq!(s.ducking_mode, DuckingMode::DoNothing);
    assert!(!s.absolute_volume_disabled);
    assert!(!s.mono_audio);
    let f = s.default_format.expect("format");
    assert_eq!(
        (f.sample_rate, f.bits_per_sample, f.channels),
        (48_000, 16, 2)
    );
    assert_eq!(
        (s.exclusive_mode_allowed, s.exclusive_priority),
        (Some(true), Some(true))
    );
    let adapter = s.adapter.clone().expect("adapter");
    assert_eq!(adapter.name, "MediaTek Bluetooth Adapter");
    assert_eq!(adapter.power_saving_allowed, Some(true));
    assert_eq!(s.codec.as_deref(), Some("AAC"));
    assert!(s.errors.is_empty(), "{:?}", s.errors);
    // The recording PC's name is scrubbed; on that PC this checks it.
    if let Ok(pc) = std::env::var("COMPUTERNAME") {
        if !pc.is_empty() {
            assert!(
                !FIXTURE
                    .to_ascii_uppercase()
                    .contains(&pc.to_ascii_uppercase()),
                "PC name scrubbed"
            );
        }
    }
}

#[test]
fn stereo_on_the_recording_changes_nothing_while_not_connected() {
    let s = recorded();
    assert_eq!(stereo(&s).state, EndpointState::Unplugged);
    let plan = fix_plan(FixKind::Stereo, &s);
    assert!(plan.changes.is_empty(), "{:?}", plan.changes);
    assert_eq!(plan.notes, vec![NOTE_NOT_CONNECTED.to_string()]);
}

#[test]
fn stereo_when_connected_makes_the_headphones_default_for_playback_and_calls() {
    let s = connected();
    let id = stereo(&s).id;
    let plan = fix_plan(FixKind::Stereo, &s);
    assert_eq!(
        changes(&plan),
        vec![
            Change::SetDefaultEndpoint {
                flow: Flow::Render,
                communications: false,
                id: id.clone(),
                name: "Headphones (WH-1000XM4)".into()
            },
            Change::SetDefaultEndpoint {
                flow: Flow::Render,
                communications: true,
                id,
                name: "Headphones (WH-1000XM4)".into()
            },
        ]
    );
    assert!(!plan.needs_admin());
    assert_eq!(
        plan.changes[0].summary,
        "Make Headphones (WH-1000XM4) the default playback device."
    );
}

#[test]
fn stereo_undoes_what_windows_or_a_call_setup_turned_on() {
    let mut s = connected();
    let st = stereo(&s);
    s.default_render = Some(as_default(&st));
    s.default_communications_render = Some(as_default(&st));
    s.hands_free_enabled = Some(true);
    s.enhancements_enabled = Some(true);
    s.ducking_mode = DuckingMode::Reduce80;
    s.mono_audio = true;
    s.absolute_volume_disabled = true;
    s.spatial_sound = "on".into();
    // The headphone mic as the calls microphone.
    let mic = Endpoint {
        id: "{0.0.1.00000000}.{00000000-0000-0000-0000-00000000a2dp}".into(),
        name: "Headset (WH-1000XM4 Hands-Free)".into(),
        state: EndpointState::Active,
        bluetooth: true,
    };
    s.hands_free_capture = Some(mic.clone());
    s.default_communications_capture = Some(as_default(&mic));

    let plan = fix_plan(FixKind::Stereo, &s);
    let snowball = s.capture_endpoints[0].clone();
    assert_eq!(snowball.name, "Snowball (Blue Snowball)");
    assert_eq!(
        changes(&plan),
        vec![
            Change::SetHandsFree {
                address: s.address.clone(),
                enabled: false
            },
            Change::SetDefaultEndpoint {
                flow: Flow::Capture,
                communications: true,
                id: snowball.id,
                name: snowball.name
            },
            Change::SetEnhancements {
                endpoint_id: st.id,
                enabled: false
            },
            Change::SetDucking {
                mode: DuckingMode::DoNothing
            },
            Change::SetMonoAudio { enabled: false },
            Change::SetAbsoluteVolumeDisabled { disabled: false },
        ]
    );
    assert!(plan.needs_admin());
    let admin: Vec<bool> = plan.changes.iter().map(|c| c.admin).collect();
    assert_eq!(admin, vec![true, false, false, false, false, true]);
    assert_eq!(plan.notes, vec![NOTE_SPATIAL.to_string()]);
    let (user, admin) = plan.split();
    assert_eq!(user.len(), 4);
    assert_eq!(admin.len(), 2);
}

#[test]
fn mono_mic_on_the_recording_turns_hands_free_on_then_uses_it() {
    let s = recorded();
    let plan = fix_plan(FixKind::MonoMic, &s);
    assert_eq!(
        changes(&plan),
        vec![
            Change::SetHandsFree {
                address: s.address.clone(),
                enabled: true
            },
            Change::UseHandsFreeForCommunications {
                address: s.address.clone()
            },
        ]
    );
    assert_eq!(
        plan.changes[0].summary,
        "Turn the hands-free profile on."
    );
    assert!(plan.changes[0].admin && !plan.changes[1].admin);
    assert_eq!(plan.notes, vec![NOTE_CALLS_MONO.to_string()]);
}

#[test]
fn restore_of_an_unchanged_pc_is_empty() {
    let s = recorded();
    assert!(restore_plan(&s, &s).changes.is_empty());
}

#[test]
fn restore_puts_back_every_difference() {
    let before = recorded();
    let mut now = connected();
    let st = stereo(&now);
    now.default_render = Some(as_default(&st));
    now.hands_free_enabled = Some(true);
    now.enhancements_enabled = Some(true);
    now.ducking_mode = DuckingMode::Reduce50;
    if let Some(a) = now.adapter.as_mut() {
        a.power_saving_allowed = Some(false);
    }
    let eris = before.default_render.clone().expect("recorded default");
    let plan = restore_plan(&before, &now);
    assert_eq!(
        changes(&plan),
        vec![
            Change::SetHandsFree {
                address: before.address.clone(),
                enabled: false
            },
            Change::SetDefaultEndpoint {
                flow: Flow::Render,
                communications: false,
                id: eris.id,
                name: eris.name
            },
            Change::SetEnhancements {
                endpoint_id: st.id,
                enabled: false
            },
            Change::SetDucking {
                mode: DuckingMode::DoNothing
            },
            Change::SetAdapterPowerSaving { allowed: true },
        ]
    );
}

#[test]
fn changes_serialise_with_camel_case_kind_tags() {
    let json = serde_json::to_value(Change::SetFormat {
        endpoint_id: "x".into(),
        sample_rate: 44_100,
        bits_per_sample: 16,
    })
    .expect("serialise");
    assert_eq!(
        json,
        serde_json::json!({"kind": "setFormat", "endpointId": "x", "sampleRate": 44100, "bitsPerSample": 16})
    );
    let back: Change = serde_json::from_value(json).expect("round trip");
    assert_eq!(back.summary(), "Set the format to 44.1 kHz, 16-bit.");
}

#[test]
fn raw_values_decode_like_windows() {
    // 0x22000004 is how the stale second XM4 endpoint is stored: not present.
    assert_eq!(
        EndpointState::from_raw(570_425_348),
        EndpointState::NotPresent
    );
    assert_eq!(EndpointState::from_raw(1), EndpointState::Active);
    assert_eq!(DuckingMode::from_raw(None), DuckingMode::Reduce80);
    assert_eq!(DuckingMode::from_raw(Some(3)), DuckingMode::DoNothing);
    assert_eq!(
        winaudio::address_hex("aa:bb:cc:12:34:56").as_deref(),
        Some("AABBCC123456")
    );
    assert_eq!(winaudio::address_hex("not an address"), None);
}

#[test]
fn fix_kinds_are_stereo_and_mono_mic_and_accept_the_old_names() {
    for (json, kind) in [
        ("\"stereo\"", FixKind::Stereo),
        ("\"monoMic\"", FixKind::MonoMic),
        ("\"music\"", FixKind::Stereo),
        ("\"calls\"", FixKind::MonoMic),
    ] {
        assert_eq!(serde_json::from_str::<FixKind>(json).expect(json), kind);
    }
    assert_eq!(
        serde_json::to_string(&FixKind::MonoMic).unwrap(),
        "\"monoMic\""
    );
}
