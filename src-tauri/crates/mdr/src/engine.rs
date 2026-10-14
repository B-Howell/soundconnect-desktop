//! [`Engine`]: an owned `MDRHeadphones` instance over a [`Transport`].
//!
//! Lifecycle (Headphones.h:464-530, driven like client/Client.cpp):
//! `create` (transport already connected) -> `request_init` -> `poll` until
//! `InitializeComplete` -> `request_sync` -> `poll` until `SyncComplete`. After that,
//! `NeedSync` means "call `request_sync` once `is_ready`"; `set_*` stage changes
//! (`is_dirty`) that `commit` applies (`ApplyComplete`).

use crate::enums::*;
use crate::error::{Error, Result};
use crate::events::Event;
use crate::packet::PacketDirection;
use crate::protocol::Protocol;
use crate::snapshot::{Snapshot, Texts};
use crate::transport::{ConnectionBox, Transport};
use crate::types::*;
use mdr_sys::*;
use std::collections::BTreeMap;
use std::ptr::{null_mut, NonNull};

/// An engine instance bound to one connected transport.
pub struct Engine {
    handle: NonNull<MDRHeadphones>,
    // Declared after `handle`; Drop destroys the handle first, then this drops.
    conn: ConnectionBox,
    protocol: Protocol,
    /// The packet observer's closure, owned through a raw pointer (from
    /// `Box::into_raw`) because libmdr holds the same pointer as `user_data`;
    /// freed by `free_packet_cb` after libmdr stops using it. Null when unset.
    packet_cb: *mut PacketCallback,
}

/// Observes every packed frame crossing the link (see [`Engine::set_packet_callback`]).
pub type PacketCallback = Box<dyn FnMut(PacketDirection, &[u8]) + Send>;

unsafe extern "C" fn packet_trampoline(
    user_data: *mut std::ffi::c_void,
    direction: MDRPacketDirection,
    frame: *const std::ffi::c_uchar,
    frame_size: std::ffi::c_int,
) {
    if user_data.is_null() || frame.is_null() || frame_size < 0 {
        return;
    }
    // SAFETY: `user_data` is the `*mut PacketCallback` installed by
    // `set_packet_callback`, alive until the callback is replaced or the handle is
    // destroyed; libmdr calls it only from inside an engine call on the owning
    // thread, so there is no concurrent access. `frame` has `frame_size` bytes.
    let cb = unsafe { &mut *user_data.cast::<PacketCallback>() };
    // SAFETY: libmdr passes a pointer to `frame_size` readable bytes, valid for
    // the duration of this call (Headphones.cpp `mPacketCallback(...)`).
    let bytes = unsafe { std::slice::from_raw_parts(frame, frame_size as usize) };
    let dir = PacketDirection::from_raw(direction);
    // A panic must not unwind into C++.
    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| cb(dir, bytes)));
}

// SAFETY: libmdr keeps no thread-affine state in an MDRHeadphones; every call goes
// through `&mut self` (or `&self` for the const queries), so it is never used from
// two threads at once. The transport is `Send` by trait bound, and so is the
// packet closure behind `packet_cb` (`PacketCallback` requires `Send`).
unsafe impl Send for Engine {}

type ListFn<T> = unsafe extern "C" fn(*mut MDRHeadphones, *mut T, *mut u32) -> MDRResult;

impl Engine {
    /// Creates the instance. The transport must already be connected
    /// (Headphones.h:470-472); `protocol` must match the device family.
    pub fn create(transport: Box<dyn Transport>, protocol: Protocol) -> Result<Self> {
        let mut conn = ConnectionBox::new(transport);
        let mut out: *mut MDRHeadphones = null_mut();
        // SAFETY: `conn` owns a valid vtable that outlives the instance (it is moved
        // into the Engine, which destroys the handle before dropping it); `out` is a
        // valid out-pointer.
        let code = unsafe {
            mdrHeadphonesCreate(MDR_ABI_VERSION, conn.as_raw(), protocol.raw(), &mut out)
        };
        if code != MDR_RESULT_OK {
            return Err(Error::Mdr {
                code,
                call: "mdrHeadphonesCreate",
                detail: String::new(),
            });
        }
        let handle = NonNull::new(out).ok_or(Error::Mdr {
            code: MDR_RESULT_ERROR_GENERAL,
            call: "mdrHeadphonesCreate",
            detail: "returned OK with a null instance".into(),
        })?;
        Ok(Self {
            handle,
            conn,
            protocol,
            packet_cb: std::ptr::null_mut(),
        })
    }

