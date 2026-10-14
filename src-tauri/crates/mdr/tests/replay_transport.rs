//! Transport trait, ConnectionBox trampolines and the capture replay transport.
//!
//! The trampolines are exercised through the real `mdrConnection*` entry points of
//! `mdr-shared.dll`, which dispatch through the `MDRConnection` vtable exactly as
//! libmdr does internally.

mod common;

use mdr::{
    ConnectStatus, ConnectionBox, DeviceInfo, Error, PollStatus, ReplayTransport, Result, Transport,
};
use std::ffi::{c_char, c_int, CStr};

#[test]
fn xm3_capture_loads_187_frames_sorted_by_ordinal() {
    let replay = ReplayTransport::from_capture_dir(common::capture("WH-1000XM3-4.5.2"))
        .expect("load capture");
    assert_eq!(replay.frame_count(), 187);
    // Observed with `xxd` on the first file
    // (mdr-packet-1791485921245-000001-rx.type-DATA_MDR-0c.seq-00.cmd-CONNECT_RET_PROTOCOL_INFO-01.bin):
    // 3e0c 0000 0000 0401 0040 1061 3c -> '>' start-of-frame.
    assert_eq!(replay.rx_bytes()[0], 0x3E);
    assert_eq!(
        &replay.rx_bytes()[..13],
        &[0x3E, 0x0C, 0, 0, 0, 0, 0x04, 0x01, 0x00, 0x40, 0x10, 0x61, 0x3C]
    );
    let ordinals: Vec<u32> = replay.frames().iter().map(|f| f.ordinal).collect();
    assert!(
        ordinals.windows(2).all(|w| w[0] < w[1]),
        "frames sorted by ordinal"
    );
    assert_eq!(ordinals[0], 1);
    let total: usize = replay.frames().iter().map(|f| f.bytes.len()).sum();
    assert_eq!(total, replay.rx_bytes().len());
    assert!(replay.tx_bytes().is_empty());
}

#[test]
fn xm3_capture_is_protocol_v1_and_xm5_is_v2() {
    let xm3 = ReplayTransport::from_capture_dir(common::capture("WH-1000XM3-4.5.2")).unwrap();
    assert_eq!(xm3.detect_protocol(), mdr::Protocol::V1);
    let xm5 = ReplayTransport::from_capture_dir(common::capture("WF-1000XM5-6.1.0")).unwrap();
    assert_eq!(xm5.detect_protocol(), mdr::Protocol::V2);
}

#[test]
fn missing_capture_dir_is_an_error() {
    assert!(ReplayTransport::from_capture_dir(common::capture("does-not-exist")).is_err());
}

#[test]
fn trampolines_map_results_like_replay_cpp() {
    let replay = ReplayTransport::from_bytes(vec![1, 2, 3, 4, 5]);
    let mut conn = ConnectionBox::new(Box::new(replay));
    let raw = conn.as_raw();
    // SAFETY: `raw` points at the vtable owned by `conn`, which outlives every call
    // below; buffers are valid for the sizes passed.
    unsafe {
        assert_eq!(
            mdr_sys::mdrConnectionConnect(
                raw,
                c"AA:BB:CC:DD:EE:FF".as_ptr(),
                mdr_sys::MDR_SERVICE_UUID_LEGACY.as_ptr()
            ),
            mdr_sys::MDR_RESULT_OK
        );
        let mut buf = [0 as c_char; 3];
        let mut got: c_int = -1;
        assert_eq!(
            mdr_sys::mdrConnectionRecv(raw, buf.as_mut_ptr(), 3, &mut got),
            mdr_sys::MDR_RESULT_OK
        );
        assert_eq!((got, buf), (3, [1, 2, 3]));
        assert_eq!(
            mdr_sys::mdrConnectionRecv(raw, buf.as_mut_ptr(), 3, &mut got),
            mdr_sys::MDR_RESULT_OK
        );
        assert_eq!(got, 2);
        // Exhausted: INPROGRESS with *received = 0 (Replay.cpp MockTransport::Receive).
        got = -1;
        assert_eq!(
            mdr_sys::mdrConnectionRecv(raw, buf.as_mut_ptr(), 3, &mut got),
            mdr_sys::MDR_RESULT_INPROGRESS
        );
        assert_eq!(got, 0);

        let src = [9 as c_char, 8, 7];
        let mut sent: c_int = 0;
        assert_eq!(
            mdr_sys::mdrConnectionSend(raw, src.as_ptr(), 3, &mut sent),
            mdr_sys::MDR_RESULT_OK
        );
        assert_eq!(sent, 3);
        assert_eq!(mdr_sys::mdrConnectionPoll(raw, 0), mdr_sys::MDR_RESULT_OK);

        let mut list: *mut mdr_sys::MDRDeviceInfo = std::ptr::null_mut();
        let mut count: c_int = -1;
        assert_eq!(
            mdr_sys::mdrConnectionGetDevicesList(raw, &mut list, &mut count),
            mdr_sys::MDR_RESULT_OK
        );
        assert_eq!(count, 0);
        assert_eq!(
            mdr_sys::mdrConnectionFreeDevicesList(raw, &mut list),
            mdr_sys::MDR_RESULT_OK
        );
        assert!(list.is_null());

        let err = CStr::from_ptr(mdr_sys::mdrConnectionGetLastError(raw));
        assert_eq!(err.to_str().unwrap(), "replay transport");
        mdr_sys::mdrConnectionDisconnect(raw);
    }
    let replay = conn.transport_as::<ReplayTransport>().expect("downcast");
    assert_eq!(replay.tx_bytes(), &[9, 8, 7]);
    assert!(replay.disconnected());
}

