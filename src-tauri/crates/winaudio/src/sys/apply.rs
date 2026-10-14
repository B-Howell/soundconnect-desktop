//! Applies changes one by one, reading each back. A change whose write fails
//! or whose read-back does not match stops the batch; the rest are reported
//! as skipped, so nothing runs on top of an unexpected state.

use std::thread::sleep;
use std::time::{Duration, Instant};

use crate::model::{address_hex, Change, ChangeResult, Flow};

use super::read::DeviceEndpoints;
use super::{adapter, audio, bluetooth, registry};

/// Polls `check` until it is true or `timeout` passes (driver installs and the
/// Audio service settle asynchronously).
fn settles(timeout: Duration, mut check: impl FnMut() -> bool) -> bool {
    let start = Instant::now();
    loop {
        if check() {
            return true;
        }
        if start.elapsed() >= timeout {
            return false;
        }
        sleep(Duration::from_millis(250));
    }
}

const QUICK: Duration = Duration::from_secs(2);
const DRIVER: Duration = Duration::from_secs(15);
/// Shared-mode sample rates and bit depths a `SetFormat` may ask for.
const FORMAT_RATES: [u32; 4] = [44_100, 48_000, 88_200, 96_000];
const FORMAT_BITS: [u16; 3] = [16, 24, 32];

fn is_default(flow: Flow, communications: bool, id: &str) -> bool {
    audio::default_endpoint(flow, communications)
        .ok()
        .flatten()
        .is_some_and(|d| d.eq_ignore_ascii_case(id))
}

/// Write then read back. `Ok(verified)`, or `Err` when the write itself failed.
fn apply_one(change: &Change) -> Result<bool, String> {
    let e = |err: &dyn std::fmt::Display| err.to_string();
    match change {
        Change::SetDefaultEndpoint {
            flow,
            communications,
            id,
            ..
        } => {
            audio::set_default_endpoint(id, *communications).map_err(|x| e(&x))?;
            Ok(settles(QUICK, || is_default(*flow, *communications, id)))
        }
        Change::UseHandsFreeForCommunications { address } => {
            let hex = address_hex(address).ok_or("not a Bluetooth address")?;
            // The endpoints appear a moment after Hands-Free is installed.
            let mut found = None;
            settles(DRIVER, || {
                let all = registry::endpoints().unwrap_or_default();
                let device = DeviceEndpoints::new(&hex, &all);
                found = device
                    .hands_free_render()
                    .map(|r| r.id.clone())
                    .zip(device.hands_free_capture().map(|c| c.id.clone()));
                found.is_some()
            });
            let (render, capture) =
                found.ok_or("the Hands-Free playback and microphone endpoints did not appear")?;
            audio::set_default_endpoint(&render, true).map_err(|x| e(&x))?;
            audio::set_default_endpoint(&capture, true).map_err(|x| e(&x))?;
            Ok(settles(QUICK, || {
                is_default(Flow::Render, true, &render) && is_default(Flow::Capture, true, &capture)
            }))
        }
        Change::SetEnhancements {
            endpoint_id,
            enabled,
        } => {
            audio::set_enhancements(endpoint_id, *enabled).map_err(|x| e(&x))?;
            Ok(settles(QUICK, || {
                registry::enhancements_enabled(endpoint_id).is_ok_and(|v| v == *enabled)
            }))
        }
        Change::SetFormat {
            endpoint_id,
            sample_rate,
            bits_per_sample,
        } => {
            // The renderer supplies these numbers: only real PCM formats reach COM.
            if !FORMAT_RATES.contains(sample_rate) || !FORMAT_BITS.contains(bits_per_sample) {
                return Err(format!(
                    "unsupported format {sample_rate} Hz / {bits_per_sample} bit"
                ));
            }
            audio::set_device_format(endpoint_id, *sample_rate, *bits_per_sample)
                .map_err(|x| e(&x))?;
            Ok(settles(QUICK, || {
                registry::device_format(endpoint_id)
                    .ok()
                    .flatten()
                    .is_some_and(|f| {
                        f.sample_rate == *sample_rate && f.bits_per_sample == *bits_per_sample
                    })
            }))
        }
        Change::SetExclusiveMode {
            endpoint_id,
            allowed,
            priority,
        } => {
            audio::set_exclusive_mode(endpoint_id, *allowed, *priority).map_err(|x| e(&x))?;
            Ok(settles(QUICK, || {
                registry::exclusive_mode(endpoint_id).is_ok_and(|v| v == (*allowed, *priority))
            }))
        }
        Change::SetDucking { mode } => {
            registry::set_ducking_raw(mode.to_raw()).map_err(|x| e(&x))?;
            Ok(registry::ducking_raw() == Some(mode.to_raw()))
        }
        Change::SetMonoAudio { enabled } => {
            registry::set_mono_audio(*enabled).map_err(|x| e(&x))?;
            Ok(registry::mono_audio() == *enabled)
        }
        Change::SetHandsFree { address, enabled } => {
            let hex = address_hex(address).ok_or("not a Bluetooth address")?;
            bluetooth::set_hands_free(&hex, *enabled)?;
            Ok(settles(DRIVER, || {
                bluetooth::hands_free_enabled(&hex).is_ok_and(|v| v == *enabled)
            }))
        }
        Change::SetAbsoluteVolumeDisabled { disabled } => {
            registry::set_absolute_volume_disabled(*disabled).map_err(|x| e(&x))?;
            Ok(registry::absolute_volume_disabled() == *disabled)
        }
        Change::SetAdapterPowerSaving { allowed } => {
            let radio = adapter::radio().ok_or("no Bluetooth adapter found")?;
            adapter::set_power_saving_allowed(&radio.instance_id, *allowed)?;
            Ok(adapter::power_saving_allowed(&radio.instance_id) == Ok(Some(*allowed)))
        }
    }
}

