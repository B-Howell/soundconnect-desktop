import { EqualizerSections } from "../components/equalizer/EqualizerSections";
import { NotConnectedSection } from "../components/page/NotConnectedSection";
import { PlaceholderSection } from "../components/page/PlaceholderSection";
import { useEngineConnected } from "../hooks/engine/useConnectionView";
import { useEqualizerProps } from "../hooks/engine/useEqualizerProps";
import { usePresetCurves } from "../hooks/engine/usePresetCurves";

/**
 * Equalizer: the curve, the presets with their recorded curves, the band and
 * Clear Bass sliders and DSEE; or a short "connect" note. Preset curves come
 * from the recorded fixture for this model (`eqPresets.ts`); without one the
 * presets show no sparklines. Listener-edited presets (Custom, User Setting n)
 * show a flat "Custom" line.
 */
export function EqualizerPage() {
  const connected = useEngineConnected();
  const { equalizer, dsee } = useEqualizerProps();
  const presetCurves = usePresetCurves(equalizer?.presets, equalizer?.clearBass !== undefined);

  if (!connected) return <NotConnectedSection />;
  if (!equalizer) return <PlaceholderSection title="Equalizer" />;
  return <EqualizerSections equalizer={equalizer} presetCurves={presetCurves} dsee={dsee} />;
}