/// A transport that lists devices, fails sends and panics on poll.
struct Faulty;

impl Transport for Faulty {
    fn connect(&mut self, _mac: &str, _uuid: &str) -> Result<ConnectStatus> {
        Ok(ConnectStatus::InProgress)
    }
    fn disconnect(&mut self) {}
    fn recv(&mut self, _dst: &mut [u8]) -> Result<Option<usize>> {
        Ok(None)
    }
    fn send(&mut self, _src: &[u8]) -> Result<usize> {
        Err(Error::Transport("socket closed".into()))
    }
    fn poll(&mut self, _timeout_ms: i32) -> Result<PollStatus> {
        panic!("boom")
    }
    fn devices(&mut self) -> Result<Vec<DeviceInfo>> {
        Ok(vec![DeviceInfo {
            name: "WH-1000XM4".into(),
            mac: "00:11:22:33:44:55".into(),
        }])
    }
    fn last_error(&self) -> String {
        String::new()
    }
}

#[test]
fn trampolines_report_errors_devices_and_contain_panics() {
    let mut conn = ConnectionBox::new(Box::new(Faulty));
    let raw = conn.as_raw();
    // SAFETY: as above; `conn` owns the vtable and outlives these calls.
    unsafe {
        assert_eq!(
            mdr_sys::mdrConnectionConnect(raw, c"x".as_ptr(), c"y".as_ptr()),
            mdr_sys::MDR_RESULT_INPROGRESS
        );
        let mut sent: c_int = -1;
        let src = [0 as c_char];
        assert_eq!(
            mdr_sys::mdrConnectionSend(raw, src.as_ptr(), 1, &mut sent),
            mdr_sys::MDR_RESULT_ERROR_GENERAL
        );
        let err = CStr::from_ptr(mdr_sys::mdrConnectionGetLastError(raw))
            .to_str()
            .unwrap()
            .to_owned();
        assert!(err.contains("socket closed"), "{err}");

        // A panic must not unwind into C; it becomes ERROR_GENERAL.
        assert_eq!(
            mdr_sys::mdrConnectionPoll(raw, 0),
            mdr_sys::MDR_RESULT_ERROR_GENERAL
        );
        let err = CStr::from_ptr(mdr_sys::mdrConnectionGetLastError(raw))
            .to_str()
            .unwrap()
            .to_owned();
        assert!(err.contains("panic"), "{err}");

        let mut list: *mut mdr_sys::MDRDeviceInfo = std::ptr::null_mut();
        let mut count: c_int = 0;
        assert_eq!(
            mdr_sys::mdrConnectionGetDevicesList(raw, &mut list, &mut count),
            mdr_sys::MDR_RESULT_OK
        );
        assert_eq!(count, 1);
        let dev = &*list;
        assert_eq!(
            CStr::from_ptr(dev.szDeviceName.as_ptr()).to_str().unwrap(),
            "WH-1000XM4"
        );
        assert_eq!(
            CStr::from_ptr(dev.szDeviceMacAddress.as_ptr())
                .to_str()
                .unwrap(),
            "00:11:22:33:44:55"
        );
        assert_eq!(
            mdr_sys::mdrConnectionFreeDevicesList(raw, &mut list),
            mdr_sys::MDR_RESULT_OK
        );
        assert!(list.is_null());
    }
}