    fn h(&self) -> *mut MDRHeadphones {
        self.handle.as_ptr()
    }

    fn check(&self, code: MDRResult, call: &'static str) -> Result<()> {
        if code == MDR_RESULT_OK {
            return Ok(());
        }
        let detail = if code == MDR_RESULT_INPROGRESS {
            String::new()
        } else {
            self.raw_text(MDR_TEXT_LAST_ERROR, 0).unwrap_or_default()
        };
        Err(Error::Mdr { code, call, detail })
    }

    /// The protocol family chosen at creation.
    pub fn protocol(&self) -> Protocol {
        self.protocol
    }

    /// The transport, downcast to its concrete type (e.g. `ReplayTransport`).
    ///
    /// Takes `&mut self` on purpose: libmdr may call the transport from any engine
    /// call, including `&self` readers, so the borrow must exclude all of them.
    pub fn transport_as<T: Transport>(&mut self) -> Option<&T> {
        self.conn.transport_as::<T>()
    }

    /// Mutable access to the transport, downcast to its concrete type.
    pub fn transport_as_mut<T: Transport>(&mut self) -> Option<&mut T> {
        self.conn.transport_as_mut::<T>()
    }

    /// `mdrHeadphonesSetPacketCallback`: `Some(f)` observes every packed TX/RX
    /// frame (`'>' ... '<'`, see [`crate::packet`]); `None` stops observing.
    pub fn set_packet_callback(&mut self, callback: Option<PacketCallback>) {
        let user: *mut PacketCallback = match callback {
            Some(cb) => Box::into_raw(Box::new(cb)),
            None => null_mut(),
        };
        let trampoline = if user.is_null() {
            None
        } else {
            Some(packet_trampoline as unsafe extern "C" fn(_, _, _, _))
        };
        // SAFETY: live instance; `user` is null or a leaked box owned by `self`
        // until it is replaced here or freed after `mdrHeadphonesDestroy`.
        unsafe { mdrHeadphonesSetPacketCallback(self.h(), trampoline, user.cast()) };
        // libmdr now holds the new pointer (or none), so the old one is unused.
        self.free_packet_cb();
        self.packet_cb = user;
    }

    fn free_packet_cb(&mut self) {
        if !self.packet_cb.is_null() {
            // SAFETY: `packet_cb` came from `Box::into_raw` in `set_packet_callback`
            // and libmdr no longer references it (replaced or destroyed).
            drop(unsafe { Box::from_raw(self.packet_cb) });
            self.packet_cb = null_mut();
        }
    }

    // ---- lifecycle -------------------------------------------------------

    /// `mdrHeadphonesRequestInit`. Must be called first.
    pub fn request_init(&mut self) -> Result<()> {
        // SAFETY: `handle` is a live instance owned by self.
        let code = unsafe { mdrHeadphonesRequestInit(self.h()) };
        self.check(code, "mdrHeadphonesRequestInit")
    }

    /// `mdrHeadphonesRequestSync`. Call after `InitializeComplete`, or after `NeedSync` once ready.
    pub fn request_sync(&mut self) -> Result<()> {
        // SAFETY: live instance.
        let code = unsafe { mdrHeadphonesRequestSync(self.h()) };
        self.check(code, "mdrHeadphonesRequestSync")
    }

    /// `mdrHeadphonesRequestCommit`: applies staged `set_*` changes (no-op when clean).
    pub fn commit(&mut self) -> Result<()> {
        // SAFETY: live instance.
        let code = unsafe { mdrHeadphonesRequestCommit(self.h()) };
        self.check(code, "mdrHeadphonesRequestCommit")
    }

