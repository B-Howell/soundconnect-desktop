import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Slider } from "../../src/components/primitives/Slider";

interface HarnessProps {
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
  onGestureChange?: (active: boolean) => void;
}

function Harness({ onChange, onCommit, onGestureChange }: HarnessProps) {
  const [value, setValue] = useState(5);
  return (
    <>
      <Slider
        label="Ambient sound level"
        value={value}
        min={0}
        max={20}
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
        onCommit={onCommit}
        onGestureChange={onGestureChange}
        formatValue={(v) => `Level ${v}`}
      />
      {/* Stands in for a device notification changing the value from outside. */}
      <button type="button" onClick={() => setValue(9)}>
        Device says 9
      </button>
    </>
  );
}

/** A slider the "device" can disable mid-drag, while also moving its value. */
function DisableHarness({ onGestureChange }: { onGestureChange: (active: boolean) => void }) {
  const [value, setValue] = useState(5);
  const [disabled, setDisabled] = useState(false);
  return (
    <>
      <Slider
        label="Ambient sound level"
        value={value}
        min={0}
        max={20}
        disabled={disabled}
        onChange={setValue}
        onGestureChange={onGestureChange}
        formatValue={(v) => `Level ${v}`}
      />
      <button
        type="button"
        onClick={() => {
          setValue(3);
          setDisabled(true);
        }}
      >
        Device leaves ambient
      </button>
    </>
  );
}

