import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Toggle } from "../../src/components/primitives/Toggle";
import { ToggleRow } from "../../src/components/primitives/ToggleRow";

function Harness({ onChange }: { onChange: (checked: boolean) => void }) {
  const [checked, setChecked] = useState(false);
  return (
    <Toggle
      label="Speak-to-Chat"
      checked={checked}
      onChange={(next) => {
        onChange(next);
        setChecked(next);
      }}
    />
  );
}

describe("Toggle", () => {
  it("is a switch that flips aria-checked on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const toggle = screen.getByRole("switch", { name: "Speak-to-Chat" });
    expect(toggle).toHaveAttribute("aria-checked", "false");

    await user.click(toggle);
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("flips on Space", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.tab();
    await user.keyboard(" ");
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    await user.keyboard(" ");
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    expect(onChange.mock.calls).toEqual([[true], [false]]);
  });

  it("is named by its row title inside a ToggleRow", () => {
    render(
      <ul>
        <ToggleRow title="Wearing detection" checked onChange={() => undefined} />
      </ul>,
    );
    expect(screen.getByRole("switch", { name: "Wearing detection" })).toHaveAttribute("aria-checked", "true");
  });
});