    /// `mdrHeadphonesPoll`: non-blocking; processes pending I/O and reports one event.
    pub fn poll(&mut self) -> Result<Event> {
        let mut ev: MDREvent = MDR_EVENT_NONE;
        // SAFETY: live instance; `ev` is a valid out-pointer.
        let code = unsafe { mdrHeadphonesPoll(self.h(), &mut ev) };
        self.check(code, "mdrHeadphonesPoll")?;
        Ok(Event::from_raw(ev))
    }

    /// `mdrHeadphonesIsInitialized`
    pub fn is_initialized(&self) -> bool {
        // SAFETY: live instance; const query.
        raw_bool(unsafe { mdrHeadphonesIsInitialized(self.h()) })
    }

    /// `mdrHeadphonesIsReady`: no request in flight; `set_*`/requests may be issued.
    pub fn is_ready(&self) -> bool {
        // SAFETY: live instance; const query.
        raw_bool(unsafe { mdrHeadphonesIsReady(self.h()) })
    }

    /// `mdrHeadphonesIsDirty`: staged changes await `commit`.
    pub fn is_dirty(&self) -> bool {
        // SAFETY: live instance; const query.
        raw_bool(unsafe { mdrHeadphonesIsDirty(self.h()) })
    }

    /// `mdrHeadphonesSetTimeout` (value must be positive).
    pub fn set_timeout(&mut self, kind: TimeoutType, value: i32) -> Result<()> {
        // SAFETY: live instance.
        let code = unsafe { mdrHeadphonesSetTimeout(self.h(), kind.raw(), value) };
        self.check(code, "mdrHeadphonesSetTimeout")
    }

    // ---- capability and text ----------------------------------------------

    /// `mdrHeadphonesGetFeature`. Errors map to `Unknown`.
    pub fn feature(&self, feature: Feature) -> Availability {
        let mut out: MDRFeatureAvailability = MDR_AVAILABILITY_UNKNOWN;
        // SAFETY: live instance; valid out-pointer.
        let code = unsafe { mdrHeadphonesGetFeature(self.h(), feature.raw(), &mut out) };
        if code == MDR_RESULT_OK {
            Availability::from_raw(out)
        } else {
            Availability::Unknown
        }
    }

    /// Every known feature, keyed like [`Snapshot::features`].
    pub fn features(&self) -> BTreeMap<String, Availability> {
        Feature::ALL
            .iter()
            .map(|f| (f.key(), self.feature(*f)))
            .collect()
    }

    fn raw_text(&self, text: MDRText, index: u32) -> Result<String> {
        let mut size: u32 = 0;
        // SAFETY: live instance; NULL buffer with *size == 0 asks for the required size
        // (libmdr/src/Headphones.cpp text copy helper).
        let code = unsafe { mdrHeadphonesGetText(self.h(), text, index, null_mut(), &mut size) };
        if code != MDR_RESULT_OK {
            return Err(Error::Mdr {
                code,
                call: "mdrHeadphonesGetText",
                detail: String::new(),
            });
        }
        if size == 0 {
            return Ok(String::new());
        }
        let mut buf = vec![0u8; size as usize];
        // SAFETY: `buf` has `size` writable bytes.
        let code = unsafe {
            mdrHeadphonesGetText(self.h(), text, index, buf.as_mut_ptr().cast(), &mut size)
        };
        if code != MDR_RESULT_OK {
            return Err(Error::Mdr {
                code,
                call: "mdrHeadphonesGetText",
                detail: String::new(),
            });
        }
        Ok(text_from_buf(&buf))
    }

    /// `mdrHeadphonesGetText` (two-call). `index` is used by indexed texts
    /// (paired devices, general settings, equalizer preset names).
    pub fn text(&self, text: Text, index: u32) -> Result<String> {
        self.raw_text(text.raw(), index)
    }

    /// `MDR_TEXT_MODEL_NAME`
    pub fn model_name(&self) -> Result<String> {
        self.raw_text(MDR_TEXT_MODEL_NAME, 0)
    }