describe("Slider", () => {
  it("is a labelled range input showing the formatted value", () => {
    render(<Harness onChange={() => undefined} onCommit={() => undefined} />);
    const slider = screen.getByRole("slider", { name: "Ambient sound level" });
    expect(slider).toHaveAttribute("type", "range");
    expect(slider).toHaveAttribute("aria-valuetext", "Level 5");
    expect(screen.getByText("Level 5")).toBeInTheDocument();
  });

  it("reports every value while dragging and commits once on release", () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    render(<Harness onChange={onChange} onCommit={onCommit} />);
    const slider = screen.getByRole("slider");

    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: "8" } });
    fireEvent.change(slider, { target: { value: "11" } });
    fireEvent.change(slider, { target: { value: "13" } });
    expect(onChange.mock.calls).toEqual([[8], [11], [13]]);
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.pointerUp(slider);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(13);
    expect(slider).toHaveAttribute("aria-valuetext", "Level 13");
  });

  it("does not commit a press that ends where it started", () => {
    const onCommit = vi.fn();
    render(<Harness onChange={() => undefined} onCommit={onCommit} />);
    const slider = screen.getByRole("slider");
    fireEvent.pointerDown(slider);
    fireEvent.pointerUp(slider);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("ends an interrupted drag on pointer cancel, and a held drag on blur", () => {
    const onCommit = vi.fn();
    render(<Harness onChange={() => undefined} onCommit={onCommit} />);
    const slider = screen.getByRole("slider");

    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: "8" } });
    fireEvent.pointerCancel(slider);
    expect(onCommit).toHaveBeenLastCalledWith(8);

    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: "12" } });
    fireEvent.blur(slider);
    expect(onCommit).toHaveBeenLastCalledWith(12);
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it("commits at once when the value is set outside any gesture", () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    render(<Harness onChange={onChange} onCommit={onCommit} />);
    // Assistive technology sets the value directly: no pointer or key gesture.
    fireEvent.change(screen.getByRole("slider"), { target: { value: "17" } });
    expect(onChange).toHaveBeenCalledWith(17);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(17);
  });

  it("starts the next gesture from a value that changed from outside while idle", () => {
    const onCommit = vi.fn();
    render(<Harness onChange={() => undefined} onCommit={onCommit} />);
    fireEvent.click(screen.getByRole("button", { name: "Device says 9" }));
    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("aria-valuetext", "Level 9");

    // A press that ends on the externally set value sends nothing.
    fireEvent.pointerDown(slider);
    fireEvent.pointerUp(slider);
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: "10" } });
    fireEvent.pointerUp(slider);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(10);
  });

  it("does not commit again when blur follows a finished drag", () => {
    const onCommit = vi.fn();
    render(<Harness onChange={() => undefined} onCommit={onCommit} />);
    const slider = screen.getByRole("slider");
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: "8" } });
    fireEvent.pointerUp(slider);
    fireEvent.blur(slider);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(8);
  });

  it("commits an assistive-technology change at once after a finished drag", () => {
    const onCommit = vi.fn();
    render(<Harness onChange={() => undefined} onCommit={onCommit} />);
    const slider = screen.getByRole("slider");
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: "8" } });
    fireEvent.pointerUp(slider);
    fireEvent.change(slider, { target: { value: "15" } });
    expect(onCommit.mock.calls).toEqual([[8], [15]]);
  });

  it("keeps showing the user's value when the value changes from outside mid-drag", () => {
    const onCommit = vi.fn();
    const onGestureChange = vi.fn();
    render(<Harness onChange={() => undefined} onCommit={onCommit} onGestureChange={onGestureChange} />);
    const slider = screen.getByRole("slider");

    fireEvent.pointerDown(slider);
    expect(onGestureChange).toHaveBeenLastCalledWith(true);
    fireEvent.change(slider, { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Device says 9" }));
    expect(slider).toHaveAttribute("aria-valuetext", "Level 12");
    expect(slider).toHaveValue("12");

    fireEvent.pointerUp(slider);
    expect(onGestureChange).toHaveBeenLastCalledWith(false);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(12);
  });

  it("ends a gesture when the slider becomes disabled mid-drag", () => {
    const onGestureChange = vi.fn();
    render(<DisableHarness onGestureChange={onGestureChange} />);
    const slider = screen.getByRole("slider");
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: "12" } });
    expect(onGestureChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "Device leaves ambient" }));
    expect(onGestureChange).toHaveBeenLastCalledWith(false);
    expect(slider).toBeDisabled();
    expect(slider).toHaveAttribute("aria-valuetext", "Level 3");
  });

  it("does not let a key release end a drag", () => {
    const onCommit = vi.fn();
    render(<Harness onChange={() => undefined} onCommit={onCommit} />);
    const slider = screen.getByRole("slider");
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: "8" } });
    fireEvent.keyUp(slider, { key: "ArrowRight" });
    fireEvent.change(slider, { target: { value: "9" } });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(slider);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(9);
  });

  it("ignores presses of non-primary mouse buttons", () => {
    const onGestureChange = vi.fn();
    render(<Harness onChange={() => undefined} onCommit={() => undefined} onGestureChange={onGestureChange} />);
    fireEvent.pointerDown(screen.getByRole("slider"), { button: 2 });
    expect(onGestureChange).not.toHaveBeenCalled();
  });

  it("commits a keyboard adjustment once, on key release", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness onChange={() => undefined} onCommit={onCommit} />);
    const slider = screen.getByRole("slider");
    await user.tab();
    expect(slider).toHaveFocus();

    // jsdom does not step a range input on arrow keys, so the value changes a
    // browser makes while an arrow is held are applied by hand.
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.change(slider, { target: { value: "6" } });
    fireEvent.keyDown(slider, { key: "ArrowRight", repeat: true });
    fireEvent.change(slider, { target: { value: "7" } });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.keyUp(slider, { key: "ArrowRight" });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(7);
  });
  it("fills from origin to the value, on either side", () => {
    const { rerender } = render(
      <Slider label="Band" value={5} min={-10} max={10} origin={0} onChange={() => undefined} />,
    );
    const fill = () => {
      const style = screen.getByRole("slider").style;
      return [style.getPropertyValue("--slider-fill-from"), style.getPropertyValue("--slider-fill-to")];
    };
    expect(fill()).toEqual(["50%", "75%"]);
    rerender(<Slider label="Band" value={-5} min={-10} max={10} origin={0} onChange={() => undefined} />);
    expect(fill()).toEqual(["25%", "50%"]);
    rerender(<Slider label="Band" value={5} min={-10} max={10} onChange={() => undefined} />);
    expect(fill()).toEqual(["0%", "75%"]);
  });
});
