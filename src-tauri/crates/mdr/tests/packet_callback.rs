//! `Engine::set_packet_callback` over the recorded XM3 capture: every frame the
//! engine sends and every frame it parses reaches the observer, packed exactly
//! as on the wire, and the observer can be removed again.

mod common;

use mdr::packet::{decode_frame, describe_frame, v1_command_name};
use mdr::{Engine, Event, PacketDirection, Protocol, ReplayTransport};
use std::sync::{Arc, Mutex};

type Seen = Arc<Mutex<Vec<(PacketDirection, Vec<u8>)>>>;

fn run_init(engine: &mut Engine) {
    engine.request_init().unwrap();
    for _ in 0..5_000 {
        if engine.poll().unwrap() == Event::InitializeComplete {
            return;
        }
    }
    panic!("no InitializeComplete");
}

#[test]
fn observer_sees_tx_and_rx_frames_and_can_be_removed() {
    let replay = ReplayTransport::from_capture_dir(common::capture("WH-1000XM3-4.5.2")).unwrap();
    let mut engine = Engine::create(Box::new(replay), Protocol::V1).unwrap();
    let seen: Seen = Arc::default();
    let sink = seen.clone();
    engine.set_packet_callback(Some(Box::new(move |dir, frame| {
        sink.lock().unwrap().push((dir, frame.to_vec()));
    })));
    run_init(&mut engine);

    let frames = seen.lock().unwrap().clone();
    let first_tx = frames
        .iter()
        .find(|(d, _)| *d == PacketDirection::Tx)
        .expect("a TX frame");
    let d = decode_frame(&first_tx.1).expect("TX decodes");
    assert!(d.checksum_ok);
    // RequestInitV1 starts with GetProtocolInfo (HeadphonesV1.cpp).
    assert_eq!(
        v1_command_name(d.payload[0]),
        Some("CONNECT_GET_PROTOCOL_INFO")
    );
    let first_rx = frames
        .iter()
        .find(|(d, _)| *d == PacketDirection::Rx)
        .expect("an RX frame");
    assert!(describe_frame(first_rx.0, &first_rx.1).starts_with("rx len="));
    // Every observed frame is a complete, valid packet.
    assert!(frames
        .iter()
        .all(|(_, f)| decode_frame(f).is_some_and(|d| d.checksum_ok)));

    let tx_total = engine
        .transport_as::<ReplayTransport>()
        .unwrap()
        .tx_bytes()
        .len();
    let tx_seen: usize = frames
        .iter()
        .filter(|(d, _)| *d == PacketDirection::Tx)
        .map(|(_, f)| f.len())
        .sum();
    assert_eq!(tx_seen, tx_total, "the observer saw every byte sent");

    engine.set_packet_callback(None);
    let count = seen.lock().unwrap().len();
    engine.request_sync().unwrap();
    for _ in 0..200 {
        engine.poll().unwrap();
    }
    assert_eq!(
        seen.lock().unwrap().len(),
        count,
        "removed observer is silent"
    );
}