    /// `MDR_TEXT_FIRMWARE_VERSION`
    pub fn firmware_version(&self) -> Result<String> {
        self.raw_text(MDR_TEXT_FIRMWARE_VERSION, 0)
    }

    /// `MDR_TEXT_LAST_ERROR`
    pub fn last_error(&self) -> String {
        self.raw_text(MDR_TEXT_LAST_ERROR, 0).unwrap_or_default()
    }

    /// `MDR_TEXT_LAST_ALERT`
    pub fn last_alert(&self) -> Result<String> {
        self.raw_text(MDR_TEXT_LAST_ALERT, 0)
    }

    fn texts(&self) -> Texts {
        let t = |id| self.raw_text(id, 0).ok();
        Texts {
            model_name: t(MDR_TEXT_MODEL_NAME),
            firmware_version: t(MDR_TEXT_FIRMWARE_VERSION),
            unique_id: t(MDR_TEXT_UNIQUE_ID),
            model_series: t(MDR_TEXT_MODEL_SERIES),
            model_color: t(MDR_TEXT_MODEL_COLOR),
            last_alert: t(MDR_TEXT_LAST_ALERT),
            track_title: t(MDR_TEXT_TRACK_TITLE),
            track_album: t(MDR_TEXT_TRACK_ALBUM),
            track_artist: t(MDR_TEXT_TRACK_ARTIST),
        }
    }

    // ---- readers ------------------------------------------------------------

    fn get<R: Default>(
        &self,
        f: unsafe extern "C" fn(*mut MDRHeadphones, *mut R) -> MDRResult,
        call: &'static str,
    ) -> Result<R> {
        let mut out = R::default();
        // SAFETY: live instance; `out` is a valid, initialized out-struct of the type
        // `f` writes (each `f` is a `mdrHeadphonesGet*` declared with that type).
        let code = unsafe { f(self.h(), &mut out) };
        self.check(code, call)?;
        Ok(out)
    }

    /// Two-call list read: NULL + count 0 for the size, then fill.
    fn list<T: Default + Clone>(&self, f: ListFn<T>, call: &'static str) -> Result<Vec<T>> {
        let mut count: u32 = 0;
        // SAFETY: live instance; NULL buffer with *count == 0 is the size query.
        let code = unsafe { f(self.h(), null_mut(), &mut count) };
        self.check(code, call)?;
        if count == 0 {
            return Ok(Vec::new());
        }
        let mut v = vec![T::default(); count as usize];
        // SAFETY: `v` holds `count` initialized elements of the type `f` writes.
        let code = unsafe { f(self.h(), v.as_mut_ptr(), &mut count) };
        self.check(code, call)?;
        v.truncate(count as usize);
        Ok(v)
    }

    /// `mdrHeadphonesGetModel`
    pub fn model(&self) -> Result<Model> {
        self.get(mdrHeadphonesGetModel, "mdrHeadphonesGetModel")
            .map(Model::from)
    }

    /// `mdrHeadphonesGetBatteries`
    pub fn batteries(&self) -> Result<Vec<Battery>> {
        let raw = self.list(mdrHeadphonesGetBatteries, "mdrHeadphonesGetBatteries")?;
        Ok(raw.into_iter().map(Battery::from).collect())
    }

    /// `mdrHeadphonesGetPlayback`
    pub fn playback_state(&self) -> Result<Playback> {
        self.get(mdrHeadphonesGetPlayback, "mdrHeadphonesGetPlayback")
            .map(Playback::from)
    }

    /// `mdrHeadphonesGetNoiseControl`
    pub fn noise_control(&self) -> Result<NoiseControl> {
        self.get(mdrHeadphonesGetNoiseControl, "mdrHeadphonesGetNoiseControl")
            .map(NoiseControl::from)
    }

    /// `mdrHeadphonesGetSpeakToChat`
    pub fn speak_to_chat(&self) -> Result<SpeakToChat> {
        self.get(mdrHeadphonesGetSpeakToChat, "mdrHeadphonesGetSpeakToChat")
            .map(SpeakToChat::from)
    }

