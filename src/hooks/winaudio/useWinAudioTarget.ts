import { codecLabel } from "../../lib/engine/ids";
import { useEngine } from "../../state/engineContext";

export interface WinAudioTarget {
  /** The headphones' Bluetooth address: the connected device's, else the remembered one's; null with neither. */
  address: string | null;
  /** The codec the headphones report while connected (Windows has no API for it). */
  codec: string | null;
}

/** Which headphones the Windows audio page reads, from the engine store. */
export function useWinAudioTarget(): WinAudioTarget {
  const address = useEngine((state) => state.status.address ?? state.remembered?.address ?? null);
  const codec = useEngine((state) => codecLabel(state.payload?.snapshot.model?.audioCodec) ?? null);
  return { address, codec };
}
