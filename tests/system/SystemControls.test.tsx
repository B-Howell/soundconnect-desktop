import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AssignableControlsCard } from "../../src/components/system/AssignableControlsCard";
import { assignableActionLabel, assignableKeyLabel } from "../../src/components/system/assignableLabels";
import { AutoPowerOffPicker } from "../../src/components/system/AutoPowerOffPicker";
import { V1_AUTO_POWER_OFF_OPTIONS } from "../../src/components/system/autoPowerOff";
import { GeneralSettingRow } from "../../src/components/system/GeneralSettingRow";
import { PowerOffRow } from "../../src/components/system/PowerOffRow";
import { VoiceGuidanceRow } from "../../src/components/system/VoiceGuidanceRow";
import { SystemSections } from "../../src/components/system/SystemSections";

const noop = () => undefined;

describe("AutoPowerOffPicker", () => {
  it("lists only the given options and reports null for Never", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ul>
        <AutoPowerOffPicker options={V1_AUTO_POWER_OFF_OPTIONS} value={30} onChange={onChange} />
      </ul>,
    );
    const row = screen.getByRole("button", { name: /Auto power off/ });
    expect(row).toHaveTextContent("30 minutes");

    await user.click(row);
    const sheet = screen.getByRole("dialog", { name: "Auto power off" });
    const names = within(sheet)
      .getAllByRole("button")
      .map((button) => button.textContent);
    // The v1 family has no 15-minute choice.
    expect(names).toEqual(["5 minutes", "30 minutes", "1 hour", "3 hours", "Never"]);

    await user.click(within(sheet).getByRole("button", { name: "Never" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
  });

  it("only closes the sheet when the current choice is picked again", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ul>
        <AutoPowerOffPicker options={V1_AUTO_POWER_OFF_OPTIONS} value={null} onChange={onChange} />
      </ul>,
    );
    await user.click(screen.getByRole("button", { name: /Auto power off/ }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Never" }));
    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("AssignableControlsCard", () => {
  it("names controls from upstream ids and reports (location, action)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const actions = [2, 6, 7].map((action) => ({ action, label: assignableActionLabel(action) }));
    render(
      <AssignableControlsCard
        controls={[{ location: 5, type: 2, action: 2, actionLabel: assignableActionLabel(2) }]}
        actions={actions}
        onChange={onChange}
      />,
    );
    const row = screen.getByRole("button", { name: /NC\/AMB button/ });
    expect(row).toHaveTextContent("Ambient sound control");

    await user.click(row);
    const sheet = screen.getByRole("dialog", { name: "NC/AMB button function" });
    await user.click(within(sheet).getByRole("button", { name: "Amazon Alexa" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(5, 7);
  });

  it("maps locations and types like upstream", () => {
    expect(assignableKeyLabel(1, 1)).toBe("Left touch sensor");
    expect(assignableKeyLabel(2, 3)).toBe("Right face tap");
    expect(assignableKeyLabel(2, 2)).toBe("Right button");
    expect(assignableKeyLabel(4, 2)).toBe("C button");
    expect(assignableActionLabel(0)).toBe("No function");
    expect(assignableActionLabel(99)).toBe("Unknown");
  });
});

describe("PowerOffRow", () => {
  it("asks first, focuses Cancel, and calls onConfirm only after Power off", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<PowerOffRow deviceName="WH-1000XM4" onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: "Power off" }));
    const sheet = screen.getByRole("dialog", { name: "Power off WH-1000XM4?" });
    expect(within(sheet).getByRole("button", { name: "Cancel" })).toHaveFocus();
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(within(sheet).getByRole("button", { name: "Power off" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("drops an open confirmation when it becomes disabled", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const { rerender } = render(<PowerOffRow deviceName="WH-1000XM4" onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: "Power off" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    rerender(<PowerOffRow deviceName="WH-1000XM4" onConfirm={onConfirm} disabled />);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("does nothing on Cancel", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<PowerOffRow deviceName="WH-1000XM4" onConfirm={onConfirm} />);
    const opener = screen.getByRole("button", { name: "Power off" });
    await user.click(opener);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(opener).toHaveFocus();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("Device rows", () => {
  it("reports a general setting by index and locks a read-only one", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ul>
        <GeneralSettingRow index={2} subject="Touch sensor control panel" value writable onChange={onChange} />
        <GeneralSettingRow index={3} subject="Read-only" summary="Shown, not changed" value={false} writable={false} onChange={onChange} />
      </ul>,
    );
    await user.click(screen.getByRole("switch", { name: "Touch sensor control panel" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(2, false);
    expect(screen.getByRole("switch", { name: "Read-only" })).toBeDisabled();
    expect(screen.getByText("Shown, not changed")).toBeInTheDocument();
  });

  it("shows a voice guidance volume only when the device has one", () => {
    const { rerender } = render(
      <ul>
        <VoiceGuidanceRow enabled onEnabledChange={noop} />
      </ul>,
    );
    expect(screen.getByRole("switch", { name: "Voice guidance" })).toBeInTheDocument();
    expect(screen.queryByRole("slider")).toBeNull();
    rerender(
      <ul>
        <VoiceGuidanceRow enabled onEnabledChange={noop} volume={-1} />
      </ul>,
    );
    expect(screen.getByRole("slider", { name: "Voice guidance volume" })).toHaveAttribute("aria-valuetext", "−1");
  });
});

describe("SystemSections", () => {
  it("keeps the placeholder without device data", () => {
    render(<SystemSections />);
    expect(screen.getByText("Not available on these headphones.")).toBeInTheDocument();
  });

  it("composes Device, Notification & voice guide and Power, with the destructive button only under Power", () => {
    render(
      <SystemSections
        device={{
          generalSettings: [{ index: 2, subject: "Touch sensor control panel", value: true, writable: true }],
          onGeneralSettingChange: noop,
          autoPause: { enabled: true, onChange: noop },
          autoPowerOff: { options: V1_AUTO_POWER_OFF_OPTIONS, value: 30, onChange: noop },
        }}
        voiceGuidance={{ enabled: true, onEnabledChange: noop }}
        power={{ deviceName: "WH-1000XM4", onConfirm: noop }}
      />,
    );
    const device = screen.getByRole("region", { name: "Device" });
    expect(within(device).getByRole("switch", { name: "Touch sensor control panel" })).toBeInTheDocument();
    expect(
      within(device).getByRole("switch", { name: "Automatic pause when headphones are removed" }),
    ).toBeInTheDocument();
    expect(within(device).getByRole("button", { name: /Auto power off/ })).toBeInTheDocument();
    const voice = screen.getByRole("region", { name: "Notification & voice guide" });
    expect(within(voice).getByRole("switch", { name: "Voice guidance" })).toBeInTheDocument();
    const power = screen.getAllByRole("button", { name: "Power off" });
    expect(power).toHaveLength(1);
    expect(screen.getByRole("region", { name: "Power" })).toContainElement(power[0]);
    expect(screen.getByRole("region", { name: "Only in the phone app" })).toHaveTextContent("Software update");
  });
});
