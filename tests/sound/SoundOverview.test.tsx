import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DseeRow } from "../../src/components/sound/DseeRow";
import { noiseSummary } from "../../src/components/noise/NoiseControlEntryCard";
import { SoundOverview } from "../../src/components/sound/SoundOverview";

const noop = () => undefined;

describe("DseeRow", () => {
  it("names the DSEE type under the switch and reports changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ul>
        <DseeRow available enabled={false} type={3} onChange={onChange} />
      </ul>,
    );
    expect(screen.getByText("DSEE HX AI")).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Upscaling" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("renders nothing when DSEE is unavailable", () => {
    const { container } = render(
      <ul>
        <DseeRow available={false} enabled type={2} onChange={noop} />
      </ul>,
    );
    expect(screen.queryByRole("switch")).toBeNull();
    expect(container.querySelector("li")).toBeNull();
  });
});

const bright = [-1, 0, 5, 7, 7, 9]; // recorded XM4 Bright: Clear Bass, then the five bands

describe("SoundOverview", () => {
  it("keeps the placeholder without device data", () => {
    render(<SoundOverview />);
    expect(screen.getByText("Not available on these headphones.")).toBeInTheDocument();
  });

  it("leads with entry cards into Equalizer and Noise control that show the current state and open their pages", async () => {
    const user = userEvent.setup();
    const openEq = vi.fn();
    const openNoise = vi.fn();
    const { container } = render(
      <SoundOverview
        equalizer={{ presetName: "Bright", detail: "Clear Bass −1", curve: bright, range: { min: -10, max: 10 }, onOpen: openEq }}
        noise={{
          mode: "ambient",
          ambientLevel: 12,
          focusOnVoice: true,
          canCancel: true,
          canAmbient: true,
          canWind: true,
          onOpen: openNoise,
        }}
      />,
    );
    const eq = screen.getByRole("button", { name: "Equalizer, Bright, Clear Bass −1" });
    expect(eq.querySelector(".eq-sparkline__line")).not.toBeNull();
    await user.click(eq);
    expect(openEq).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Noise control, Ambient sound, Level 12 of 20 · Focus on voice" }));
    expect(openNoise).toHaveBeenCalledOnce();
    // The entry cards are the first row: the first two cells of the grid.
    const cells = container.querySelectorAll(".card-grid > .card-stack");
    expect(cells).toHaveLength(2);
    expect(cells[0]).toContainElement(eq);
  });

  it("never leaves an empty cell, so a lone card sits in the left column", () => {
    const { container } = render(
      <SoundOverview
        noise={{ mode: "off", ambientLevel: 1, focusOnVoice: false, canCancel: true, canAmbient: true, onOpen: noop }}
      />,
    );
    const cells = container.querySelectorAll(".card-grid > *");
    expect(cells).toHaveLength(1);
    expect(cells[0]).toHaveTextContent("Ambient sound control is off");
  });
});

describe("noiseSummary", () => {
  it("reads each mode in the Sony app's terms", () => {
    expect(noiseSummary("cancelling", 20, false)).toBe("Blocks surrounding sound");
    expect(noiseSummary("wind", 20, false)).toBe("Also cuts the sound of wind");
    expect(noiseSummary("ambient", 7, false)).toBe("Level 7 of 20");
    expect(noiseSummary("off", 7, true)).toBe("Ambient sound control is off");
  });
});
