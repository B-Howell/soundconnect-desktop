import { familyForModel, type DeviceFamily } from "./pairingInstructions";

/**
 * Sony headphone models the app has a real product photo for, and how a
 * device name maps onto one. The photos are Sony's own product images
 * (transparent PNGs from Sony's Scene7 image server, cropped to the product
 * and downscaled; never redrawn or recoloured), served from `public/devices/`.
 * Sources and terms: docs/research/SoundConnect Desktop - Product Image Sources.md.
 */

export interface DeviceModel {
  /** Sony model id as the headphones report it, for example "WH-1000XM4". */
  id: string;
  family: DeviceFamily;
  /** Name for people: the model id, or Sony's product name where the model id is not what the box says. */
  displayName: string;
}

export interface DeviceModelImage {
  /** The model the picture shows (a fallback model for unknown devices). */
  model: DeviceModel;
  /** Full photo, at most 1200 px on the long side. */
  image: string;
  /** 256 px photo for the rail. */
  thumb: string;
}

const model = (id: string, family: DeviceFamily, displayName = id): DeviceModel => ({ id, family, displayName });

/** Every model with a photo in `public/devices/<id>.png` and `<id>-thumb.png`. */
export const DEVICE_MODELS: readonly DeviceModel[] = [
  model("WH-1000XM3", "overEar"),
  model("WH-1000XM4", "overEar"),
  model("WH-1000XM5", "overEar"),
  model("WH-1000XM6", "overEar"),
  model("WH-CH720N", "overEar"),
  model("WF-1000XM4", "earbuds"),
  model("WF-1000XM5", "earbuds"),
  model("WF-1000XM6", "earbuds"),
  model("WF-C510", "earbuds"),
  model("WF-C700N", "earbuds"),
  model("WF-L910", "earbuds", "LinkBuds Open"),
  model("WF-LC900", "earbuds", "LinkBuds Clip"),
  model("WF-LS900N", "earbuds", "LinkBuds S"),
];

/** Bluetooth names Sony gives LinkBuds instead of the model id. */
const PRODUCT_NAME_ALIASES: Readonly<Record<string, string>> = {
  "LINKBUDS OPEN": "WF-L910",
  "LINKBUDS CLIP": "WF-LC900",
  "LINKBUDS S": "WF-LS900N",
};

const byId = new Map(DEVICE_MODELS.map((entry) => [entry.id, entry]));

function knownModel(id: string): DeviceModel {
  const entry = byId.get(id);
  if (!entry) throw new Error(`No device model ${id}`);
  return entry;
}

/** Photo per family for a Sony device the app has no photo of; the over-ear one is also the neutral picture while nothing is known. */
const FALLBACK_MODEL: Readonly<Record<DeviceFamily, DeviceModel>> = {
  overEar: knownModel("WH-1000XM5"),
  earbuds: knownModel("WF-1000XM5"),
};
/** Longest id first, so "WH-1000XM4C" matches WH-1000XM4 and never a shorter id. */
const idsLongestFirst = [...byId.keys()].sort((a, b) => b.length - a.length);

/**
 * The known model a device name or model name refers to, or null. Matches
 * the model id at the start of the name (case and surrounding space
 * ignored, so regional suffixes such as "WH-1000XM4C" still match) or a
 * LinkBuds product name.
 */
export function findDeviceModel(name: string | null | undefined): DeviceModel | null {
  const key = name?.trim().toUpperCase();
  if (!key) return null;
  const alias = Object.keys(PRODUCT_NAME_ALIASES).find((product) => key.startsWith(product));
  if (alias) return knownModel(PRODUCT_NAME_ALIASES[alias]);
  const id = idsLongestFirst.find((candidate) => key.startsWith(candidate));
  return id ? knownModel(id) : null;
}

/** Public path of a file in `public/devices/`, relative to the app's base so it resolves in Vite and in the packaged Tauri app. */
export function deviceImagePath(file: string): string {
  return `${import.meta.env.BASE_URL}devices/${file}`;
}

/**
 * The photo for a device: its own model's when known; else the family
 * fallback for a `WH-` (WH-1000XM5) or `WF-` / LinkBuds (WF-1000XM5) name;
 * else, with nothing to go on, the WH-1000XM5 as a neutral "headphones"
 * picture (never the user's own model by guesswork).
 */
export function deviceModelImage(name: string | null | undefined): DeviceModelImage {
  const known = findDeviceModel(name);
  const shown = known ?? FALLBACK_MODEL[familyForModel(name) ?? "overEar"];
  return {
    model: shown,
    image: deviceImagePath(`${shown.id}.png`),
    thumb: deviceImagePath(`${shown.id}-thumb.png`),
  };
}
