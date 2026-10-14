import { EntryCard } from "../page/EntryCard";
import { EqSparkline } from "./EqSparkline";
import type { ValueRange } from "./equalizerBands";
import "./EqualizerEntryCard.css";

export interface EqualizerEntryCardProps {
  /** The current preset's name ("Bright"). */
  presetName: string;
  /** A summary under it ("Clear Bass −1"). */
  detail?: string;
  /** The curve to draw, Clear Bass first: the recorded preset curve, else the live bands. */
  curve?: readonly number[];
  range: ValueRange;
  /** Opens the Equalizer page. */
  onOpen: () => void;
}

/** The Sound page's way into the Equalizer: the current preset, its curve in miniature (in the accent), a chevron. */
export function EqualizerEntryCard({ presetName, detail, curve, range, onOpen }: EqualizerEntryCardProps) {
  return (
    <EntryCard
      title="Equalizer"
      value={presetName}
      detail={detail}
      icon="waveform"
      visual={curve && curve.length > 1 ? <EqSparkline values={curve} range={range} /> : undefined}
      onOpen={onOpen}
    />
  );
}
