//! Remembered headphones: one [`DeviceProfile`] per device that reached Ready,
//! kept in `<app_config_dir>/devices.json`
//! (`%APPDATA%\dev.soundconnect.desktop\devices.json`).
//!
//! The service learns (or refreshes) a profile at every Ready and reports the
//! most recently seen one as `remembered` in `engine:status`, so the window can
//! say "WH-1000XM4 - not connected" without scanning. A missing or invalid file
//! is an empty list; entries without an address are dropped.

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use mdr::Protocol;
use serde::{Deserialize, Serialize};

/// File name inside the app config dir.
pub const FILE_NAME: &str = "devices.json";

/// A device that has reached Ready at least once.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceProfile {
    /// `AA:BB:CC:DD:EE:FF`, as Windows lists it.
    pub address: String,
    /// The Bluetooth name Windows lists.
    pub name: String,
    /// `MDR_TEXT_MODEL_NAME` (empty when the device did not report one).
    #[serde(default)]
    pub model_name: String,
    /// `MDR_TEXT_FIRMWARE_VERSION`.
    #[serde(default)]
    pub firmware: String,
    pub protocol: Protocol,
    /// Unix time in milliseconds of the last Ready.
    pub last_seen: u64,
}

/// Milliseconds since the Unix epoch (0 if the clock is before it).
pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// The profile list plus where it is stored (`None`: memory only, as in tests).
#[derive(Debug, Default)]
pub struct Profiles {
    path: Option<PathBuf>,
    list: Vec<DeviceProfile>,
}

impl Profiles {
    /// Loads `path`; missing or invalid means empty.
    pub fn load(path: Option<PathBuf>) -> Self {
        let list = path.as_deref().map(read).unwrap_or_default();
        Self { path, list }
    }

    #[cfg(test)]
    pub fn list(&self) -> &[DeviceProfile] {
        &self.list
    }

    pub fn get(&self, address: &str) -> Option<&DeviceProfile> {
        self.list
            .iter()
            .find(|p| p.address.eq_ignore_ascii_case(address))
    }

    pub fn contains(&self, address: &str) -> bool {
        self.get(address).is_some()
    }

    /// The most recently seen profile.
    pub fn latest(&self) -> Option<&DeviceProfile> {
        self.list.iter().max_by_key(|p| p.last_seen)
    }

    /// Adds or replaces the profile with the same address, then saves. An
    /// empty `model_name` or `firmware`, or a `name` that is empty or just the
    /// address, never replaces a known value.
    pub fn remember(&mut self, mut profile: DeviceProfile) {
        if let Some(old) = self.get(&profile.address) {
            let bare_name = |p: &DeviceProfile| {
                p.name.trim().is_empty() || p.name.eq_ignore_ascii_case(&p.address)
            };
            if bare_name(&profile) && !bare_name(old) {
                profile.name = old.name.clone();
            }
            if profile.model_name.is_empty() {
                profile.model_name = old.model_name.clone();
            }
            if profile.firmware.is_empty() {
                profile.firmware = old.firmware.clone();
            }
        }
        self.list
            .retain(|p| !p.address.eq_ignore_ascii_case(&profile.address));
        self.list.push(profile);
        self.save();
    }

    /// Removes `address`; true when it was remembered.
    pub fn forget(&mut self, address: &str) -> bool {
        let before = self.list.len();
        self.list
            .retain(|p| !p.address.eq_ignore_ascii_case(address));
        let removed = self.list.len() != before;
        if removed {
            self.save();
        }
        removed
    }

    fn save(&self) {
        let Some(path) = &self.path else { return };
        if let Err(e) = write(path, &self.list) {
            eprintln!("profiles: write {} failed: {e}", path.display());
        }
    }
}

fn read(path: &Path) -> Vec<DeviceProfile> {
    let Ok(text) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    match serde_json::from_str::<Vec<serde_json::Value>>(text.trim_start_matches('\u{feff}')) {
        Ok(items) => items
            .into_iter()
            .filter_map(|v| serde_json::from_value::<DeviceProfile>(v).ok())
            .filter(|p| !p.address.is_empty())
            .collect(),
        Err(e) => {
            eprintln!("profiles: {} is not a list: {e}", path.display());
            Vec::new()
        }
    }
}

fn write(path: &Path, list: &[DeviceProfile]) -> std::io::Result<()> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    let json = serde_json::to_string_pretty(list).map_err(std::io::Error::other)?;
    std::fs::write(path, json + "\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "soundconnect-profiles-test-{}-{name}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        dir.join(FILE_NAME)
    }

    fn profile(address: &str, last_seen: u64) -> DeviceProfile {
        DeviceProfile {
            address: address.into(),
            name: "WH-1000XM4".into(),
            model_name: "WH-1000XM4".into(),
            firmware: "2.9.0".into(),
            protocol: Protocol::V1,
            last_seen,
        }
    }

    #[test]
    fn missing_or_invalid_file_is_empty() {
        let path = temp("missing");
        assert!(Profiles::load(Some(path.clone())).list().is_empty());
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, "{ nope").unwrap();
        assert!(Profiles::load(Some(path.clone())).list().is_empty());
        std::fs::write(&path, r#"[{"address":"00:11:22:33:44:51"},{"bad":1}]"#).unwrap();
        assert!(
            Profiles::load(Some(path)).list().is_empty(),
            "entries without the required fields are dropped"
        );
    }

    #[test]
    fn remember_replaces_by_address_and_round_trips() {
        let path = temp("roundtrip");
        let mut p = Profiles::load(Some(path.clone()));
        p.remember(profile("00:11:22:33:44:51", 1));
        p.remember(profile("00:11:22:33:44:52", 5));
        p.remember(profile("00:11:22:33:44:51", 9));
        let text = std::fs::read_to_string(&path).unwrap();
        assert!(text.contains("\"modelName\": \"WH-1000XM4\""), "{text}");
        assert!(text.contains("\"lastSeen\": 9"), "{text}");
        let again = Profiles::load(Some(path.clone()));
        assert_eq!(again.list().len(), 2);
        assert_eq!(again.latest().unwrap().address, "00:11:22:33:44:51");
        let mut again = again;
        assert!(again.forget("00:11:22:33:44:51"));
        assert!(!again.forget("00:11:22:33:44:51"));
        assert_eq!(Profiles::load(Some(path)).list().len(), 1);
    }

    #[test]
    fn remember_never_replaces_known_values_with_empty_or_the_address() {
        let mut p = Profiles::load(None);
        p.remember(profile("00:11:22:33:44:51", 1));
        p.remember(DeviceProfile {
            name: "00:11:22:33:44:51".into(),
            model_name: String::new(),
            firmware: String::new(),
            ..profile("00:11:22:33:44:51", 2)
        });
        let got = p.get("00:11:22:33:44:51").unwrap();
        assert_eq!(
            (
                got.name.as_str(),
                got.model_name.as_str(),
                got.firmware.as_str(),
                got.last_seen
            ),
            ("WH-1000XM4", "WH-1000XM4", "2.9.0", 2)
        );
        p.remember(DeviceProfile {
            model_name: "WH-1000XM5".into(),
            ..profile("00:11:22:33:44:51", 3)
        });
        assert_eq!(p.get("00:11:22:33:44:51").unwrap().model_name, "WH-1000XM5");
    }
}
