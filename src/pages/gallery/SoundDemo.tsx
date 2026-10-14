import { useState } from "react";
import type { EqualizerPreset } from "../../components/equalizer/PresetPicker";
import { EqualizerCard } from "../../components/equalizer/EqualizerCard";
import { CLEAR_BASS_RANGE } from "../../components/equalizer/equalizerBands";
import { CardGrid, CardStack } from "../../components/page/CardGrid";
import { LabelledSection } from "../../components/page/LabelledSection";
import { GroupedList } from "../../components/primitives/GroupedList";
import { DseeRow } from "../../components/sound/DseeRow";
import { SoundOverview } from "../../components/sound/SoundOverview";

/**
 * Preset ids and names as a WH-1000XM4 might advertise them (ids are the
 * upstream `MDR_EQ_*` values, names upstream's English ones). Demo data for
 * the gallery only; the app takes both from the device.
 */
const demoPresets: readonly EqualizerPreset[] = [
  { id: 0, name: "Off" },
  { id: 8, name: "Bright" },
  { id: 9, name: "Excited" },
  { id: 10, name: "Mellow" },
  { id: 11, name: "Relaxed" },
  { id: 12, name: "Vocal" },
  { id: 13, name: "Treble" },
  { id: 14, name: "Bass" },
  { id: 15, name: "Speech" },
  { id: 24, name: "Custom" },
  { id: 25, name: "User Setting 1" },
  { id: 26, name: "User Setting 2" },
];

const log = (what: string) => (value: unknown) => console.info(`[gallery] ${what}`, value);

/** The XM4's recorded Bright curve (Clear Bass, then 400 Hz .. 16 kHz), from `tests/fixtures/eq-presets/WH-1000XM4-2.9.0.json`. */
const brightCurve = [-1, 0, 5, 7, 7, 9] as const;

/**
 * Sound on local state: the overview's entry cards (opening is logged), then
 * the Equalizer page's band card and DSEE row: the preset sheet opens and
 * picks, the five bands and Clear Bass move, DSEE switches; commits are
 * logged. `disabled` greys the controls (no device link); `unavailable`
 * shows the equalizer as the device reports it outside Standard.
 */
export function SoundDemo({ disabled = false, unavailable = false }: { disabled?: boolean; unavailable?: boolean }) {
  const [presetId, setPresetId] = useState(8);
  const [bands, setBands] = useState<number[]>([3, 1, 0, 2, 4]);
  const [clearBass, setClearBass] = useState(2);
  const [dsee, setDsee] = useState(true);
  return (
    <>
      <SoundOverview
        equalizer={{
          presetName: demoPresets.find((preset) => preset.id === presetId)?.name ?? "Custom",
          detail: unavailable ? "Unavailable in this listening mode" : "Clear Bass −1",
          curve: brightCurve,
          range: CLEAR_BASS_RANGE,
          onOpen: () => log("open")("equalizer"),
        }}
        noise={{
          mode: "ambient",
          ambientLevel: 12,
          focusOnVoice: true,
          canCancel: true,
          canAmbient: true,
          canWind: true,
          onOpen: () => log("open")("noise"),
        }}
      />
      <CardGrid>
        <CardStack>
          <LabelledSection title="Bands">
            <EqualizerCard
              presets={demoPresets}
              presetId={presetId}
              bands={bands}
              clearBass={clearBass}
              available={!unavailable}
              disabled={disabled}
              onPresetChange={setPresetId}
              onBandsChange={setBands}
              onBandsCommit={log("bands commit")}
              onClearBassChange={setClearBass}
              onClearBassCommit={log("clear bass commit")}
            />
          </LabelledSection>
        </CardStack>
        <CardStack>
          <LabelledSection title="Sound quality">
            <GroupedList>
              <DseeRow available enabled={dsee} type={2} onChange={setDsee} disabled={disabled} />
            </GroupedList>
          </LabelledSection>
        </CardStack>
      </CardGrid>
    </>
  );
}
