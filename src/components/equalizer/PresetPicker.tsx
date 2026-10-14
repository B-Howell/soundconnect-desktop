import { useMemo } from "react";
import { PickerRow } from "../primitives/PickerRow";

export interface EqualizerPreset {
  /** The device's preset id (`MDREqualizerPreset`). */
  id: number;
  /** The device's own name for it (`MDR_TEXT_EQUALIZER_PRESET_NAME`). */
  name: string;
}

export interface PresetPickerProps {
  presets: readonly EqualizerPreset[];
  presetId: number;
  onChange: (id: number) => void;
  disabled?: boolean;
}

/** The "Preset" row: the current preset's name, opening a sheet of the presets the device advertised. */
export function PresetPicker({ presets, presetId, onChange, disabled }: PresetPickerProps) {
  const options = useMemo(() => presets.map((preset) => ({ value: preset.id, label: preset.name })), [presets]);
  return (
    <PickerRow
      title="Preset"
      sheetTitle="Equalizer preset"
      options={options}
      value={presetId}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