/// Runs `changes` in order (each with `allowed(change)` checked first).
fn run(changes: &[Change], allowed: impl Fn(&Change) -> Result<(), String>) -> Vec<ChangeResult> {
    let _com = audio::Com::init();
    let mut stopped = false;
    changes
        .iter()
        .map(|change| {
            if stopped {
                return ChangeResult::failed(
                    change.clone(),
                    "Skipped after an earlier change failed.",
                );
            }
            let result = match allowed(change).and_then(|()| apply_one(change)) {
                Ok(verified) => ChangeResult {
                    change: change.clone(),
                    applied: true,
                    verified,
                    error: (!verified).then(|| "The new value did not read back.".to_string()),
                },
                Err(error) => ChangeResult::failed(change.clone(), error),
            };
            stopped = !result.verified;
            result
        })
        .collect()
}

/// User-level changes in this (unelevated) process.
pub fn apply(changes: &[Change]) -> Vec<ChangeResult> {
    run(changes, |c| {
        if c.needs_admin() {
            Err("needs administrator rights; use apply_admin".into())
        } else {
            Ok(())
        }
    })
}

/// Admin changes, in the elevated helper process only. Returns the index of
/// the first change that failed or did not read back (the helper's exit code
/// carries it; the batch stops there).
pub(crate) fn apply_admin_here(changes: &[Change]) -> Option<usize> {
    run(changes, |c| {
        if c.needs_admin() {
            Ok(())
        } else {
            Err("not an allow-listed administrator change".into())
        }
    })
    .iter()
    .position(|r| !r.verified)
}

/// Reads an admin change back in this unelevated process (the reads need no
/// administrator rights), waiting as long as the write itself would.
pub(crate) fn admin_reads_back(change: &Change) -> bool {
    match change {
        Change::SetHandsFree { address, enabled } => address_hex(address).is_some_and(|hex| {
            settles(DRIVER, || {
                bluetooth::hands_free_enabled(&hex).is_ok_and(|v| v == *enabled)
            })
        }),
        Change::SetAbsoluteVolumeDisabled { disabled } => {
            settles(QUICK, || registry::absolute_volume_disabled() == *disabled)
        }
        Change::SetAdapterPowerSaving { allowed } => adapter::radio().is_some_and(|radio| {
            settles(QUICK, || {
                adapter::power_saving_allowed(&radio.instance_id) == Ok(Some(*allowed))
            })
        }),
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_format_outside_the_allow_list_is_refused_before_any_com_call() {
        for (rate, bits) in [(48_000, 0), (48_000, 9_000), (0, 16), (12_345, 24)] {
            let change = Change::SetFormat {
                endpoint_id: "{0.0.0.00000000}.{not-a-device}".into(),
                sample_rate: rate,
                bits_per_sample: bits,
            };
            let err = apply_one(&change).expect_err("refused");
            assert!(err.starts_with("unsupported format"), "{err}");
        }
    }
}
