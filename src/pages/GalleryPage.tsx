import { useEffect, useState } from "react";
import { Card } from "../components/primitives/Card";
import { GroupedList } from "../components/primitives/GroupedList";
import { ListRow } from "../components/primitives/ListRow";
import { Pill } from "../components/primitives/Pill";
import { SectionHeader } from "../components/primitives/SectionHeader";
import { SegmentedControl } from "../components/primitives/SegmentedControl";
import { SheetButton } from "../components/primitives/SheetButton";
import { Slider } from "../components/primitives/Slider";
import { ToggleRow } from "../components/primitives/ToggleRow";
import { Icon } from "../components/icons/Icon";
import { BatteryGauge } from "../components/shell/BatteryGauge";
import { StatusSections } from "../components/status/StatusSections";
import { AmbientSoundControlCard } from "../components/noise/AmbientSoundControlCard";
import type { AmbientPosition } from "../components/noise/ambientPositions";
import { ConnectionConnecting } from "../components/shell/ConnectionConnecting";
import { ConnectionError } from "../components/shell/ConnectionError";
import { ConnectionSearching } from "../components/shell/ConnectionSearching";
import { ConnectionStatus } from "../components/shell/ConnectionStatus";
import type { DeviceHeaderProps } from "../components/shell/DeviceHeader";
import { availableNoiseSegments, type NoiseMode, type NoiseSegment } from "../components/noise/noiseModes";
import type { PlaybackStatus } from "../components/playback/playbackStatus";
import { SettingsPage } from "./SettingsPage";
import { SoundDemo } from "./gallery/SoundDemo";
import { SystemDemo } from "./gallery/SystemDemo";
import "./GalleryPage.css";

const noiseModes = availableNoiseSegments({
  canCancel: true,
  canAmbient: true,
});

const powerOffOptions = ["5 minutes", "30 minutes", "1 hour", "3 hours", "Never"] as const;

/** Fixed values for the Home demo; the real ones come from the engine in a later task. */
const demoDevice: DeviceHeaderProps = {
  name: "WH-1000XM4",
  percent: 83,
  charging: false,
  codec: "LDAC",
  firmware: "2.9.0",
};

const batterySamples = [
  { percent: 100, charging: true },
  { percent: 55, charging: false },
  { percent: 15, charging: false },
  { percent: 5, charging: false },
] as const;

const demoError = "RFCOMM connect failed: 0x80070079 (the semaphore timeout period has expired)";
const logRetry = () => console.info("[gallery] retry pressed");

/** The slider stop as the demo's local noise state. */
function applyPosition(
  position: AmbientPosition,
  setMode: (mode: NoiseMode) => void,
  setLevel: (level: number) => void,
) {
  if (position.kind === "ambient") {
    setMode("ambient");
    setLevel(position.level);
  } else setMode(position.kind);
}

/**
 * The Status sections and the Ambient Sound Control card wired to local
 * state, so every control works without a device; commits are logged.
 * `disabled` shows the cards greyed out (no device link).
 */
function ConnectedHomeDemo({ disabled = false }: { disabled?: boolean }) {
  const [mode, setMode] = useState<NoiseMode>("ambient");
  const [ambientLevel, setAmbientLevel] = useState(14);
  const [focusOnVoice, setFocusOnVoice] = useState(false);
  const [status, setStatus] = useState<PlaybackStatus>("playing");
  const [volume, setVolume] = useState(12);
  const [track, setTrack] = useState(0);
  const tracks = [
    {
      title: "Weightless",
      artist: "Marconi Union",
      album: "Weightless (Ambient Transmission Vol. 2)",
    },
    { title: "Teardrop", artist: "Massive Attack", album: "Mezzanine" },
  ];
  const step = (by: number) => setTrack((current) => (current + by + tracks.length) % tracks.length);
  const onModeChange = (segment: NoiseSegment) => setMode(segment);
  return (
    <>
      <StatusSections
        device={demoDevice}
        noise={{
          mode,
          canCancel: true,
          canAmbient: true,
          onChange: onModeChange,
          disabled,
        }}
        playback={{
          ...tracks[track],
          status,
          volume,
          maxVolume: 30,
          // No codec: the device card above already shows it.
          disabled,
          onPlayPause: () => setStatus((current) => (current === "playing" ? "paused" : "playing")),
          onNext: () => step(1),
          onPrevious: () => step(-1),
          onVolumeChange: setVolume,
          onVolumeCommit: (value) => console.info("[gallery] volume commit", value),
        }}
      />
      <AmbientSoundControlCard
        mode={mode}
        ambientLevel={ambientLevel}
        focusOnVoice={focusOnVoice}
        canCancel
        canAmbient
        canWind
        canFocusOnVoice
        disabled={disabled}
        onModeChange={onModeChange}
        onPositionChange={(position) => applyPosition(position, setMode, setAmbientLevel)}
        onPositionCommit={(position) => console.info("[gallery] ambient position commit", position)}
        onFocusOnVoiceChange={setFocusOnVoice}
      />
    </>
  );
}

/**
 * A live ConnectionStatus: "Try again" switches to connecting, which fails
 * again after two seconds, so the announcer and the focus move can be tried
 * with a screen reader.
 */
