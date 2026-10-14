import { NotConnectedSection } from "../components/page/NotConnectedSection";
import { SoundOverview } from "../components/sound/SoundOverview";
import { useConnectionModeProps } from "../hooks/engine/useConnectionModeProps";
import { useEngineConnected } from "../hooks/engine/useConnectionView";
import { useEqualizerEntryProps } from "../hooks/engine/useEqualizerEntryProps";
import { useNoiseControlProps } from "../hooks/engine/useNoiseControlProps";
import { useSpeakToChatProps } from "../hooks/engine/useSpeakToChatProps";
import { useNavStore } from "../state/navStore";

/**
 * Sound, the overview: entry cards into its sub-pages (Equalizer, Noise
 * control) showing their current state, then Bluetooth connection quality
 * and Speak-to-Chat; or a short "connect" note.
 */
export function SoundPage() {
  const connected = useEngineConnected();
  const setPage = useNavStore((state) => state.setPage);
  const equalizer = useEqualizerEntryProps();
  const noise = useNoiseControlProps();
  const connectionQuality = useConnectionModeProps();
  const speakToChat = useSpeakToChatProps();
  if (!connected) return <NotConnectedSection />;
  return (
    <SoundOverview
      equalizer={equalizer ? { ...equalizer, onOpen: () => setPage("equalizer") } : undefined}
      noise={noise ? { ...noise, onOpen: () => setPage("noise") } : undefined}
      connectionQuality={connectionQuality ?? undefined}
      speakToChat={speakToChat ?? undefined}
    />
  );
}