    /// `mdrHeadphonesGetListening`
    pub fn listening(&self) -> Result<Listening> {
        self.get(mdrHeadphonesGetListening, "mdrHeadphonesGetListening")
            .map(Listening::from)
    }

    /// `mdrHeadphonesGetEqualizer` + `mdrHeadphonesGetEqualizerBands`
    pub fn equalizer(&self) -> Result<Equalizer> {
        let raw = self.get(mdrHeadphonesGetEqualizer, "mdrHeadphonesGetEqualizer")?;
        let bands = self.list(
            mdrHeadphonesGetEqualizerBands,
            "mdrHeadphonesGetEqualizerBands",
        )?;
        Ok(Equalizer::from_raw(raw, bands))
    }

    /// `mdrHeadphonesGetEqualizerPresets` + `MDR_TEXT_EQUALIZER_PRESET_NAME[i]`.
    /// Unknown ids (`MDR_EQ_UNKNOWN`) are skipped, like client/Client.cpp.
    pub fn equalizer_presets(&self) -> Result<Vec<EqualizerPreset>> {
        let ids: Vec<MDREqualizerPreset> = self.list(
            mdrHeadphonesGetEqualizerPresets,
            "mdrHeadphonesGetEqualizerPresets",
        )?;
        Ok(ids
            .into_iter()
            .enumerate()
            .filter(|(_, id)| *id != MDR_EQ_UNKNOWN)
            .map(|(i, id)| EqualizerPreset {
                id: EqualizerPresetId::from_raw(id),
                name: self
                    .raw_text(MDR_TEXT_EQUALIZER_PRESET_NAME, i as u32)
                    .unwrap_or_default(),
            })
            .collect())
    }

    /// `mdrHeadphonesGetPairedDevices`
    pub fn paired_devices(&self) -> Result<Vec<PairedDevice>> {
        let raw = self.list(
            mdrHeadphonesGetPairedDevices,
            "mdrHeadphonesGetPairedDevices",
        )?;
        Ok(raw.into_iter().map(PairedDevice::from).collect())
    }

    /// `mdrHeadphonesGetPairing`
    pub fn pairing(&self) -> Result<Pairing> {
        let r = self.get(mdrHeadphonesGetPairing, "mdrHeadphonesGetPairing")?;
        Ok(Pairing {
            enabled: raw_bool(r.enabled),
        })
    }

    /// `mdrHeadphonesGetSourceSwitchControl`
    pub fn source_switch_control(&self) -> Result<bool> {
        self.get(
            mdrHeadphonesGetSourceSwitchControl,
            "mdrHeadphonesGetSourceSwitchControl",
        )
        .map(raw_bool)
    }

    /// `mdrHeadphonesGetSourceSwitchControlResult` (valid only after a set + `PairedDevicesChanged`).
    pub fn source_switch_control_result(&self) -> Result<SourceSwitchResult> {
        self.get(
            mdrHeadphonesGetSourceSwitchControlResult,
            "mdrHeadphonesGetSourceSwitchControlResult",
        )
        .map(SourceSwitchResult::from_raw)
    }

    /// `mdrHeadphonesGetGeneralSettingInfo` + `GetGeneralSetting` + subject/summary texts.
    pub fn general_settings(&self) -> Result<Vec<GeneralSetting>> {
        let infos = self.list(
            mdrHeadphonesGetGeneralSettingInfo,
            "mdrHeadphonesGetGeneralSettingInfo",
        )?;
        let mut out = Vec::with_capacity(infos.len());
        for info in infos {
            let mut s = MDRGeneralSetting::default();
            // SAFETY: live instance; valid out-pointer.
            let code = unsafe { mdrHeadphonesGetGeneralSetting(self.h(), info.index, &mut s) };
            if code != MDR_RESULT_OK {
                continue; // same as client/Client.cpp GetGeneralSettings
            }
            out.push(GeneralSetting {
                index: info.index,
                info: info.into(),
                value: raw_bool(s.boolean_value),
                subject: self
                    .raw_text(MDR_TEXT_GENERAL_SETTING_SUBJECT, info.index)
                    .unwrap_or_default(),
                summary: self
                    .raw_text(MDR_TEXT_GENERAL_SETTING_SUMMARY, info.index)
                    .unwrap_or_default(),
            });
        }
        Ok(out)
    }

