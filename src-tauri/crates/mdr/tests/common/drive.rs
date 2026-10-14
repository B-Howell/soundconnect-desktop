//! Drives an [`Engine`] over a [`ReplayTransport`] the way client/Client.cpp does.

use mdr::{Engine, Event, Protocol, ReplayTransport};
use std::path::Path;

/// What happened while replaying one capture.
pub struct Run {
    pub engine: Engine,
    pub events: Vec<Event>,
    pub initialize_complete: bool,
    pub sync_complete: bool,
}

/// Upper bound on polls; each poll consumes at most one frame's worth of work.
const MAX_POLLS: usize = 20_000;
/// Consecutive idle polls (no event, no RX left) that end the run.
const IDLE_LIMIT: usize = 64;

/// create -> request_init -> poll; on InitializeComplete -> request_sync; stop when
/// the capture is exhausted and the engine is idle.
pub fn replay(dir: &Path, protocol: Protocol) -> Run {
    let transport = ReplayTransport::from_capture_dir(dir).expect("load capture");
    let mut engine = Engine::create(Box::new(transport), protocol).expect("create");
    engine.request_init().expect("request_init");

    let mut events = Vec::new();
    let (mut init, mut sync) = (false, false);
    let mut idle = 0;
    for _ in 0..MAX_POLLS {
        let ev = engine
            .poll()
            .unwrap_or_else(|e| panic!("poll failed in {}: {e}", dir.display()));
        match ev {
            Event::None => {
                let left = engine
                    .transport_as::<ReplayTransport>()
                    .unwrap()
                    .rx_remaining();
                idle = if left == 0 { idle + 1 } else { 0 };
                if idle >= IDLE_LIMIT {
                    break;
                }
                continue;
            }
            Event::InitializeComplete => {
                init = true;
                engine.request_sync().expect("request_sync");
            }
            Event::SyncComplete => sync = true,
            _ => {}
        }
        idle = 0;
        events.push(ev);
    }
    Run {
        engine,
        events,
        initialize_complete: init,
        sync_complete: sync,
    }
}
