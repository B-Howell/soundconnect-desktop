//! The read model and the change vocabulary, shared by the reader, the plan
//! builders and the renderer (serialised camelCase, like the engine snapshot).

use serde::{Deserialize, Serialize};

/// Whether an endpoint can play or record now (`DEVICE_STATE_*`, low bits).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum EndpointState {
    Active,
    Disabled,
    NotPresent,
    Unplugged,
}

impl EndpointState {
    /// From the `DeviceState` DWORD of an MMDevices key (the high bits are flags).
    pub fn from_raw(raw: u32) -> Self {
        match raw & 0xF {
            1 => Self::Active,
            2 => Self::Disabled,
            8 => Self::Unplugged,
            _ => Self::NotPresent,
        }
    }
}

/// Playback (`eRender`) or recording (`eCapture`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Flow {
    Render,
    Capture,
}

/// One Windows audio endpoint, by its `IMMDevice` id.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Endpoint {
    /// `{0.0.0.00000000}.{guid}` (render) or `{0.0.1.00000000}.{guid}` (capture).
    pub id: String,
    /// Windows' name, for example "Headphones (WH-1000XM4)".
    pub name: String,
    pub state: EndpointState,
    /// Belongs to a Bluetooth device (any, not only these headphones).
    pub bluetooth: bool,
}

/// The endpoint Windows uses for one role, and whether it is these headphones'.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DefaultEndpoint {
    pub id: String,
    pub name: String,
    pub is_this_device: bool,
}

/// The shared-mode mix format Windows resamples everything to.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioFormat {
    pub sample_rate: u32,
    pub bits_per_sample: u16,
    pub channels: u16,
}

/// "When Windows detects communications activity" (`UserDuckingPreference`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DuckingMode {
    MuteOthers,
    Reduce80,
    Reduce50,
    DoNothing,
}

impl DuckingMode {
    /// The DWORD: 0 mute, 1 reduce 80 % (Windows' default, also when absent), 2 reduce 50 %, 3 do nothing.
    pub fn from_raw(raw: Option<u32>) -> Self {
        match raw {
            Some(0) => Self::MuteOthers,
            Some(2) => Self::Reduce50,
            Some(3) => Self::DoNothing,
            _ => Self::Reduce80,
        }
    }

    pub fn to_raw(self) -> u32 {
        match self {
            Self::MuteOthers => 0,
            Self::Reduce80 => 1,
            Self::Reduce50 => 2,
            Self::DoNothing => 3,
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::MuteOthers => "Mute all other sounds",
            Self::Reduce80 => "Reduce other sounds by 80%",
            Self::Reduce50 => "Reduce other sounds by 50%",
            Self::DoNothing => "Do nothing",
        }
    }
}

/// The PC's Bluetooth radio.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Adapter {
    pub name: String,
    pub driver_version: Option<String>,
    /// Device Manager's "Allow the computer to turn off this device to save power".
    pub power_saving_allowed: Option<bool>,
}