    /// `mdrHeadphonesGetAssignableControls`, each with its offered actions.
    pub fn assignable_controls(&self) -> Result<Vec<AssignableControl>> {
        let raw = self.list(
            mdrHeadphonesGetAssignableControls,
            "mdrHeadphonesGetAssignableControls",
        )?;
        Ok(raw
            .into_iter()
            .map(|r| {
                let mut c = AssignableControl::from(r);
                c.options = self
                    .assignable_control_actions(c.location)
                    .unwrap_or_default();
                c
            })
            .collect())
    }

    /// `mdrHeadphonesGetAssignableControlActions(key)`
    pub fn assignable_control_actions(&self, key: KeyLocation) -> Result<Vec<AssignableAction>> {
        let call = "mdrHeadphonesGetAssignableControlActions";
        let mut count: u32 = 0;
        // SAFETY: live instance; NULL buffer with *count == 0 is the size query.
        let code = unsafe {
            mdrHeadphonesGetAssignableControlActions(self.h(), key.raw(), null_mut(), &mut count)
        };
        self.check(code, call)?;
        if count == 0 {
            return Ok(Vec::new());
        }
        let mut v: Vec<MDRAssignableAction> = vec![0; count as usize];
        // SAFETY: `v` holds `count` writable elements.
        let code = unsafe {
            mdrHeadphonesGetAssignableControlActions(
                self.h(),
                key.raw(),
                v.as_mut_ptr(),
                &mut count,
            )
        };
        self.check(code, call)?;
        v.truncate(count as usize);
        Ok(v.into_iter().map(AssignableAction::from_raw).collect())
    }

    /// `mdrHeadphonesGetPower`
    pub fn power(&self) -> Result<Power> {
        self.get(mdrHeadphonesGetPower, "mdrHeadphonesGetPower")
            .map(Power::from)
    }

    /// `mdrHeadphonesGetVoiceGuidance`
    pub fn voice_guidance(&self) -> Result<VoiceGuidance> {
        self.get(
            mdrHeadphonesGetVoiceGuidance,
            "mdrHeadphonesGetVoiceGuidance",
        )
        .map(VoiceGuidance::from)
    }

    /// `mdrHeadphonesGetConnectionMode`
    pub fn connection_mode(&self) -> Result<ConnectionMode> {
        let r = self.get(
            mdrHeadphonesGetConnectionMode,
            "mdrHeadphonesGetConnectionMode",
        )?;
        Ok(ConnectionMode {
            audio_priority: AudioPriority::from_raw(r.audio_priority),
        })
    }

    /// `mdrHeadphonesGetSafeListening`
    pub fn safe_listening(&self) -> Result<SafeListening> {
        self.get(
            mdrHeadphonesGetSafeListening,
            "mdrHeadphonesGetSafeListening",
        )
        .map(SafeListening::from)
    }

    /// `mdrHeadphonesGetWearingStatus`
    pub fn wearing_status(&self) -> Result<WearingStatus> {
        self.get(
            mdrHeadphonesGetWearingStatus,
            "mdrHeadphonesGetWearingStatus",
        )
        .map(WearingStatus::from_raw)
    }

