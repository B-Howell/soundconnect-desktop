//! Renderer-facing noise control view ([`NoiseView`]) and its inverse.
//!
//! libmdr reports noise control differently per protocol family
//! (`libmdr/src/Headphones.cpp` `mdrHeadphonesGetNoiseControl`):
//!
//! - **V1** (XM3/XM4): `mode` is only `MDR_NOISE_MODE_V1_ON` (1) or `OFF` (0), and
//!   the effect lives in `ambient_level` read as `int8_t`: -1 (raw byte 255) is
//!   noise cancelling, 0 wind-noise reduction, 1..20 ambient sound at that level
//!   (`client/Client.cpp` 1597-1607).
//! - **V2** (XM5+): `mode` is `OFF` / `CANCELLING` / `AMBIENT`; `ambient_level`
//!   is 0..20 and only meaningful in ambient (`Client.cpp` 1629-1657).
//!
//! The renderer never sees the raw byte: [`noise_view`] normalises both into
//! `{mode, ambientLevel 1..20, focusOnVoice, can*}` and [`noise_request`] turns a
//! view-level request back into the `MDRNoiseControl` libmdr expects.

use std::collections::BTreeMap;

use mdr::{Availability, Feature, NoiseControl, NoiseMode, Protocol};
use serde::{Deserialize, Serialize};

/// Ambient level bounds (`ImGui::SliderInt("##AmbStrength", ..., 1, 20)`).
pub const AMBIENT_MIN: u8 = 1;
/// Upper ambient level bound.
pub const AMBIENT_MAX: u8 = 20;
/// The level used when entering ambient without a known level: upstream bumps 0
/// to 20 (`if (gState.mNoise.ambient_level == 0) gState.mNoise.ambient_level = 20;`).
pub const DEFAULT_AMBIENT_LEVEL: u8 = 20;

/// V1 `ambient_level` byte for noise cancelling (-1 as `int8_t`).
pub const V1_LEVEL_CANCELLING: u8 = 0xFF;
/// V1 `ambient_level` byte for wind-noise reduction.
pub const V1_LEVEL_WIND: u8 = 0;

/// The four effects a user can pick. `Wind` exists only on protocol V1.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NoiseViewMode {
    Off,
    Cancelling,
    Ambient,
    Wind,
}

/// The `noiseView` object published with every snapshot.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoiseView {
    pub mode: NoiseViewMode,
    /// Always 1..20: the current ambient level in ambient, else the level the
    /// slider should show when ambient is entered.
    pub ambient_level: u8,
    pub focus_on_voice: bool,
    pub can_cancel: bool,
    pub can_ambient: bool,
    /// Wind-noise reduction is offered only by V1 devices with noise cancelling.
    pub can_wind: bool,
    pub can_focus_on_voice: bool,
}

/// True when `features` (keyed like `Snapshot::features`) reports `f` available.
pub fn feature_available(features: &BTreeMap<String, Availability>, f: Feature) -> bool {
    let key = f
        .c_name()
        .and_then(|n| n.strip_prefix("MDR_FEATURE_"))
        .unwrap_or_default();
    features.get(key) == Some(&Availability::Available)
}

fn clamp_level(level: u8) -> u8 {
    level.clamp(AMBIENT_MIN, AMBIENT_MAX)
}

fn in_ambient_range(level: u8) -> bool {
    (AMBIENT_MIN..=AMBIENT_MAX).contains(&level)
}

/// Normalises a raw `NoiseControl`. `fallback_level` (1..20) is shown as the
/// ambient level when the device is not in ambient.
pub fn noise_view(
    protocol: Protocol,
    nc: &NoiseControl,
    features: &BTreeMap<String, Availability>,
    fallback_level: u8,
) -> NoiseView {
    let can_cancel = feature_available(features, Feature::NoiseCancelling);
    let can_ambient = feature_available(features, Feature::AmbientSound);
    let fallback = clamp_level(fallback_level);
    let (mode, ambient_level) = match protocol {
        Protocol::V1 => match (nc.mode, nc.ambient_level) {
            (NoiseMode::Off, _) => (NoiseViewMode::Off, fallback),
            (_, V1_LEVEL_WIND) => (NoiseViewMode::Wind, fallback),
            (_, l) if in_ambient_range(l) => (NoiseViewMode::Ambient, l),
            // 255 (-1) and any other out-of-range byte: noise cancelling.
            _ => (NoiseViewMode::Cancelling, fallback),
        },
        Protocol::V2 => match nc.mode {
            NoiseMode::Off => (NoiseViewMode::Off, fallback),
            NoiseMode::Ambient if in_ambient_range(nc.ambient_level) => {
                (NoiseViewMode::Ambient, nc.ambient_level)
            }
            NoiseMode::Ambient => (NoiseViewMode::Ambient, fallback),
            _ => (NoiseViewMode::Cancelling, fallback),
        },
    };
    NoiseView {
        mode,
        ambient_level,
        focus_on_voice: nc.focus_on_voice,
        can_cancel,
        can_ambient,
        can_wind: protocol == Protocol::V1 && can_cancel,
        can_focus_on_voice: can_ambient,
    }
}