/// Everything Windows does to the sound on its way to the headphones, read
/// for the device with Bluetooth address `address`. Fields that could not be
/// read are `None`; the reason is in `errors`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WinAudioSnapshot {
    /// `AA:BB:CC:12:34:56` form.
    pub address: String,
    /// The headphones' stereo (A2DP) playback endpoint, the active one if several.
    pub stereo: Option<Endpoint>,
    /// The Hands-Free (HFP) playback endpoint ("Headset"), present only with Hands-Free on.
    pub hands_free_render: Option<Endpoint>,
    /// The headphones' microphone, present only with Hands-Free on.
    pub hands_free_capture: Option<Endpoint>,
    /// The headphones offer Hands-Free or Headset (cached SDP records).
    pub hands_free_offered: bool,
    /// The Hands-Free or Headset Bluetooth service is installed for the device.
    pub hands_free_enabled: Option<bool>,
    pub default_render: Option<DefaultEndpoint>,
    pub default_communications_render: Option<DefaultEndpoint>,
    pub default_capture: Option<DefaultEndpoint>,
    pub default_communications_capture: Option<DefaultEndpoint>,
    /// Active recording endpoints, for picking a microphone.
    pub capture_endpoints: Vec<Endpoint>,
    /// Windows audio effects on the stereo endpoint (`Disable_SysFx` absent or 0).
    pub enhancements_enabled: Option<bool>,
    /// `off`, `on` or `unknown` (best effort; Windows has no getter).
    pub spatial_sound: String,
    pub mono_audio: bool,
    pub default_format: Option<AudioFormat>,
    pub exclusive_mode_allowed: Option<bool>,
    pub exclusive_priority: Option<bool>,
    pub ducking_mode: DuckingMode,
    pub absolute_volume_disabled: bool,
    pub windows_volume_percent: Option<u8>,
    pub adapter: Option<Adapter>,
    pub bluetooth_service_running: Option<bool>,
    /// From the engine snapshot (the headphones report it); not read here.
    pub codec: Option<String>,
    /// Connected to Wi-Fi on a 2.4 GHz channel (best effort).
    pub wifi24_active: Option<bool>,
    /// Reads that failed, one line each.
    #[serde(default)]
    pub errors: Vec<String>,
}

impl WinAudioSnapshot {
    /// True when `id` is one of these headphones' endpoints.
    pub fn is_own_endpoint(&self, id: &str) -> bool {
        [
            &self.stereo,
            &self.hands_free_render,
            &self.hands_free_capture,
        ]
        .into_iter()
        .flatten()
        .any(|e| e.id.eq_ignore_ascii_case(id))
    }
}

/// One allow-listed change. `admin` changes run in the elevated helper.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Change {
    /// Default device (console + multimedia roles) or default communications device.
    SetDefaultEndpoint {
        flow: Flow,
        communications: bool,
        id: String,
        name: String,
    },
    /// The Hands-Free playback and microphone endpoints as communications
    /// defaults, found when applied (they exist only once Hands-Free is on).
    UseHandsFreeForCommunications {
        address: String,
    },
    SetEnhancements {
        endpoint_id: String,
        enabled: bool,
    },
    SetFormat {
        endpoint_id: String,
        sample_rate: u32,
        bits_per_sample: u16,
    },
    SetExclusiveMode {
        endpoint_id: String,
        allowed: bool,
        priority: bool,
    },
    SetDucking {
        mode: DuckingMode,
    },
    SetMonoAudio {
        enabled: bool,
    },
    /// Admin: the Hands-Free and Headset Bluetooth services for one device.
    SetHandsFree {
        address: String,
        enabled: bool,
    },
    /// Admin: `DisableAbsoluteVolume` (takes effect after a reconnect).
    SetAbsoluteVolumeDisabled {
        disabled: bool,
    },
    /// Admin: "Allow the computer to turn off this device" on the radio.
    SetAdapterPowerSaving {
        allowed: bool,
    },
}

impl Change {
    /// Needs the elevated helper (one UAC prompt per batch).
    pub fn needs_admin(&self) -> bool {
        matches!(
            self,
            Self::SetHandsFree { .. }
                | Self::SetAbsoluteVolumeDisabled { .. }
                | Self::SetAdapterPowerSaving { .. }
        )
    }

