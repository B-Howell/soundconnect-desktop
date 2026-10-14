//! Pure plan builders: what switching to "Stereo audio" or "Mono audio with
//! mic", and "Restore", would change, from snapshots. No Windows calls, so they are tested on the
//! recorded snapshot of the maintainer's PC.

use crate::model::{
    Change, DefaultEndpoint, DuckingMode, EndpointState, FixKind, Flow, Plan, PlannedChange,
    WinAudioSnapshot,
};

/// Shown when spatial sound reads as on; Windows has no supported setter.
pub const NOTE_SPATIAL: &str =
    "Spatial sound is on. Turn it off in Windows Settings > Sound > the headphones.";
/// Shown with "Mono audio with mic".
pub const NOTE_CALLS_MONO: &str =
    "All sound will be mono, call quality, while an app uses the headphone mic.";
/// Shown when Hands-Free is needed but the headphones do not offer it.
pub const NOTE_NO_HANDS_FREE: &str =
    "These headphones do not offer Hands-Free to this PC, so their mic cannot be used for calls.";
/// Shown when stereo mode has to move the mic off the headphones but no other mic exists.
pub const NOTE_NO_OTHER_MIC: &str =
    "No other microphone was found. Calls will have no microphone while Hands-Free is off.";
/// Shown when the stereo endpoint is not active, so defaults cannot point at it.
pub const NOTE_NOT_CONNECTED: &str =
    "The headphones are not connected to Windows, so they cannot be made the default device now.";

fn needs_default(current: Option<&DefaultEndpoint>, id: &str) -> bool {
    current.is_none_or(|d| !d.id.eq_ignore_ascii_case(id))
}

/// The plan for `kind` against `snap`: only what differs from the target.
pub fn fix_plan(kind: FixKind, snap: &WinAudioSnapshot) -> Plan {
    match kind {
        FixKind::Stereo => stereo_plan(snap),
        FixKind::MonoMic => mono_mic_plan(snap),
    }
}

fn stereo_plan(snap: &WinAudioSnapshot) -> Plan {
    let mut changes: Vec<Change> = Vec::new();
    let mut notes: Vec<String> = Vec::new();

    if snap.hands_free_enabled == Some(true) {
        changes.push(Change::SetHandsFree {
            address: snap.address.clone(),
            enabled: false,
        });
    }

    match snap
        .stereo
        .as_ref()
        .filter(|e| e.state == EndpointState::Active)
    {
        Some(stereo) => {
            for (communications, current) in [
                (false, snap.default_render.as_ref()),
                (true, snap.default_communications_render.as_ref()),
            ] {
                if needs_default(current, &stereo.id) {
                    changes.push(Change::SetDefaultEndpoint {
                        flow: Flow::Render,
                        communications,
                        id: stereo.id.clone(),
                        name: stereo.name.clone(),
                    });
                }
            }
        }
        None => notes.push(NOTE_NOT_CONNECTED.into()),
    }

    // A headphone mic as a default would pull the link into Hands-Free: move to another mic.
    let other_mic = snap
        .capture_endpoints
        .iter()
        .find(|e| e.state == EndpointState::Active && !e.bluetooth && !snap.is_own_endpoint(&e.id));
    for (communications, current) in [
        (false, snap.default_capture.as_ref()),
        (true, snap.default_communications_capture.as_ref()),
    ] {
        if current.is_some_and(|d| d.is_this_device) {
            match other_mic {
                Some(mic) => changes.push(Change::SetDefaultEndpoint {
                    flow: Flow::Capture,
                    communications,
                    id: mic.id.clone(),
                    name: mic.name.clone(),
                }),
                None if !notes.iter().any(|n| n == NOTE_NO_OTHER_MIC) => {
                    notes.push(NOTE_NO_OTHER_MIC.into())
                }
                None => {}
            }
        }
    }

    if let (Some(stereo), Some(true)) = (&snap.stereo, snap.enhancements_enabled) {
        changes.push(Change::SetEnhancements {
            endpoint_id: stereo.id.clone(),
            enabled: false,
        });
    }
    if snap.ducking_mode != DuckingMode::DoNothing {
        changes.push(Change::SetDucking {
            mode: DuckingMode::DoNothing,
        });
    }
    if snap.mono_audio {
        changes.push(Change::SetMonoAudio { enabled: false });
    }
    if snap.absolute_volume_disabled {
        changes.push(Change::SetAbsoluteVolumeDisabled { disabled: false });
    }
    if snap.spatial_sound == "on" {
        notes.push(NOTE_SPATIAL.into());
    }
    plan(changes, notes)
}

