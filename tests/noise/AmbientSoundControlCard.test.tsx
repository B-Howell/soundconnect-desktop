import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  AmbientSoundControlCard,
  type AmbientSoundControlCardProps,
} from "../../src/components/noise/AmbientSoundControlCard";
import type { AmbientPosition } from "../../src/components/noise/ambientPositions";
import type { NoiseMode } from "../../src/components/noise/noiseModes";

const noop = () => undefined;

function props(overrides: Partial<AmbientSoundControlCardProps> = {}): AmbientSoundControlCardProps {
  return {
    mode: "cancelling",
    ambientLevel: 10,
    focusOnVoice: false,
    canCancel: true,
    canAmbient: true,
    canWind: true,
    canFocusOnVoice: true,
    onModeChange: noop,
    onPositionChange: noop,
    onPositionCommit: noop,
    onFocusOnVoiceChange: noop,
    ...overrides,
  };
}

/** The card with mode and level in local state, as a page shows them after a device echo. */
function Harness(overrides: Partial<AmbientSoundControlCardProps>) {
  const [mode, setMode] = useState<NoiseMode>("cancelling");
  const [level, setLevel] = useState(10);
  const move = (position: AmbientPosition) => {
    if (position.kind === "ambient") {
      setMode("ambient");
      setLevel(position.level);
    } else setMode(position.kind);
  };
  return (
    <AmbientSoundControlCard
      {...props(overrides)}
      mode={mode}
      ambientLevel={level}
      onModeChange={setMode}
      onPositionChange={(position) => {
        move(position);
        overrides.onPositionChange?.(position);
      }}
    />
  );
}

const segmentNames = () => screen.getAllByRole("radio").map((radio) => radio.textContent);
const slider = () => screen.getByRole("slider", { name: "Ambient sound level" });

describe("AmbientSoundControlCard", () => {
  it("offers Sony's three choices, no separate Wind segment, without the modes the device lacks", () => {
    const { rerender } = render(<AmbientSoundControlCard {...props()} />);
    expect(segmentNames()).toEqual(["Noise cancelling", "Ambient sound", "Off"]);

    rerender(<AmbientSoundControlCard {...props({ mode: "off", canCancel: false })} />);
    expect(segmentNames()).toEqual(["Ambient sound", "Off"]);

    rerender(<AmbientSoundControlCard {...props({ mode: "off", canAmbient: false })} />);
    expect(segmentNames()).toEqual(["Noise cancelling", "Off"]);
  });

  it("shows wind-noise reduction as Noise cancelling with the slider on its stop", () => {
    render(<AmbientSoundControlCard {...props({ mode: "wind" })} />);
    expect(screen.getByRole("radio", { name: "Noise cancelling" })).toHaveAttribute("aria-checked", "true");
    expect(slider()).toHaveAttribute("aria-valuetext", "Wind noise reduction");
    expect(slider()).toHaveAttribute("max", "21");
    expect(screen.getByText(/two lowest positions are Noise cancelling and Wind noise reduction/)).toBeInTheDocument();
  });

  it("sends Noise cancelling from wind mode, although that segment already shows checked", async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    render(<AmbientSoundControlCard {...props({ mode: "wind", onModeChange })} />);
    await user.click(screen.getByRole("radio", { name: "Noise cancelling" }));
    expect(onModeChange).toHaveBeenCalledTimes(1);
    expect(onModeChange).toHaveBeenCalledWith("cancelling");
  });

  it("has a 22-stop slider: cancelling, wind, then levels 1 to 20; hidden while Off", async () => {
    const { rerender } = render(<AmbientSoundControlCard {...props()} />);
    expect(slider()).toHaveValue("0");
    expect(slider()).toHaveAttribute("aria-valuetext", "Noise cancelling");
    rerender(<AmbientSoundControlCard {...props({ mode: "ambient", ambientLevel: 7 })} />);
    expect(slider()).toHaveValue("8");
    expect(slider()).toHaveAttribute("aria-valuetext", "7");
    rerender(<AmbientSoundControlCard {...props({ mode: "off" })} />);
    await waitFor(() => expect(screen.queryByRole("slider")).toBeNull());
  });

  it("reports each stop while dragging and commits the last one once", () => {
    const onPositionChange = vi.fn();
    const onPositionCommit = vi.fn();
    render(<Harness onPositionChange={onPositionChange} onPositionCommit={onPositionCommit} />);
    fireEvent.pointerDown(slider(), { button: 0, pointerId: 1 });
    fireEvent.change(slider(), { target: { value: "1" } });
    fireEvent.change(slider(), { target: { value: "13" } });
    expect(onPositionCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(slider(), { pointerId: 1 });
    expect(onPositionChange.mock.calls.map((c) => c[0])).toEqual([{ kind: "wind" }, { kind: "ambient", level: 12 }]);
    expect(onPositionCommit).toHaveBeenCalledTimes(1);
    expect(onPositionCommit).toHaveBeenCalledWith({ kind: "ambient", level: 12 });
  });

  it("reveals Focus on voice at the ambient levels only", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByRole("switch", { name: "Focus on voice" })).toBeNull();
    await user.click(screen.getByRole("radio", { name: "Ambient sound" }));
    expect(screen.getByRole("switch", { name: "Focus on voice" })).toBeInTheDocument();
  });

  it("leaves out Focus on voice when the device lacks it", () => {
    render(<AmbientSoundControlCard {...props({ mode: "ambient", canFocusOnVoice: false })} />);
    expect(slider()).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Focus on voice" })).toBeNull();
  });

  it("toggles Focus on voice", async () => {
    const user = userEvent.setup();
    const onFocusOnVoiceChange = vi.fn();
    render(<AmbientSoundControlCard {...props({ mode: "ambient", onFocusOnVoiceChange })} />);
    await user.click(screen.getByRole("switch", { name: "Focus on voice" }));
    expect(onFocusOnVoiceChange).toHaveBeenCalledWith(true);
  });

  it("disables every control when disabled", async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    render(<AmbientSoundControlCard {...props({ mode: "ambient", disabled: true, onModeChange })} />);
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
    expect(slider()).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Focus on voice" })).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: "Off" }));
    expect(onModeChange).not.toHaveBeenCalled();
  });
});
