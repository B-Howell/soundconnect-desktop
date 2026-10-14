import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EqualizerSections } from "../../src/components/equalizer/EqualizerSections";
import { PresetGrid } from "../../src/components/equalizer/PresetGrid";
import { isEditablePreset } from "../../src/lib/devices/eqPresets";
import fixture from "../fixtures/eq-presets/WH-1000XM4-2.9.0.json";

const range = { min: -10, max: 10 };
const noop = () => undefined;

describe("PresetGrid", () => {
  it("renders each recorded name with its sparkline, and a flat Custom line for editable presets", () => {
    const tiles = fixture.presets.map((preset, index) => ({
      id: index,
      name: preset.name,
      curve: isEditablePreset(preset.id) ? null : [preset.clearBass, ...preset.bands],
    }));
    const { container } = render(<PresetGrid presets={tiles} presetId={1} range={range} onChange={noop} />);
    const group = screen.getByRole("group", { name: "Equalizer presets" });
    expect(within(group).getAllByRole("button")).toHaveLength(12);
    expect(within(group).getByRole("button", { name: "Bright" })).toHaveAttribute("aria-pressed", "true");
    const lines = [...container.querySelectorAll(".eq-sparkline__line")].map((line) => line.getAttribute("d"));
    expect(lines).toHaveLength(12);
    // Off ends on the 0 line; Treble ends at +10, the top edge.
    expect(lines[0]).toMatch(/,50$/);
    expect(lines[6]).toMatch(/,0$/);
    expect(container.querySelectorAll(".preset-grid__caption")).toHaveLength(2);
  });

  it("shows names only when the model has no recording", () => {
    const { container } = render(
      <PresetGrid presets={[{ id: 1, name: "Bright" }]} presetId={1} range={range} onChange={noop} />,
    );
    expect(screen.getByRole("button", { name: "Bright" })).toBeInTheDocument();
    expect(container.querySelector(".eq-sparkline")).toBeNull();
  });

  it("reports the picked preset", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PresetGrid
        presets={[
          { id: 8, name: "Bright" },
          { id: 14, name: "Bass" },
        ]}
        presetId={8}
        range={range}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Bass" }));
    expect(onChange).toHaveBeenCalledWith(14);
  });
});

describe("EqualizerSections", () => {
  it("draws the current curve with Clear Bass first and disables presets while unavailable", () => {
    render(
      <EqualizerSections
        equalizer={{
          presets: [{ id: 8, name: "Bright" }],
          presetId: 8,
          bands: [0, 5, 7, 7, 9],
          clearBass: -1,
          available: false,
          onPresetChange: noop,
          onBandsChange: noop,
          onBandsCommit: noop,
          onClearBassChange: noop,
          onClearBassCommit: noop,
        }}
      />,
    );
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "Equalizer curve: Clear Bass −1, 400 Hz 0, 1 kHz +5, 2.5 kHz +7, 6.3 kHz +7, 16 kHz +9",
    );
    expect(screen.getByRole("button", { name: "Bright" })).toBeDisabled();
    expect(screen.getByText("Unavailable in this listening mode.")).toBeInTheDocument();
  });
});