    /// One plain sentence for the preview sheet.
    pub fn summary(&self) -> String {
        match self {
            Self::SetDefaultEndpoint {
                flow,
                communications,
                name,
                ..
            } => {
                let what = match (flow, communications) {
                    (Flow::Render, false) => "default playback device",
                    (Flow::Render, true) => "playback device for calls",
                    (Flow::Capture, false) => "default microphone",
                    (Flow::Capture, true) => "microphone for calls",
                };
                format!("Make {name} the {what}.")
            }
            Self::UseHandsFreeForCommunications { .. } => {
                "Use the headphones' hands-free audio and microphone for voice chat and calls."
                    .into()
            }
            Self::SetEnhancements { enabled, .. } => {
                format!("Turn audio enhancements {}.", on_off(*enabled))
            }
            Self::SetFormat {
                sample_rate,
                bits_per_sample,
                ..
            } => format!(
                "Set the format to {} kHz, {bits_per_sample}-bit.",
                khz(*sample_rate)
            ),
            Self::SetExclusiveMode {
                allowed, priority, ..
            } => match (allowed, priority) {
                (false, _) => "Do not let apps take exclusive control.".into(),
                (true, false) => "Let apps take exclusive control, without priority.".into(),
                (true, true) => "Let apps take exclusive control, with priority.".into(),
            },
            Self::SetDucking { mode } => {
                format!("During calls: {}.", mode.label().to_lowercase())
            }
            Self::SetMonoAudio { enabled } => format!("Turn mono audio {}.", on_off(*enabled)),
            Self::SetHandsFree { enabled, .. } => {
                format!(
                    "Turn the hands-free profile (headphone mic, mono sound) {}.",
                    on_off(*enabled)
                )
            }
            Self::SetAbsoluteVolumeDisabled { disabled } => {
                format!("Turn absolute volume {}.", on_off(!*disabled))
            }
            Self::SetAdapterPowerSaving { allowed } => format!(
                "{} Windows to turn off the Bluetooth adapter to save power.",
                if *allowed { "Allow" } else { "Do not allow" }
            ),
        }
    }
}

fn on_off(on: bool) -> &'static str {
    if on {
        "on"
    } else {
        "off"
    }
}

fn khz(rate: u32) -> String {
    if rate.is_multiple_of(1000) {
        (rate / 1000).to_string()
    } else {
        format!("{:.1}", f64::from(rate) / 1000.0)
    }
}

/// What a change did: applied (the write call succeeded) and verified (the
/// value read back afterwards matches).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeResult {
    pub change: Change,
    pub applied: bool,
    pub verified: bool,
    pub error: Option<String>,
}

impl ChangeResult {
    pub fn failed(change: Change, error: impl Into<String>) -> Self {
        Self {
            change,
            applied: false,
            verified: false,
            error: Some(error.into()),
        }
    }
}

/// The page's two modes: "Stereo audio" (games, music, video; headphone mic
/// off) or "Mono audio with mic" (the hands-free profile for voice chat).
/// The 0.1.6 to 0.1.8 names `music` / `calls` are still accepted.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FixKind {
    #[serde(alias = "music")]
    Stereo,
    #[serde(alias = "calls")]
    MonoMic,
}

/// A change with its preview sentence.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlannedChange {
    pub change: Change,
    pub summary: String,
    pub admin: bool,
}

impl From<Change> for PlannedChange {
    fn from(change: Change) -> Self {
        Self {
            summary: change.summary(),
            admin: change.needs_admin(),
            change,
        }
    }
}

/// What a fix (or a restore) would change, for the preview sheet.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Plan {
    pub changes: Vec<PlannedChange>,
    /// Things the app will not change but the user should know (spatial sound, mono calls).
    pub notes: Vec<String>,
}

impl Plan {
    pub fn needs_admin(&self) -> bool {
        self.changes.iter().any(|c| c.admin)
    }

    /// The changes split into (user, admin).
    pub fn split(&self) -> (Vec<Change>, Vec<Change>) {
        self.changes
            .iter()
            .map(|c| c.change.clone())
            .partition(|c| !c.needs_admin())
    }
}

/// `AA:BB:CC:12:34:56` (any separators, any case) to the 12 upper-case hex
/// digits Windows uses in device instance ids; `None` if it is not an address.
pub fn address_hex(address: &str) -> Option<String> {
    let hex: String = address
        .chars()
        .filter(char::is_ascii_hexdigit)
        .collect::<String>()
        .to_ascii_uppercase();
    (hex.len() == 12).then_some(hex)
}
