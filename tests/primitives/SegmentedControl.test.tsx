import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl, type SegmentedOption } from "../../src/components/primitives/SegmentedControl";

type Mode = "cancelling" | "ambient" | "off";
const options: readonly SegmentedOption<Mode>[] = [
  { value: "cancelling", label: "Noise cancelling" },
  { value: "ambient", label: "Ambient" },
  { value: "off", label: "Off" },
];

function Harness({ onChange }: { onChange: (value: Mode) => void }) {
  const [value, setValue] = useState<Mode>("cancelling");
  return (
    <SegmentedControl
      label="Noise control"
      options={options}
      value={value}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
    />
  );
}

/** Selection confirmed later, like a device echo: `value` lags the key presses. */
function AsyncHarness({ onChange }: { onChange: (value: Mode) => void }) {
  return <SegmentedControl label="Noise control" options={options} value="cancelling" onChange={onChange} />;
}

describe("SegmentedControl", () => {
  it("is a radio group whose only tab stop is the checked option", () => {
    render(<Harness onChange={() => undefined} />);
    expect(screen.getByRole("radiogroup", { name: "Noise control" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((radio) => radio.getAttribute("aria-checked"))).toEqual(["true", "false", "false"]);
    expect(radios.map((radio) => radio.tabIndex)).toEqual([0, -1, -1]);
  });

  it("moves the selection with arrow keys and reports each new value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.tab();
    expect(screen.getByRole("radio", { name: "Noise cancelling" })).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("ambient");
    expect(screen.getByRole("radio", { name: "Ambient" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Ambient" })).toHaveFocus();

    await user.keyboard("{End}");
    expect(onChange).toHaveBeenLastCalledWith("off");

    await user.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenLastCalledWith("ambient");
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it("does not report a change when an arrow key is already at the end", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.tab();
    await user.keyboard("{ArrowLeft}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("steps from the focused option while the selection is still unconfirmed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AsyncHarness onChange={onChange} />);
    await user.tab();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(onChange.mock.calls).toEqual([["ambient"], ["off"]]);
    expect(screen.getByRole("radio", { name: "Off" })).toHaveFocus();
  });

  it("sends every click while the selection is still unconfirmed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AsyncHarness onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: "Ambient" }));
    await user.click(screen.getByRole("radio", { name: "Noise cancelling" }));
    expect(onChange.mock.calls).toEqual([["ambient"], ["cancelling"]]);
  });

  it("resends a pending option when its echo never arrives", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AsyncHarness onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: "Ambient" }));
    await user.click(screen.getByRole("radio", { name: "Ambient" }));
    expect(onChange.mock.calls).toEqual([["ambient"], ["ambient"]]);
  });

  it("does not resend the confirmed option on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: "Noise cancelling" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("is inert when disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SegmentedControl label="Noise control" options={options} value="cancelling" onChange={onChange} disabled />,
    );
    expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getByRole("radio", { name: "Off" }));
    await user.tab();
    expect(screen.getByRole("radio", { name: "Noise cancelling" })).not.toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the first option tabbable when the value is not among the options", () => {
    render(
      <SegmentedControl
        label="Noise control"
        options={options}
        value={"unknown" as Mode}
        onChange={() => undefined}
      />,
    );
    const radios = screen.getAllByRole("radio");
    expect(radios.map((radio) => radio.tabIndex)).toEqual([0, -1, -1]);
    expect(radios.every((radio) => radio.getAttribute("aria-checked") === "false")).toBe(true);
  });

  it("selects an option on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: "Off" }));
    expect(onChange).toHaveBeenCalledWith("off");
    expect(screen.getByRole("radio", { name: "Off" })).toHaveAttribute("aria-checked", "true");
  });
});
