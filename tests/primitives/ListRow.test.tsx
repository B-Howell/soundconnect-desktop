import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GroupedList } from "../../src/components/primitives/GroupedList";
import { ListRow } from "../../src/components/primitives/ListRow";

describe("ListRow", () => {
  it("renders a button when it has onPress and fires it on Enter", async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(
      <GroupedList aria-label="Settings">
        <ListRow title="Equalizer" trailing="Bright" disclosure onPress={onPress} />
      </GroupedList>,
    );
    const row = screen.getByRole("button", { name: /Equalizer/ });
    await user.tab();
    expect(row).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("announces the chosen row of a picker with aria-current", () => {
    render(
      <GroupedList aria-label="Auto power off">
        <ListRow title="5 minutes" onPress={() => undefined} />
        <ListRow title="30 minutes" selected onPress={() => undefined} />
      </GroupedList>,
    );
    expect(screen.getByRole("button", { name: "30 minutes" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "5 minutes" })).not.toHaveAttribute("aria-current");
  });

  it("is plain content without onPress, inside a named list", () => {
    render(
      <GroupedList aria-label="Settings">
        <ListRow title="Model" trailing="WH-1000XM4" />
        <ListRow title="Firmware" trailing="4.6.0" />
      </GroupedList>,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("WH-1000XM4")).toBeInTheDocument();
  });
});
