//! Protocol family (`MDRProtocolVersion`, `Headphones.h:11-13`).

use serde::{Deserialize, Serialize};

/// The MDR protocol family a device speaks; fixed at engine creation.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Protocol {
    /// `MDR_PROTOCOL_V1`: XM4 and older (RFCOMM `MDR_SERVICE_UUID_LEGACY`).
    V1,
    /// `MDR_PROTOCOL_V2`: XM5 and newer (RFCOMM `MDR_SERVICE_UUID_XM5`, and all BLE).
    V2,
}

impl Protocol {
    /// The C value.
    pub fn raw(self) -> mdr_sys::MDRProtocolVersion {
        match self {
            Protocol::V1 => mdr_sys::MDR_PROTOCOL_V1,
            Protocol::V2 => mdr_sys::MDR_PROTOCOL_V2,
        }
    }

    /// The Bluetooth Classic service UUID for this family (`Base.h:47-49`).
    pub fn service_uuid(self) -> &'static str {
        let c = match self {
            Protocol::V1 => mdr_sys::MDR_SERVICE_UUID_LEGACY,
            Protocol::V2 => mdr_sys::MDR_SERVICE_UUID_XM5,
        };
        c.to_str().expect("ASCII UUID")
    }
}
