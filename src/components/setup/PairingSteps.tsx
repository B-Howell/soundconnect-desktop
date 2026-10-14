import { DEVICE_FAMILIES, pairingInstructions, type DeviceFamily } from "../../lib/devices/pairingInstructions";
import { SegmentedControl } from "../primitives/SegmentedControl";
import "./PairingSteps.css";

export interface PairingStepsProps {
  family: DeviceFamily;
  onFamilyChange: (family: DeviceFamily) => void;
}

const familyOptions = DEVICE_FAMILIES.map((family) => ({ value: family, label: pairingInstructions[family].label }));

/**
 * How to put the headphones into pairing mode: an Over-ear / Earbuds choice
 * and that family's numbered steps (`pairingInstructions.ts`).
 */
export function PairingSteps({ family, onFamilyChange }: PairingStepsProps) {
  const { steps } = pairingInstructions[family];
  return (
    <div className="pairing-steps">
      <SegmentedControl label="Headphone type" options={familyOptions} value={family} onChange={onFamilyChange} />
      <ol className="pairing-steps__list">
        {steps.map((step, i) => (
          <li key={i} className="pairing-steps__item">
            <span className="pairing-steps__number" aria-hidden="true">
              {i + 1}
            </span>
            <span className="pairing-steps__text">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