/// Turns a view-level request into the `NoiseControl` to stage, starting from
/// the device's `current` value so fields the view does not model are kept.
/// `level` / `focus` default to the current values (or `fallback_level`).
pub fn noise_request(
    protocol: Protocol,
    current: &NoiseControl,
    mode: NoiseViewMode,
    level: Option<u8>,
    focus: Option<bool>,
    fallback_level: u8,
) -> Result<NoiseControl, String> {
    let mut nc = *current;
    nc.changing_asm_level = false;
    if let Some(f) = focus {
        nc.focus_on_voice = f;
    }
    let ambient = |cur: u8| {
        clamp_level(level.unwrap_or(if in_ambient_range(cur) {
            cur
        } else {
            fallback_level
        }))
    };
    match protocol {
        Protocol::V1 => match mode {
            NoiseViewMode::Off => nc.mode = NoiseMode::Off,
            NoiseViewMode::Cancelling => {
                // MDR_NOISE_MODE_V1_ON == MDR_NOISE_MODE_CANCELLING (Headphones.h:167-168).
                nc.mode = NoiseMode::Cancelling;
                nc.ambient_level = V1_LEVEL_CANCELLING;
            }
            NoiseViewMode::Wind => {
                nc.mode = NoiseMode::Cancelling;
                nc.ambient_level = V1_LEVEL_WIND;
            }
            NoiseViewMode::Ambient => {
                nc.mode = NoiseMode::Cancelling;
                nc.ambient_level = ambient(current.ambient_level);
            }
        },
        Protocol::V2 => match mode {
            NoiseViewMode::Off => nc.mode = NoiseMode::Off,
            NoiseViewMode::Cancelling => nc.mode = NoiseMode::Cancelling,
            NoiseViewMode::Ambient => {
                nc.mode = NoiseMode::Ambient;
                nc.ambient_level = ambient(current.ambient_level);
            }
            NoiseViewMode::Wind => {
                return Err("wind-noise reduction exists only on protocol V1 devices".into())
            }
        },
    }
    Ok(nc)
}

#[cfg(test)]
mod tests {
    use super::*;
    use mdr::{AdaptiveSensitivity, NoiseButtonMode};

    fn v1(mode: NoiseMode, level: u8) -> NoiseControl {
        NoiseControl {
            mode,
            ambient_level: level,
            changing_asm_level: false,
            focus_on_voice: false,
            button_mode: NoiseButtonMode::None,
            adaptive_ambient: false,
            adaptive_sensitivity: AdaptiveSensitivity::Unknown,
        }
    }

    fn features(names: &[&str]) -> BTreeMap<String, Availability> {
        names
            .iter()
            .map(|n| (n.to_string(), Availability::Available))
            .collect()
    }

    fn xm4() -> BTreeMap<String, Availability> {
        features(&["NOISE_CANCELLING", "AMBIENT_SOUND"])
    }

    #[test]
    fn v1_raw_255_is_cancelling_never_the_raw_byte() {
        let v = noise_view(Protocol::V1, &v1(NoiseMode::Cancelling, 255), &xm4(), 20);
        assert_eq!(v.mode, NoiseViewMode::Cancelling);
        assert_eq!(v.ambient_level, 20);
        assert!(v.can_cancel && v.can_ambient && v.can_wind && v.can_focus_on_voice);
    }

    #[test]
    fn v1_raw_0_is_wind() {
        let v = noise_view(Protocol::V1, &v1(NoiseMode::Cancelling, 0), &xm4(), 7);
        assert_eq!(v.mode, NoiseViewMode::Wind);
        assert_eq!(v.ambient_level, 7);
    }

