//! ABI conformance: struct layouts and exported symbol coverage.
//!
//! The expected sizes are copied from `engine/bin/RelWithDebInfo/struct-sizes.txt`,
//! which the CI build produces by compiling `sizeof`/`alignof` for every struct with
//! the same MSVC 19.51 toolchain that built the DLLs (see
//! `docs/tooling/SoundConnect Desktop - Engine Build.md`). The export lists are the
//! `dumpbin /exports` output for both DLLs, read at test time.

use mdr_sys::*;
use std::collections::BTreeSet;
use std::mem::{align_of, size_of};
use std::path::PathBuf;

macro_rules! layout {
    ($($ty:ident $size:literal $align:literal),* $(,)?) => {
        [$((stringify!($ty), size_of::<$ty>(), align_of::<$ty>(), $size, $align)),*]
    };
}

type Row = (&'static str, usize, usize, usize, usize);

/// `(name, rust size, rust align, C size, C align)`.
/// C numbers copied from engine/bin/RelWithDebInfo/struct-sizes.txt (`name sizeof alignof`).
fn layout_table() -> [Row; 20] {
    layout![
        MDRConnection 72 8,
        MDRDeviceInfo 146 1,
        MDRModel 12 4,
        MDRBattery 16 4,
        MDRPlayback 8 4,
        MDRPlaybackCommand 4 4,
        MDRNoiseControl 28 4,
        MDRSpeakToChat 12 4,
        MDRListening 8 4,
        MDREqualizer 28 4,
        MDRPairedDevice 156 4,
        MDRPairedDeviceAction 24 8,
        MDRPairing 4 4,
        MDRGeneralSettingInfo 12 4,
        MDRGeneralSetting 8 4,
        MDRAssignableControl 12 4,
        MDRPower 20 4,
        MDRVoiceGuidance 8 4,
        MDRConnectionMode 4 4,
        MDRSafeListening 8 4,
    ]
}

#[test]
fn struct_layouts_match_struct_sizes_txt() {
    let rows = layout_table();
    let mut bad = Vec::new();
    for (name, size, align, want_size, want_align) in rows {
        if size != want_size || align != want_align {
            bad.push(format!(
                "{name}: rust {size}/{align}, C {want_size}/{want_align}"
            ));
        }
    }
    assert!(bad.is_empty(), "layout mismatches:\n{}", bad.join("\n"));
}

#[test]
fn hardcoded_table_matches_struct_sizes_txt() {
    // Guards the copied numbers above against drift when the engine is re-fetched.
    let text =
        std::fs::read_to_string(bin_dir().join("struct-sizes.txt")).expect("struct-sizes.txt");
    let rows: Vec<String> = text
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect();
    let expected: Vec<String> = layout_table()
        .iter()
        .map(|(n, _, _, s, a)| format!("{n} {s} {a}"))
        .collect();
    assert_eq!(
        rows, expected,
        "struct-sizes.txt changed; update the layout table"
    );
}

fn bin_dir() -> PathBuf {
    PathBuf::from(env!("MDR_ENGINE_BIN_DIR"))
}

/// Names of every exported symbol in a `dumpbin /exports` listing.
fn exports(file: &str) -> BTreeSet<String> {
    let text =
        std::fs::read_to_string(bin_dir().join(file)).unwrap_or_else(|e| panic!("{file}: {e}"));
    text.lines()
        .filter_map(|line| {
            // "          1    0 0000C940 mdrConnectionConnect = mdrConnectionConnect"
            let mut cols = line.split_whitespace();
            let ordinal = cols.next()?;
            ordinal.parse::<u32>().ok()?;
            let _hint = cols.next()?;
            let _rva = cols.next()?;
            let name = cols.next()?;
            name.starts_with("mdr").then(|| name.to_string())
        })
        .collect()
}

macro_rules! declared {
    ($($f:ident),* $(,)?) => {
        // Referencing each item as a function pointer proves it is declared (and links).
        [$((stringify!($f), $f as *const () as usize)),*]
    };
}

#[test]
fn every_exported_symbol_is_declared() {
    let declared = declared![
        mdrResultString,
        mdrConnectionConnect,
        mdrConnectionDisconnect,
        mdrConnectionRecv,
        mdrConnectionSend,
        mdrConnectionPoll,
        mdrConnectionGetDevicesList,
        mdrConnectionFreeDevicesList,
        mdrConnectionGetLastError,
        mdrHeadphonesCreate,
        mdrHeadphonesDestroy,
        mdrHeadphonesIsInitialized,
        mdrHeadphonesIsReady,
        mdrHeadphonesIsDirty,
        mdrHeadphonesRequestInit,
        mdrHeadphonesRequestSync,
        mdrHeadphonesRequestCommit,
        mdrHeadphonesPoll,
        mdrHeadphonesSetTimeout,
        mdrHeadphonesSetPacketCallback,
        mdrHeadphonesGetFeature,
        mdrHeadphonesGetText,
        mdrHeadphonesGetModel,
        mdrHeadphonesGetBatteries,
        mdrHeadphonesGetPlayback,
        mdrHeadphonesSetPlayback,
        mdrHeadphonesPlayback,
        mdrHeadphonesGetNoiseControl,
        mdrHeadphonesSetNoiseControl,
        mdrHeadphonesGetSpeakToChat,
        mdrHeadphonesSetSpeakToChat,
        mdrHeadphonesGetListening,
        mdrHeadphonesSetListening,
        mdrHeadphonesGetEqualizer,
        mdrHeadphonesSetEqualizer,
        mdrHeadphonesGetEqualizerBands,
        mdrHeadphonesSetEqualizerBands,
        mdrHeadphonesGetEqualizerPresets,
        mdrHeadphonesGetPairedDevices,
        mdrHeadphonesSetPairedDevice,
        mdrHeadphonesGetPairing,
        mdrHeadphonesSetPairing,
        mdrHeadphonesGetSourceSwitchControl,
        mdrHeadphonesSetSourceSwitchControl,
        mdrHeadphonesGetSourceSwitchControlResult,
        mdrHeadphonesRequestRespondToAlert,
        mdrHeadphonesGetGeneralSettingInfo,
        mdrHeadphonesGetGeneralSetting,
        mdrHeadphonesSetGeneralSetting,
        mdrHeadphonesGetAssignableControls,
        mdrHeadphonesGetAssignableControlActions,
        mdrHeadphonesSetAssignableControls,
        mdrHeadphonesGetPower,
        mdrHeadphonesSetPower,
        mdrHeadphonesGetVoiceGuidance,
        mdrHeadphonesSetVoiceGuidance,
        mdrHeadphonesGetConnectionMode,
        mdrHeadphonesSetConnectionMode,
        mdrHeadphonesGetSafeListening,
        mdrHeadphonesSetSafeListening,
        mdrHeadphonesGetWearingStatus,
        mdrConnectionWindowsCreate,
        mdrConnectionWindowsGet,
        mdrConnectionWindowsDestroy,
        mdrConnectionWindowsBLECreate,
        mdrConnectionWindowsBLEGet,
        mdrConnectionWindowsBLEDestroy,
    ];
    let declared_names: BTreeSet<String> = declared.iter().map(|(n, _)| n.to_string()).collect();
    assert!(declared.iter().all(|(_, addr)| *addr != 0));

    let mut exported = exports("mdr-shared-exports.txt");
    assert_eq!(exported.len(), 61, "mdr-shared.dll export count");
    let bt = exports("mdr-bt-shared-exports.txt");
    assert_eq!(bt.len(), 6, "mdr-bt-shared.dll export count");
    exported.extend(bt);

    let missing: Vec<_> = exported.difference(&declared_names).collect();
    assert!(missing.is_empty(), "exported but not declared: {missing:?}");
    let extra: Vec<_> = declared_names.difference(&exported).collect();
    assert!(extra.is_empty(), "declared but not exported: {extra:?}");
}

#[test]
fn abi_version_and_uuids_match_base_h() {
    assert_eq!(MDR_ABI_VERSION, 2);
    assert_eq!(MDR_RESULT_ERROR_ABI_MISMATCH, 12);
    assert_eq!(
        MDR_SERVICE_UUID_XM5.to_str().unwrap(),
        "956C7B26-D49A-4BA8-B03F-B17D393CB6E2"
    );
    assert_eq!(
        MDR_SERVICE_UUID_LEGACY.to_str().unwrap(),
        "96CC203E-5068-46AD-B32D-E316F5E069BA"
    );
    assert_eq!(MDR_FEATURE_MAX_VALUE, MDR_FEATURE_WEARING_STATUS);
    assert_eq!(MDR_EVENT_WEARING_STATUS_CHANGED, 24);
}
