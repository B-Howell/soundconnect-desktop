import type { RememberedDevice } from "../engine/types";

/** Title for remembered headphones that reported neither a model nor a usable name. */
export const UNNAMED_HEADPHONES = "Sony headphones";

const BLUETOOTH_ADDRESS = /^[0-9a-f]{2}([:-][0-9a-f]{2}){5}$/i;

/** True for `AA:BB:CC:DD:EE:FF` (or dash-separated): an address, never a title. */
export const isBluetoothAddress = (text: string): boolean => BLUETOOTH_ADDRESS.test(text.trim());

/**
 * A name fit to show as a title: trimmed, or undefined when empty or a
 * Bluetooth address (profiles saved before 0.1.4 could hold the address as
 * `name`, and a connect by address names the device by its address).
 */
export function displayableName(name: string | null | undefined): string | undefined {
  const trimmed = name?.trim();
  return trimmed && !isBluetoothAddress(trimmed) ? trimmed : undefined;
}

/**
 * The title for remembered headphones: `modelName` ("WH-1000XM4"), else the
 * name Windows lists, else "Sony headphones". The address is never a title.
 * Undefined only when nothing is remembered.
 */
export function rememberedTitle(device: Pick<RememberedDevice, "modelName" | "name"> | null | undefined): string | undefined {
  if (!device) return undefined;
  return displayableName(device.modelName) ?? displayableName(device.name) ?? UNNAMED_HEADPHONES;
}
