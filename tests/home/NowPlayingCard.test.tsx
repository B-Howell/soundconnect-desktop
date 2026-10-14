import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NowPlayingCard, type NowPlayingCardProps } from "../../src/components/playback/NowPlayingCard";

const noop = () => undefined;

function props(overrides: Partial<NowPlayingCardProps> = {}): NowPlayingCardProps {
  return {
    title: "Teardrop",
    artist: "Massive Attack",
    album: "Mezzanine",
    status: "playing",
    volume: 12,
    maxVolume: 30,
    onPlayPause: noop,
    onNext: noop,
    onPrevious: noop,
    onVolumeChange: noop,
    onVolumeCommit: noop,
    ...overrides,
  };
}

const playPauseGlyph = (name: string) =>
  screen.getByRole("button", { name }).querySelector("svg")?.getAttribute("data-icon");

describe("NowPlayingCard", () => {
  it("shows the track title over artist and album", () => {
    render(<NowPlayingCard {...props()} />);
    expect(screen.getByText("Teardrop")).toBeInTheDocument();
    expect(screen.getByText("Massive Attack · Mezzanine")).toBeInTheDocument();
    expect(screen.queryByText("Nothing playing")).toBeNull();
  });

  it("reads Nothing playing without a title", () => {
    render(<NowPlayingCard {...props({ title: "  ", artist: undefined, album: undefined, status: "stopped" })} />);
    expect(screen.getByText("Nothing playing")).toBeInTheDocument();
  });

  it("offers Pause with the pause glyph only while playing", () => {
    const { rerender } = render(<NowPlayingCard {...props({ status: "playing" })} />);
    expect(playPauseGlyph("Pause")).toBe("pause");
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();

    for (const status of ["paused", "stopped", "unknown"] as const) {
      rerender(<NowPlayingCard {...props({ status })} />);
      expect(playPauseGlyph("Play")).toBe("play");
      expect(screen.queryByRole("button", { name: "Pause" })).toBeNull();
    }
  });

  it("calls the transport callbacks", async () => {
    const user = userEvent.setup();
    const onPlayPause = vi.fn();
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    render(<NowPlayingCard {...props({ onPlayPause, onNext, onPrevious })} />);
    await user.click(screen.getByRole("button", { name: "Next track" }));
    await user.click(screen.getByRole("button", { name: "Previous track" }));
    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onPlayPause).toHaveBeenCalledTimes(1);
  });

  it("reports live volume and commits once on release, within 0..maxVolume", () => {
    const onVolumeChange = vi.fn();
    const onVolumeCommit = vi.fn();
    render(<NowPlayingCard {...props({ onVolumeChange, onVolumeCommit })} />);
    const slider = screen.getByRole("slider", { name: "Volume" });
    expect(slider).toHaveAttribute("min", "0");
    expect(slider).toHaveAttribute("max", "30");

    fireEvent.pointerDown(slider, { button: 0, pointerId: 1 });
    fireEvent.change(slider, { target: { value: "14" } });
    fireEvent.change(slider, { target: { value: "18" } });
    fireEvent.pointerUp(slider, { pointerId: 1 });

    expect(onVolumeChange).toHaveBeenNthCalledWith(1, 14);
    expect(onVolumeChange).toHaveBeenNthCalledWith(2, 18);
    expect(onVolumeCommit).toHaveBeenCalledTimes(1);
    expect(onVolumeCommit).toHaveBeenCalledWith(18);
  });

  it("disables every control when disabled", () => {
    render(<NowPlayingCard {...props({ disabled: true })} />);
    for (const name of ["Previous track", "Pause", "Next track"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
    expect(screen.getByRole("slider", { name: "Volume" })).toBeDisabled();
  });
});
