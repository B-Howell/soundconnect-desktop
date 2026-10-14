import { PlaceholderSection } from "../components/page/PlaceholderSection";
import { WinAudioSections } from "../components/winaudio/WinAudioSections";
import { useWindowsAudioPage } from "../hooks/winaudio/useWindowsAudioPage";

/**
 * Windows audio: the choice between "Stereo audio" and "Mono audio with
 * mic", then how Windows processes, formats and carries the headphones'
 * sound, with Restore under Advanced. Works for the remembered
 * headphones while they are not connected.
 */
export function WindowsAudioPage() {
  const view = useWindowsAudioPage();
  if (view.state === "noDevice") {
    return (
      <PlaceholderSection
        title="Windows audio"
        message="Set up headphones to change these settings."
      />
    );
  }
  if (view.state === "loading") {
    return <PlaceholderSection title="Windows audio" message={view.error ?? "Reading Windows settings…"} />;
  }
  return <WinAudioSections {...view.props} />;
}
