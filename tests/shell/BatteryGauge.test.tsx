import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BatteryGauge } from "../../src/components/shell/BatteryGauge";

describe("BatteryGauge", () => {
  it("is a meter carrying the level and its spoken text", () => {
    render(<BatteryGauge percent={83} charging={false} />);
    const meter = screen.getByRole("meter", { name: "Battery" });
    expect(meter).toHaveAttribute("aria-valuenow", "83");
    expect(meter).toHaveAttribute("aria-valuemin", "0");
    expect(meter).toHaveAttribute("aria-valuemax", "100");
    expect(meter).toHaveAttribute("aria-valuetext", "83%");
    expect(meter).toHaveTextContent("83%");
  });

  it("says charging only while charging", () => {
    const { rerender } = render(<BatteryGauge percent={55} charging={false} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", "55%");

    rerender(<BatteryGauge percent={55} charging />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", "55%, charging");
  });

  it.each([
    [100, "normal"],
    [20, "normal"],
    [15, "low"],
    [10, "low"],
    [5, "critical"],
  ])("at %i%% the tone is %s", (percent, tone) => {
    render(<BatteryGauge percent={percent} charging={false} />);
    expect(screen.getByRole("meter")).toHaveAttribute("data-tone", tone);
  });

  it("clamps and rounds out-of-range input", () => {
    const { rerender } = render(<BatteryGauge percent={140} charging={false} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "100");
    rerender(<BatteryGauge percent={-3} charging={false} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "0");
    rerender(<BatteryGauge percent={9.6} charging={false} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "10");
  });
});
