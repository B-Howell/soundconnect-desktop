import { CardGrid, CardStack } from "../page/CardGrid";
import { LabelledSection } from "../page/LabelledSection";
import { Card } from "../primitives/Card";
import { GroupedList } from "../primitives/GroupedList";
import { DseeRow, type DseeRowProps } from "../sound/DseeRow";
import { curveSeries } from "./eqCurve";
import { EqCurveChart } from "./EqCurveChart";
import { EqualizerCard, type EqualizerCardProps } from "./EqualizerCard";
import { CLEAR_BASS_RANGE, defaultBandLabels, defaultBandRange } from "./equalizerBands";
import { PresetGrid, type PresetTile } from "./PresetGrid";

export interface EqualizerSectionsProps {
  equalizer: EqualizerCardProps;
  /**
   * Recorded curves by preset id (Clear Bass first, then bands); `null` marks
   * a listener-edited preset. Omit (or leave an id out) for no sparkline.
   */
  presetCurves?: ReadonlyMap<number, readonly number[] | null>;
  dsee?: DseeRowProps;
}

/**
 * The Equalizer page's content: the current curve as a large chart, the
 * presets as a grid of sparkline cards, then the band and Clear Bass sliders
 * (the control) beside sound quality (DSEE). Presentational: `EqualizerPage`
 * feeds it engine state and the recorded preset curves.
 */
export function EqualizerSections({ equalizer, presetCurves, dsee }: EqualizerSectionsProps) {
  const { bands, clearBass, presets, presetId } = equalizer;
  const labels = equalizer.bandLabels ?? defaultBandLabels(bands.length);
  const range = equalizer.bandRange ?? defaultBandRange(bands.length) ?? CLEAR_BASS_RANGE;
  const series = curveSeries(bands, labels, clearBass);
  const tiles: PresetTile[] = presets.map((preset) => ({
    ...preset,
    curve: presetCurves?.has(preset.id) ? presetCurves.get(preset.id) : undefined,
  }));
  const current = presets.find((preset) => preset.id === presetId)?.name;
  const inert = equalizer.disabled || !equalizer.available;
  const shownDsee = dsee?.available ? dsee : undefined;
  return (
    <CardGrid>
      <CardStack span="full">
        <LabelledSection title={current ? `Curve · ${current}` : "Curve"}>
          <Card>
            <EqCurveChart bands={series.values} labels={series.labels} range={range} />
          </Card>
        </LabelledSection>
        <LabelledSection title="Presets">
          <PresetGrid
            presets={tiles}
            presetId={presetId}
            range={range}
            onChange={equalizer.onPresetChange}
            disabled={inert}
          />
        </LabelledSection>
      </CardStack>
      <CardStack>
        <LabelledSection title="Bands">
          <EqualizerCard {...equalizer} showPresetPicker={false} />
        </LabelledSection>
      </CardStack>
      <CardStack>
        {shownDsee ? (
          <LabelledSection title="Sound quality">
            <GroupedList>
              <DseeRow {...shownDsee} />
            </GroupedList>
          </LabelledSection>
        ) : null}
      </CardStack>
    </CardGrid>
  );
}
