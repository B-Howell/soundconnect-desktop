import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BandSliders } from "../../src/components/equalizer/BandSliders";
import { EqualizerCard, type EqualizerCardProps } from "../../src/components/equalizer/EqualizerCard";
import { PresetPicker } from "../../src/components/equalizer/PresetPicker";
import { defaultBandLabels, formatSignedStep } from "../../src/components/equalizer/equalizerBands";

const noop = () => undefined;
const presets = [
  { id: 0, name: "Off" },
  { id: 8, name: "Bright" },
  { id: 10, name: "Mellow" },
];

function cardProps(overrides: Partial<EqualizerCardProps> = {}): EqualizerCardProps {
  return {
    presets,
    presetId: 8,
    bands: [0, 1, 2, 3, 4],
    clearBass: 0,
    available: true,
    onPresetChange: noop,
    onBandsChange: noop,
    onBandsCommit: noop,
    onClearBassChange: noop,
    onClearBassCommit: noop,
    ...overrides,
  };
}

/** Bands held in state, as a page does with `onBandsChange`. */
function BandsHarness({ onCommit }: { onCommit: (bands: number[]) => void }) {
  const [bands, setBands] = useState([0, 0, 0, 0, 0]);
  return (
    <BandSliders
      bands={bands}
      labels={defaultBandLabels(5)}
      range={{ min: -10, max: 10 }}
      onChange={setBands}
      onCommit={onCommit}
    />
  );
}

describe("PresetPicker", () => {
  it("shows the current preset's name and picks another from the sheet", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ul>
        <PresetPicker presets={presets} presetId={8} onChange={onChange} />
      </ul>,
    );
    const row = screen.getByRole("button", { name: /Preset/ });
    expect(row).toHaveTextContent("Bright");

    await user.click(row);
    const sheet = screen.getByRole("dialog", { name: "Equalizer preset" });
    const current = within(sheet).getByRole("button", { name: "Bright" });
    expect(current).toHaveAttribute("aria-current", "true");
    expect(current).toHaveFocus();

    await user.click(within(sheet).getByRole("button", { name: "Mellow" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(10);
    expect(row).toHaveFocus();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("closes an open sheet when it becomes disabled, so no pick can follow", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <ul>
        <PresetPicker presets={presets} presetId={8} onChange={onChange} />
      </ul>,
    );
    await user.click(screen.getByRole("button", { name: /Preset/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    rerender(
      <ul>
        <PresetPicker presets={presets} presetId={8} onChange={onChange} disabled />
      </ul>,
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("is disabled until the device has listed its presets", () => {
    render(
      <ul>
        <PresetPicker presets={[]} presetId={8} onChange={noop} />
      </ul>,
    );
    expect(screen.getByRole("button", { name: /Preset/ })).toBeDisabled();
  });
});

describe("BandSliders", () => {
  it("labels bands by frequency and shows signed values", () => {
    render(<BandsHarness onCommit={noop} />);
    expect(screen.getAllByRole("slider")).toHaveLength(5);
    expect(screen.getByRole("slider", { name: "2.5 kHz" })).toHaveAttribute("aria-valuetext", "0");
    expect(formatSignedStep(3)).toBe("+3");
    expect(formatSignedStep(-2)).toBe("−2");
  });

  it("commits once per band gesture with the full band array", () => {
    const onCommit = vi.fn();
    render(<BandsHarness onCommit={onCommit} />);
    const band = screen.getByRole("slider", { name: "1 kHz" });

    fireEvent.pointerDown(band, { button: 0, pointerId: 1 });
    fireEvent.change(band, { target: { value: "2" } });
    fireEvent.change(band, { target: { value: "5" } });
    fireEvent.change(band, { target: { value: "-3" } });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(band, { pointerId: 1 });

    expect(onCommit).toHaveBeenCalledExactlyOnceWith([0, -3, 0, 0, 0]);

    const treble = screen.getByRole("slider", { name: "16 kHz" });
    fireEvent.pointerDown(treble, { button: 0, pointerId: 2 });
    fireEvent.change(treble, { target: { value: "4" } });
    fireEvent.pointerUp(treble, { pointerId: 2 });
    expect(onCommit).toHaveBeenCalledTimes(2);
    expect(onCommit).toHaveBeenLastCalledWith([0, -3, 0, 0, 4]);
  });
});

describe("EqualizerCard", () => {
  it("offers no band sliders for a band count upstream has no range for", () => {
    render(<EqualizerCard {...cardProps({ bands: [0, 0, 0] })} />);
    expect(screen.queryByRole("slider", { name: /Band/ })).toBeNull();
    expect(screen.getByText("Band editing is not available for 3 bands.")).toBeInTheDocument();
  });

  it("labels bands Band n when a range is given for an unknown count", () => {
    render(<EqualizerCard {...cardProps({ bands: [0, 0, 0], bandRange: { min: -5, max: 5 } })} />);
    expect(screen.getByRole("slider", { name: "Band 3" })).toHaveAttribute("max", "5");
  });

  it("uses -6..6 for ten bands", () => {
    render(<EqualizerCard {...cardProps({ bands: new Array(10).fill(0), clearBass: undefined })} />);
    expect(screen.getByRole("slider", { name: "31 Hz" })).toHaveAttribute("min", "-6");
  });

  it("disables everything and says why when the equalizer is unavailable", () => {
    render(<EqualizerCard {...cardProps({ available: false })} />);
    expect(screen.getByText(/Unavailable while a listening mode/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Preset/ })).toBeDisabled();
    for (const slider of screen.getAllByRole("slider")) expect(slider).toBeDisabled();
  });

  it("shows Clear Bass only when the device reports it", () => {
    const { rerender } = render(<EqualizerCard {...cardProps({ clearBass: 3 })} />);
    expect(screen.getByRole("slider", { name: "Clear Bass" })).toHaveAttribute("aria-valuetext", "+3");
    rerender(<EqualizerCard {...cardProps({ clearBass: undefined })} />);
    expect(screen.queryByRole("slider", { name: "Clear Bass" })).toBeNull();
  });
});
