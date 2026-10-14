import type { NavPage } from "../../state/navStore";
import type { IconName } from "../icons/Icon";

export interface NavPageItem {
  value: NavPage;
  /** Rail label; also the page's `<h1>`. */
  label: string;
  icon: IconName;
  /** The page this one is a sub-page of: shown indented under it in the rail and as a breadcrumb in the title. */
  parent?: NavPage;
}

/**
 * The app's pages, in rail order. Six top-level pages (status, the sound of
 * the headphones, their own settings, devices, then the PC's Windows audio
 * and the app); Sound has two sub-pages, Equalizer and Noise control, which
 * the rail shows under it while Sound or one of them is open.
 */
export const navPages: readonly NavPageItem[] = [
  { value: "status", label: "Status", icon: "house" },
  { value: "sound", label: "Sound", icon: "sliders-horizontal" },
  { value: "equalizer", label: "Equalizer", icon: "waveform", parent: "sound" },
  { value: "noise", label: "Noise control", icon: "noise-cancelling", parent: "sound" },
  { value: "system", label: "System", icon: "headphones" },
  { value: "devices", label: "Devices", icon: "devices" },
  { value: "windowsAudio", label: "Windows audio", icon: "speaker" },
  { value: "settings", label: "Settings", icon: "gear" },
];

/** The page's ancestors, outermost first (empty for a top-level page). */
export function navTrail(items: readonly NavPageItem[], page: NavPage): NavPageItem[] {
  const trail: NavPageItem[] = [];
  let parent = items.find((item) => item.value === page)?.parent;
  while (parent) {
    const item = items.find((candidate) => candidate.value === parent);
    if (!item) break;
    trail.unshift(item);
    parent = item.parent;
  }
  return trail;
}