    /// Reads everything; each failed read becomes `None`.
    pub fn snapshot(&self) -> Snapshot {
        Snapshot {
            protocol: self.protocol,
            initialized: self.is_initialized(),
            ready: self.is_ready(),
            dirty: self.is_dirty(),
            model: self.model().ok(),
            batteries: self.batteries().ok(),
            playback: self.playback_state().ok(),
            noise_control: self.noise_control().ok(),
            speak_to_chat: self.speak_to_chat().ok(),
            listening: self.listening().ok(),
            equalizer: self.equalizer().ok(),
            equalizer_presets: self.equalizer_presets().ok(),
            paired_devices: self.paired_devices().ok(),
            pairing: self.pairing().ok(),
            source_switch_control: self.source_switch_control().ok(),
            general_settings: self.general_settings().ok(),
            assignable_controls: self.assignable_controls().ok(),
            power: self.power().ok(),
            voice_guidance: self.voice_guidance().ok(),
            connection_mode: self.connection_mode().ok(),
            safe_listening: self.safe_listening().ok(),
            wearing_status: self.wearing_status().ok(),
            features: self.features(),
            texts: self.texts(),
        }
    }

    // ---- setters (staged; apply with `commit`) -----------------------------

    fn set<R>(
        &mut self,
        f: unsafe extern "C" fn(*mut MDRHeadphones, *const R) -> MDRResult,
        value: &R,
        call: &'static str,
    ) -> Result<()> {
        // SAFETY: live instance; `value` is a valid struct of the type `f` reads.
        let code = unsafe { f(self.h(), value) };
        self.check(code, call)
    }

    /// `mdrHeadphonesSetPlayback` (volume).
    pub fn set_playback(&mut self, v: &Playback) -> Result<()> {
        self.set(
            mdrHeadphonesSetPlayback,
            &v.to_raw(),
            "mdrHeadphonesSetPlayback",
        )
    }

    /// `mdrHeadphonesPlayback`: play/pause/next/previous.
    pub fn playback(&mut self, action: PlaybackAction) -> Result<()> {
        let cmd = MDRPlaybackCommand {
            action: action.raw(),
        };
        self.set(mdrHeadphonesPlayback, &cmd, "mdrHeadphonesPlayback")
    }

    /// `mdrHeadphonesSetNoiseControl`
    pub fn set_noise_control(&mut self, v: &NoiseControl) -> Result<()> {
        self.set(
            mdrHeadphonesSetNoiseControl,
            &v.to_raw(),
            "mdrHeadphonesSetNoiseControl",
        )
    }

    /// `mdrHeadphonesSetSpeakToChat`
    pub fn set_speak_to_chat(&mut self, v: &SpeakToChat) -> Result<()> {
        self.set(
            mdrHeadphonesSetSpeakToChat,
            &v.to_raw(),
            "mdrHeadphonesSetSpeakToChat",
        )
    }

    /// `mdrHeadphonesSetListening`
    pub fn set_listening(&mut self, v: &Listening) -> Result<()> {
        self.set(
            mdrHeadphonesSetListening,
            &v.to_raw(),
            "mdrHeadphonesSetListening",
        )
    }

    /// `mdrHeadphonesSetEqualizer` (preset, clear bass, DSEE; not the bands).
    pub fn set_equalizer(&mut self, v: &Equalizer) -> Result<()> {
        self.set(
            mdrHeadphonesSetEqualizer,
            &v.to_raw(),
            "mdrHeadphonesSetEqualizer",
        )
    }

    /// `mdrHeadphonesSetEqualizerBands`
    pub fn set_equalizer_bands(&mut self, bands: &[i8]) -> Result<()> {
        let count = u32::try_from(bands.len())
            .map_err(|_| Error::InvalidArgument("too many bands".into()))?;
        // SAFETY: live instance; `bands` has `count` readable elements.
        let code = unsafe { mdrHeadphonesSetEqualizerBands(self.h(), bands.as_ptr(), count) };
        self.check(code, "mdrHeadphonesSetEqualizerBands")
    }

    /// `mdrHeadphonesSetPairedDevice`: connect/disconnect/select/unpair by device id
    /// (`MDR_TEXT_PAIRED_DEVICE_ID` or the MAC address).
    pub fn set_paired_device(
        &mut self,
        command: PairedDeviceCommand,
        device_id: &str,
    ) -> Result<()> {
        let size = u32::try_from(device_id.len())
            .map_err(|_| Error::InvalidArgument("device id too long".into()))?;
        let action = MDRPairedDeviceAction {
            command: command.raw(),
            device_id: device_id.as_ptr().cast(),
            device_id_size: size,
        };
        // `device_id` stays borrowed for the duration of the call (explicit size, no NUL needed).
        self.set(
            mdrHeadphonesSetPairedDevice,
            &action,
            "mdrHeadphonesSetPairedDevice",
        )
    }