    #[test]
    fn v1_raw_7_is_ambient_level_7() {
        let v = noise_view(Protocol::V1, &v1(NoiseMode::Cancelling, 7), &xm4(), 20);
        assert_eq!(v.mode, NoiseViewMode::Ambient);
        assert_eq!(v.ambient_level, 7);
    }

    #[test]
    fn v1_mode_off_is_off_whatever_the_level() {
        for level in [0, 7, 255] {
            let v = noise_view(Protocol::V1, &v1(NoiseMode::Off, level), &xm4(), 12);
            assert_eq!(v.mode, NoiseViewMode::Off, "level {level}");
            assert_eq!(v.ambient_level, 12);
        }
    }

    #[test]
    fn v2_uses_the_mode_field_and_has_no_wind() {
        let mut nc = v1(NoiseMode::Ambient, 0);
        let f = features(&["NOISE_CANCELLING", "AMBIENT_SOUND"]);
        let v = noise_view(Protocol::V2, &nc, &f, 20);
        assert_eq!(
            (v.mode, v.ambient_level, v.can_wind),
            (NoiseViewMode::Ambient, 20, false)
        );
        nc.ambient_level = 5;
        assert_eq!(noise_view(Protocol::V2, &nc, &f, 20).ambient_level, 5);
        nc.mode = NoiseMode::Cancelling;
        assert_eq!(
            noise_view(Protocol::V2, &nc, &f, 20).mode,
            NoiseViewMode::Cancelling
        );
        assert!(noise_request(Protocol::V2, &nc, NoiseViewMode::Wind, None, None, 20).is_err());
    }

    /// libmdr sends `changing_asm_level` as NcAsmEffect ADJUSTMENT_IN_PROGRESS
    /// (0x10), which the live XM4 ACKs but never applies or notifies
    /// (docs/core/evidence/noise-control-debug.md). Every request is a completed change.
    #[test]
    fn v1_requests_are_completed_changes_never_in_progress() {
        let mut cur = v1(NoiseMode::Cancelling, 255);
        cur.changing_asm_level = true;
        for mode in [
            NoiseViewMode::Off,
            NoiseViewMode::Cancelling,
            NoiseViewMode::Wind,
            NoiseViewMode::Ambient,
        ] {
            let nc = noise_request(Protocol::V1, &cur, mode, Some(10), None, 20).unwrap();
            assert!(!nc.changing_asm_level, "{mode:?}");
        }
        // NC -> ambient 10 is mode ON with level 10 (the frame the XM4 confirmed).
        let nc = noise_request(
            Protocol::V1,
            &cur,
            NoiseViewMode::Ambient,
            Some(10),
            None,
            20,
        )
        .unwrap();
        assert_eq!((nc.mode, nc.ambient_level), (NoiseMode::Cancelling, 10));
    }

    #[test]
    fn v1_requests_round_trip_through_the_view() {
        let cur = v1(NoiseMode::Cancelling, 255);
        let f = xm4();
        let cases = [
            (NoiseViewMode::Off, None),
            (NoiseViewMode::Cancelling, None),
            (NoiseViewMode::Wind, None),
            (NoiseViewMode::Ambient, Some(9)),
        ];
        for (mode, level) in cases {
            let raw = noise_request(Protocol::V1, &cur, mode, level, Some(false), 20).unwrap();
            let back = noise_view(Protocol::V1, &raw, &f, 20);
            assert_eq!(back.mode, mode);
            if let Some(l) = level {
                assert_eq!(back.ambient_level, l);
            }
        }
        // Raw bytes written for V1.
        let nc = noise_request(
            Protocol::V1,
            &cur,
            NoiseViewMode::Cancelling,
            None,
            None,
            20,
        )
        .unwrap();
        assert_eq!((nc.mode, nc.ambient_level), (NoiseMode::Cancelling, 255));
        let nc = noise_request(
            Protocol::V1,
            &cur,
            NoiseViewMode::Ambient,
            Some(40),
            None,
            20,
        )
        .unwrap();
        assert_eq!(nc.ambient_level, 20, "clamped to 1..20");
        let nc = noise_request(Protocol::V1, &cur, NoiseViewMode::Ambient, None, None, 13).unwrap();
        assert_eq!(nc.ambient_level, 13, "fallback when leaving NC");
    }
}
