import { PlaceholderSection } from "../components/page/PlaceholderSection";
import { WinAudioSections } from "../components/winaudio/WinAudioSections";
import { useWindowsAudioPage } from "../hooks/winaudio/useWindowsAudioPage";

/**
 * Windows audio: how Windows handles the headphones' sound (Hands-Free,
 * default devices, effects, format, absolute volume, the radio), with
 * "Fix for music", "Fix for calls" and Restore. Works for the remembered
 * headphones while they are not connected.
 */
export function WindowsAudioPage() {
  const view = useWindowsAudioPage();
  if (view.state === "noDevice") {
    return (
      <PlaceholderSection
        title="Windows audio"
        message="Set up your headphones first; this page then shows how Windows handles their sound."
      />
    );
  }
  if (view.state === "loading") {
    return <PlaceholderSection title="Windows audio" message={view.error ?? "Reading Windows settings…"} />;
  }
  return <WinAudioSections {...view.props} />;
}
