//! Builds a [`WinAudioSnapshot`] for one Bluetooth address. Read-only; every
//! failing read becomes `None` plus a line in `errors`.

use crate::model::{
    address_hex, Adapter, DefaultEndpoint, DuckingMode, Endpoint, EndpointState, Flow,
    WinAudioSnapshot,
};

use super::registry::{self, RegEndpoint};
use super::{adapter, audio, bluetooth, system};

/// The endpoints of one device: anything whose instance id names the address,
/// plus anything in the same device container (the Hands-Free endpoints'
/// instance ids do not carry the address).
pub(crate) struct DeviceEndpoints<'a> {
    hex: String,
    containers: Vec<[u8; 16]>,
    all: &'a [RegEndpoint],
}

impl<'a> DeviceEndpoints<'a> {
    pub(crate) fn new(hex: &str, all: &'a [RegEndpoint]) -> Self {
        let containers = all
            .iter()
            .filter(|e| !hex.is_empty() && e.instance_id.to_ascii_uppercase().contains(hex))
            .filter_map(|e| e.container)
            .collect();
        Self {
            hex: hex.to_string(),
            containers,
            all,
        }
    }

    pub(crate) fn owns(&self, e: &RegEndpoint) -> bool {
        if self.hex.is_empty() {
            return false;
        }
        e.instance_id.to_ascii_uppercase().contains(&self.hex)
            || (e.bluetooth() && e.container.is_some_and(|c| self.containers.contains(&c)))
    }

    pub(crate) fn owns_id(&self, id: &str) -> bool {
        self.all
            .iter()
            .any(|e| e.id.eq_ignore_ascii_case(id) && self.owns(e))
    }

    /// The best match (active first) among this device's endpoints.
    pub(crate) fn pick(&self, filter: impl Fn(&RegEndpoint) -> bool) -> Option<&'a RegEndpoint> {
        let rank = |s: EndpointState| match s {
            EndpointState::Active => 0,
            EndpointState::Disabled => 1,
            EndpointState::Unplugged => 2,
            EndpointState::NotPresent => 3,
        };
        self.all
            .iter()
            .filter(|e| self.owns(e) && filter(e))
            .min_by_key(|e| rank(e.state))
    }

    pub(crate) fn stereo(&self) -> Option<&'a RegEndpoint> {
        self.pick(|e| e.flow == Flow::Render && e.a2dp())
    }

    pub(crate) fn hands_free_render(&self) -> Option<&'a RegEndpoint> {
        self.pick(|e| e.flow == Flow::Render && !e.a2dp() && e.state == EndpointState::Active)
    }

    pub(crate) fn hands_free_capture(&self) -> Option<&'a RegEndpoint> {
        self.pick(|e| e.flow == Flow::Capture && e.state == EndpointState::Active)
    }
}

fn to_endpoint(e: &RegEndpoint) -> Endpoint {
    Endpoint {
        id: e.id.clone(),
        name: e.name.clone(),
        state: e.state,
        bluetooth: e.bluetooth(),
    }
}

/// Reads everything for the headphones at `address`; `codec` is passed through.
pub fn snapshot(address: &str, codec: Option<String>) -> WinAudioSnapshot {
    let _com = audio::Com::init();
    let mut errors: Vec<String> = Vec::new();
    let hex = address_hex(address).unwrap_or_else(|| {
        errors.push(format!("not a Bluetooth address: {address}"));
        String::new()
    });
    let all = registry::endpoints().unwrap_or_else(|e| {
        errors.push(format!("audio endpoints: {e}"));
        Vec::new()
    });
    let device = DeviceEndpoints::new(&hex, &all);
    let stereo = if hex.is_empty() {
        None
    } else {
        device.stereo()
    };
    let stereo_active = stereo.filter(|e| e.state == EndpointState::Active);

    let default =
        |flow: Flow, communications: bool, errors: &mut Vec<String>| match audio::default_endpoint(
            flow,
            communications,
        ) {
            Ok(Some(id)) => Some(DefaultEndpoint {
                name: all
                    .iter()
                    .find(|e| e.id.eq_ignore_ascii_case(&id))
                    .map_or_else(|| id.clone(), |e| e.name.clone()),
                is_this_device: !hex.is_empty() && device.owns_id(&id),
                id,
            }),
            Ok(None) => None,
            Err(e) => {
                errors.push(format!("default endpoint: {e}"));
                None
            }
        };
    let default_render = default(Flow::Render, false, &mut errors);
    let default_communications_render = default(Flow::Render, true, &mut errors);
    let default_capture = default(Flow::Capture, false, &mut errors);
    let default_communications_capture = default(Flow::Capture, true, &mut errors);

    let mut note = |what: &str, e: &dyn std::fmt::Display| errors.push(format!("{what}: {e}"));
    let enhancements_enabled = stereo.and_then(|e| {
        registry::enhancements_enabled(&e.id)
            .map_err(|err| note("enhancements", &err))
            .ok()
    });
    let default_format = stereo.and_then(|e| {
        registry::device_format(&e.id)
            .map_err(|err| note("format", &err))
            .ok()
            .flatten()
    });
    let exclusive = stereo.and_then(|e| {
        registry::exclusive_mode(&e.id)
            .map_err(|err| note("exclusive mode", &err))
            .ok()
    });
    let windows_volume_percent = stereo_active.and_then(|e| {
        audio::volume_percent(&e.id)
            .map_err(|err| note("volume", &err))
            .ok()
    });
    let spatial_sound = stereo_active.map_or("unknown", |e| audio::spatial_sound(&e.id));
    let hands_free_enabled = if hex.is_empty() {
        None
    } else {
        bluetooth::hands_free_enabled(&hex)
            .map_err(|err| note("hands-free", &err))
            .ok()
    };
    let adapter = adapter::radio().map(|radio| Adapter {
        power_saving_allowed: adapter::power_saving_allowed(&radio.instance_id)
            .map_err(|err| note("adapter power", &err))
            .ok()
            .flatten(),
        name: radio.name,
        driver_version: radio.driver_version,
    });
    let bluetooth_service_running = system::bluetooth_service_running()
        .map_err(|err| note("bthserv", &err))
        .ok();

    WinAudioSnapshot {
        address: address.to_string(),
        stereo: stereo.map(to_endpoint),
        hands_free_render: device.hands_free_render().map(to_endpoint),
        hands_free_capture: device.hands_free_capture().map(to_endpoint),
        hands_free_offered: !hex.is_empty() && registry::hands_free_offered(&hex),
        hands_free_enabled,
        default_render,
        default_communications_render,
        default_capture,
        default_communications_capture,
        capture_endpoints: all
            .iter()
            .filter(|e| e.flow == Flow::Capture && e.state == EndpointState::Active)
            .map(to_endpoint)
            .collect(),
        enhancements_enabled,
        spatial_sound: spatial_sound.to_string(),
        mono_audio: registry::mono_audio(),
        default_format,
        exclusive_mode_allowed: exclusive.map(|x| x.0),
        exclusive_priority: exclusive.map(|x| x.1),
        ducking_mode: DuckingMode::from_raw(registry::ducking_raw()),
        absolute_volume_disabled: registry::absolute_volume_disabled(),
        windows_volume_percent,
        adapter,
        bluetooth_service_running,
        codec,
        wifi24_active: system::wifi_24ghz_active(),
        errors,
    }
}