function ConnectionStatusDemo() {
  const [failed, setFailed] = useState(true);
  useEffect(() => {
    if (failed) return;
    const timer = window.setTimeout(() => setFailed(true), 2000);
    return () => window.clearTimeout(timer);
  }, [failed]);
  return (
    <ConnectionStatus
      view={
        failed
          ? {
              kind: "error",
              deviceName: "WH-1000XM4",
              message: demoError,
              onRetry: () => {
                logRetry();
                setFailed(false);
              },
            }
          : { kind: "connecting", deviceName: "WH-1000XM4" }
      }
    />
  );
}

/**
 * Dev-only design gallery (`?gallery=1`): every primitive in the kind of
 * combination the real pages will use, with local demo state, so the visual
 * language can be judged in light and dark without a device.
 */
export default function GalleryPage() {
  const [mode, setMode] = useState<NoiseSegment>("ambient");
  const [ambient, setAmbient] = useState(14);
  // What a device command would have sent: updated only by Slider.onCommit.
  const [sentAmbient, setSentAmbient] = useState(14);
  const [speakToChat, setSpeakToChat] = useState(true);
  const [wearDetection, setWearDetection] = useState(false);
  const [powerOff, setPowerOff] = useState<string>("30 minutes");

  return (
    <div className="gallery">
      <SectionHeader action={<button type="button">Edit</button>}>Status</SectionHeader>
      <Card inset>
        <div className="gallery__pills">
          <Pill tone="success">Connected</Pill>
          <Pill tone="accent">LDAC</Pill>
          <Pill tone="warning">Battery 15%</Pill>
          <Pill>Mock engine</Pill>
          <Pill>Sent ambient {sentAmbient}</Pill>
        </div>
      </Card>

      <SectionHeader>Noise control</SectionHeader>
      <Card inset>
        <div className="gallery__stack">
          <SegmentedControl label="Noise control" options={noiseModes} value={mode} onChange={setMode} />
          <Slider
            label="Ambient sound level"
            value={ambient}
            min={1}
            max={20}
            onChange={setAmbient}
            onCommit={setSentAmbient}
            disabled={mode !== "ambient"}
          />
        </div>
      </Card>

      <SectionHeader id="gallery-settings">Settings</SectionHeader>
      <GroupedList aria-labelledby="gallery-settings">
        <ToggleRow
          title="Speak-to-Chat"
          subtitle="Pauses music when you talk"
          leading={<Icon name="waveform" />}
          checked={speakToChat}
          onChange={setSpeakToChat}
        />
        <ToggleRow
          title="Wearing detection"
          leading={<Icon name="headphones" />}
          checked={wearDetection}
          onChange={setWearDetection}
        />
        <ListRow
          title="Equalizer"
          leading={<Icon name="speaker" />}
          trailing="Bright"
          disclosure
          onPress={() => undefined}
        />
        <ListRow
          title="Auto power off"
          leading={<Icon name="moon" />}
          trailing={powerOff}
          disclosure
          onPress={() => undefined}
        />
      </GroupedList>

      <SectionHeader id="gallery-power-off">Auto power off</SectionHeader>
      <GroupedList aria-labelledby="gallery-power-off">
        {powerOffOptions.map((option) => (
          <ListRow key={option} title={option} selected={option === powerOff} onPress={() => setPowerOff(option)} />
        ))}
      </GroupedList>

      <SectionHeader>Actions</SectionHeader>
      <div className="gallery__stack">
        <SheetButton onPress={() => undefined}>Reconnect</SheetButton>
        <SheetButton variant="secondary" onPress={() => undefined}>
          Show details
        </SheetButton>
        <SheetButton variant="destructive" onPress={() => undefined}>
          Power off
        </SheetButton>
      </div>

      <SectionHeader>Home: connected</SectionHeader>
      <ConnectedHomeDemo />
      <SectionHeader>Home: connected, disabled</SectionHeader>
      <ConnectedHomeDemo disabled />

      <SectionHeader>Sound</SectionHeader>
      <SoundDemo />
      <SectionHeader>Sound: disabled</SectionHeader>
      <SoundDemo disabled />
      <SectionHeader>Sound: equalizer unavailable</SectionHeader>
      <SoundDemo unavailable />

      <SectionHeader>System</SectionHeader>
      <SystemDemo />

      {/* The real settings store: changes here persist and switch the theme. */}
      <SectionHeader>Settings</SectionHeader>
      <SettingsPage />

      <SectionHeader>Shell: Battery</SectionHeader>
      <Card inset>
        <div className="gallery__pills">
          {batterySamples.map((sample) => (
            <BatteryGauge key={sample.percent} percent={sample.percent} charging={sample.charging} />
          ))}
        </div>
      </Card>

      <SectionHeader>Shell: Searching</SectionHeader>
      <ConnectionSearching />
      <SectionHeader>Shell: Connecting</SectionHeader>
      <ConnectionConnecting deviceName="WH-1000XM4" />
      <SectionHeader>Shell: Error</SectionHeader>
      <ConnectionError deviceName="WH-1000XM4" message={demoError} onRetry={logRetry} />
      <SectionHeader>Shell: Retry cycle (live)</SectionHeader>
      <ConnectionStatusDemo />
    </div>
  );
}