    /// `mdrHeadphonesSetPairing`
    pub fn set_pairing(&mut self, enabled: bool) -> Result<()> {
        let v = MDRPairing {
            enabled: bool_raw(enabled),
        };
        self.set(mdrHeadphonesSetPairing, &v, "mdrHeadphonesSetPairing")
    }

    /// `mdrHeadphonesSetSourceSwitchControl`
    pub fn set_source_switch_control(&mut self, enabled: bool) -> Result<()> {
        // SAFETY: live instance.
        let code = unsafe { mdrHeadphonesSetSourceSwitchControl(self.h(), bool_raw(enabled)) };
        self.check(code, "mdrHeadphonesSetSourceSwitchControl")
    }

    /// `mdrHeadphonesSetGeneralSetting`
    pub fn set_general_setting(&mut self, index: u32, value: bool) -> Result<()> {
        let v = MDRGeneralSetting {
            index,
            boolean_value: bool_raw(value),
        };
        self.set(
            mdrHeadphonesSetGeneralSetting,
            &v,
            "mdrHeadphonesSetGeneralSetting",
        )
    }

    /// `mdrHeadphonesSetAssignableControls`
    pub fn set_assignable_controls(&mut self, controls: &[AssignableControl]) -> Result<()> {
        let raw: Vec<MDRAssignableControl> =
            controls.iter().map(AssignableControl::to_raw).collect();
        let count = u32::try_from(raw.len())
            .map_err(|_| Error::InvalidArgument("too many controls".into()))?;
        // SAFETY: live instance; `raw` has `count` readable elements.
        let code = unsafe { mdrHeadphonesSetAssignableControls(self.h(), raw.as_ptr(), count) };
        self.check(code, "mdrHeadphonesSetAssignableControls")
    }

    /// `mdrHeadphonesSetPower`
    pub fn set_power(&mut self, v: &Power) -> Result<()> {
        self.set(mdrHeadphonesSetPower, &v.to_raw(), "mdrHeadphonesSetPower")
    }

    /// `mdrHeadphonesSetVoiceGuidance`
    pub fn set_voice_guidance(&mut self, v: &VoiceGuidance) -> Result<()> {
        self.set(
            mdrHeadphonesSetVoiceGuidance,
            &v.to_raw(),
            "mdrHeadphonesSetVoiceGuidance",
        )
    }

    /// `mdrHeadphonesSetConnectionMode`
    pub fn set_connection_mode(&mut self, v: &ConnectionMode) -> Result<()> {
        let raw = MDRConnectionMode {
            audio_priority: v.audio_priority.raw(),
        };
        self.set(
            mdrHeadphonesSetConnectionMode,
            &raw,
            "mdrHeadphonesSetConnectionMode",
        )
    }

    /// `mdrHeadphonesSetSafeListening`
    pub fn set_safe_listening(&mut self, v: &SafeListening) -> Result<()> {
        self.set(
            mdrHeadphonesSetSafeListening,
            &v.to_raw(),
            "mdrHeadphonesSetSafeListening",
        )
    }

    /// `mdrHeadphonesRequestRespondToAlert` (answers an `Alert` event).
    pub fn respond_to_alert(&mut self, action: AlertAction) -> Result<()> {
        // SAFETY: live instance.
        let code = unsafe { mdrHeadphonesRequestRespondToAlert(self.h(), action.raw()) };
        self.check(code, "mdrHeadphonesRequestRespondToAlert")
    }
}

impl Drop for Engine {
    fn drop(&mut self) {
        // SAFETY: `handle` came from mdrHeadphonesCreate and is destroyed exactly once,
        // before `conn` (and its vtable/transport) is dropped after this function.
        unsafe { mdrHeadphonesDestroy(self.h()) };
        self.free_packet_cb();
    }
}
