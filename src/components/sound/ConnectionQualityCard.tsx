import { OptionList, type Option } from "../primitives/OptionList";
import { SectionFooter } from "../primitives/SectionFooter";

export type ConnectionQualityValue = "quality" | "stability";

/** Sony's "Bluetooth Connection Quality" choices. */
export const CONNECTION_QUALITY_OPTIONS: readonly Option<ConnectionQualityValue>[] = [
  { value: "quality", label: "Priority on sound quality" },
  { value: "stability", label: "Priority on stable connection" },
];

export interface ConnectionQualityCardProps {
  /** The device's audio priority; anything else checks neither row. */
  value: ConnectionQualityValue | string | number;
  onChange: (value: ConnectionQualityValue) => void;
}

/** Bluetooth connection quality: two check rows, as Sony's app lists them, and a footer on what each means. */
export function ConnectionQualityCard({ value, onChange }: ConnectionQualityCardProps) {
  return (
    <>
      <OptionList
        label="Bluetooth connection quality"
        options={CONNECTION_QUALITY_OPTIONS}
        value={value as ConnectionQualityValue}
        onSelect={(next) => {
          if (next !== value) onChange(next);
        }}
      />
      <SectionFooter>
        <p>
          The headphones reconnect briefly after a change.
        </p>
      </SectionFooter>
    </>
  );
}
