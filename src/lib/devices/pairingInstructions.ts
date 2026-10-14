/**
 * How to put Sony headphones into Bluetooth pairing mode, per product family,
 * for the setup wizard's "Pair with Windows" step. Pairing itself happens in
 * Windows (the app cannot pair a device); these are the steps Sony's own
 * setup shows before it hands over to the phone's Bluetooth list.
 */

export type DeviceFamily = "overEar" | "earbuds";

export interface PairingInstructions {
  family: DeviceFamily;
  /** Short name for the family choice ("Over-ear", "Earbuds"). */
  label: string;
  /** The two steps, one short sentence each (shown as bullets). */
  steps: readonly string[];
}

const ADD_IN_WINDOWS = "In Bluetooth settings, select Add device, then the headphones.";

export const pairingInstructions: Readonly<Record<DeviceFamily, PairingInstructions>> = {
  overEar: {
    family: "overEar",
    label: "Over-ear",
    steps: [
      "With the headphones off, hold the power button for 7 seconds.",
      ADD_IN_WINDOWS,
    ],
  },
  earbuds: {
    family: "earbuds",
    label: "Earbuds",
    steps: [
      "With both earbuds in, hold both touch sensors for 5 seconds.",
      ADD_IN_WINDOWS,
    ],
  },
};

export const DEVICE_FAMILIES: readonly DeviceFamily[] = ["overEar", "earbuds"];

/**
 * The family a Sony model name belongs to: `WH-` is over-ear, `WF-` and
 * `LinkBuds` are earbuds. Null for anything else (the wizard then shows
 * over-ear first and lets the user switch).
 */
export function familyForModel(modelName: string | null | undefined): DeviceFamily | null {
  if (!modelName) return null;
  const name = modelName.trim().toUpperCase();
  if (name.startsWith("WH-")) return "overEar";
  if (name.startsWith("WF-") || name.startsWith("LINKBUDS")) return "earbuds";
  return null;
}