fn mono_mic_plan(snap: &WinAudioSnapshot) -> Plan {
    let mut changes: Vec<Change> = Vec::new();
    let mut notes: Vec<String> = Vec::new();
    if !snap.hands_free_offered {
        notes.push(NOTE_NO_HANDS_FREE.into());
        return plan(changes, notes);
    }
    if snap.hands_free_enabled != Some(true) {
        changes.push(Change::SetHandsFree {
            address: snap.address.clone(),
            enabled: true,
        });
    }
    let render_ok = snap
        .hands_free_render
        .as_ref()
        .is_some_and(|e| !needs_default(snap.default_communications_render.as_ref(), &e.id));
    let capture_ok = snap
        .hands_free_capture
        .as_ref()
        .is_some_and(|e| !needs_default(snap.default_communications_capture.as_ref(), &e.id));
    if !(render_ok && capture_ok) {
        changes.push(Change::UseHandsFreeForCommunications {
            address: snap.address.clone(),
        });
    }
    notes.push(NOTE_CALLS_MONO.into());
    plan(changes, notes)
}

/// The changes that put `now` back to `before` (the snapshot taken before the
/// first fix). Defaults go back only to endpoints that existed then; Hands-Free
/// only when its state was known.
pub fn restore_plan(before: &WinAudioSnapshot, now: &WinAudioSnapshot) -> Plan {
    let mut changes: Vec<Change> = Vec::new();

    if let (Some(was), Some(is)) = (before.hands_free_enabled, now.hands_free_enabled) {
        if was != is && now.hands_free_offered {
            changes.push(Change::SetHandsFree {
                address: now.address.clone(),
                enabled: was,
            });
        }
    }

    for (flow, communications, was, is) in [
        (
            Flow::Render,
            false,
            &before.default_render,
            &now.default_render,
        ),
        (
            Flow::Render,
            true,
            &before.default_communications_render,
            &now.default_communications_render,
        ),
        (
            Flow::Capture,
            false,
            &before.default_capture,
            &now.default_capture,
        ),
        (
            Flow::Capture,
            true,
            &before.default_communications_capture,
            &now.default_communications_capture,
        ),
    ] {
        if let Some(was) = was {
            if needs_default(is.as_ref(), &was.id) {
                changes.push(Change::SetDefaultEndpoint {
                    flow,
                    communications,
                    id: was.id.clone(),
                    name: was.name.clone(),
                });
            }
        }
    }

    // Endpoint settings only on the same stereo endpoint.
    if let (Some(b), Some(n)) = (&before.stereo, &now.stereo) {
        if b.id.eq_ignore_ascii_case(&n.id) {
            if let (Some(was), Some(is)) = (before.enhancements_enabled, now.enhancements_enabled) {
                if was != is {
                    changes.push(Change::SetEnhancements {
                        endpoint_id: n.id.clone(),
                        enabled: was,
                    });
                }
            }
            if let (Some(was), Some(is)) = (before.default_format, now.default_format) {
                if (was.sample_rate, was.bits_per_sample) != (is.sample_rate, is.bits_per_sample) {
                    changes.push(Change::SetFormat {
                        endpoint_id: n.id.clone(),
                        sample_rate: was.sample_rate,
                        bits_per_sample: was.bits_per_sample,
                    });
                }
            }
            let was = (before.exclusive_mode_allowed, before.exclusive_priority);
            let is = (now.exclusive_mode_allowed, now.exclusive_priority);
            if let ((Some(allowed), Some(priority)), true) = (was, was != is) {
                changes.push(Change::SetExclusiveMode {
                    endpoint_id: n.id.clone(),
                    allowed,
                    priority,
                });
            }
        }
    }

    if before.ducking_mode != now.ducking_mode {
        changes.push(Change::SetDucking {
            mode: before.ducking_mode,
        });
    }
    if before.mono_audio != now.mono_audio {
        changes.push(Change::SetMonoAudio {
            enabled: before.mono_audio,
        });
    }
    if before.absolute_volume_disabled != now.absolute_volume_disabled {
        changes.push(Change::SetAbsoluteVolumeDisabled {
            disabled: before.absolute_volume_disabled,
        });
    }
    let saving = |s: &WinAudioSnapshot| s.adapter.as_ref().and_then(|a| a.power_saving_allowed);
    if let (Some(was), Some(is)) = (saving(before), saving(now)) {
        if was != is {
            changes.push(Change::SetAdapterPowerSaving { allowed: was });
        }
    }
    plan(changes, Vec::new())
}

fn plan(changes: Vec<Change>, notes: Vec<String>) -> Plan {
    Plan {
        changes: changes.into_iter().map(PlannedChange::from).collect(),
        notes,
    }
}
