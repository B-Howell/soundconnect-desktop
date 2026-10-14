import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import monoMicPlan from "../../src-tauri/fixtures/winaudio/plan-mono-mic.json";
import stereoPlan from "../../src-tauri/fixtures/winaudio/plan-stereo.json";
import recording from "../../src-tauri/fixtures/winaudio/test-pc.json";
import { PlanPreviewSheet, ADMIN_PROMPT_NOTE } from "../../src/components/winaudio/PlanPreviewSheet";
import { createMockWinAudioApi, type MockWinAudioApi } from "../../src/lib/winaudio/mockApi";
import type { FixKind, Plan, WinAudioSnapshot } from "../../src/lib/winaudio/types";
import { WindowsAudioPage } from "../../src/pages/WindowsAudioPage";

const ADDRESS = "AA:BB:CC:12:34:56";
let mock: MockWinAudioApi;

vi.mock("../../src/lib/winaudio", () => ({ getWinAudioApi: () => Promise.resolve(mock) }));
vi.mock("../../src/hooks/winaudio/useWinAudioTarget", () => ({
  useWinAudioTarget: () => ({ address: ADDRESS, codec: "AAC" }),
}));

const plans = { stereo: stereoPlan as Plan, monoMic: monoMicPlan as Plan } satisfies Record<FixKind, Plan>;

function makeMock(edit?: (s: WinAudioSnapshot) => void) {
  const snap = structuredClone(recording) as WinAudioSnapshot;
  edit?.(snap);
  mock = createMockWinAudioApi(snap, plans, { adminMs: 0 });
}

beforeEach(() => makeMock());

const rowOf = (title: string) => screen.getByText(title).closest("li") as HTMLElement;
const tile = (name: RegExp) => screen.getByRole("button", { name });
const ready = () => screen.findByText("Currently:", { exact: false });

describe("WindowsAudioPage on the recording", () => {
  it("marks the current mode tile and says so under the tiles", async () => {
    render(<WindowsAudioPage />);
    await ready();
    expect(tile(/^Stereo audio/)).toHaveAttribute("aria-pressed", "true");
    expect(tile(/^Mono audio with mic/)).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("status")).toHaveTextContent("Currently: Stereo audio");
    expect(screen.queryByText(/Needs attention/)).toBeNull();
    // The old fix buttons are gone.
    expect(screen.queryByRole("button", { name: /Fix for/ })).toBeNull();
  });

  it("marks Mono audio with mic as current when the hands-free profile is on", async () => {
    makeMock((s) => {
      s.handsFreeEnabled = true;
    });
    render(<WindowsAudioPage />);
    await ready();
    expect(tile(/^Mono audio with mic/)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Currently: Mono audio with mic");
  });

  it("renders the renamed rows with live state, and Recommended only where it differs", async () => {
    render(<WindowsAudioPage />);
    await ready();
    expect(screen.getByRole("list", { name: "Processing" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Format and volume" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Connection" })).toBeInTheDocument();
    expect(rowOf("Mono mix (accessibility)")).toHaveTextContent("Off");
    expect(rowOf("Default format")).toHaveTextContent("48 kHz, 16-bit");
    expect(rowOf("Codec reported by headphones")).toHaveTextContent("AAC");
    expect(rowOf("Bluetooth service")).toHaveTextContent("Running");
    expect(rowOf("Lower other sounds during calls")).toHaveTextContent("Do nothing");
    expect(rowOf("Adapter power saving")).toHaveTextContent("Recommended: Off");
    expect(rowOf("Audio enhancements")).not.toHaveTextContent("Recommended");
    expect(rowOf("Absolute volume")).not.toHaveTextContent("Recommended");
    for (const gone of ["Hands-Free (mono call audio)", "Microphone for calls", "Mono audio", "Codec"]) {
      expect(screen.queryByText(gone)).toBeNull();
    }
    expect(screen.getByText(/not connected to Windows now/)).toBeInTheDocument();
  });

  it("marks admin rows with the shield, and only them", async () => {
    render(<WindowsAudioPage />);
    await ready();
    const shield = /needs a Windows permission prompt/;
    expect(rowOf("Absolute volume")).toHaveTextContent(shield);
    expect(rowOf("Adapter power saving")).toHaveTextContent(shield);
    expect(rowOf("Audio enhancements")).not.toHaveTextContent(shield);
    expect(rowOf("Mono mix (accessibility)")).not.toHaveTextContent(shield);
  });

  it("a switch applies its one change, then the summary asks for attention", async () => {
    const user = userEvent.setup();
    render(<WindowsAudioPage />);
    await ready();
    await user.click(within(rowOf("Audio enhancements")).getByRole("switch"));
    await waitFor(() => expect(mock.batches).toHaveLength(1));
    expect(mock.batches[0]).toEqual({
      admin: false,
      changes: [
        {
          kind: "setEnhancements",
          endpointId: "{0.0.0.00000000}.{33f2e282-497a-462e-89e8-70ce4e01ffdc}",
          enabled: true,
        },
      ],
    });
    expect(await screen.findByText("Needs attention (1)")).toBeInTheDocument();
    expect(rowOf("Audio enhancements")).toHaveTextContent("Recommended: Off");
    expect(screen.getByText("1 change applied and checked.")).toBeInTheDocument();
  });

  it("choosing Mono audio with mic previews its plan, then applies admin first", async () => {
    const user = userEvent.setup();
    const fixPreset = vi.spyOn(mock, "fixPreset");
    render(<WindowsAudioPage />);
    await ready();
    await user.click(tile(/^Mono audio with mic/));
    expect(fixPreset).toHaveBeenCalledWith("monoMic", ADDRESS, "AAC");
    const sheet = await screen.findByRole("dialog", { name: "Switch to Mono audio with mic" });
    const items = within(within(sheet).getByRole("list", { name: "Changes" })).getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual([
      "Turn the hands-free profile (headphone mic, mono sound) on.(needs a Windows permission prompt)",
      "Use the headphones' hands-free audio and microphone for voice chat and calls.",
    ]);
    expect(sheet).toHaveTextContent(ADMIN_PROMPT_NOTE);
    expect(sheet).toHaveTextContent("All sound will be mono");
    expect(mock.batches).toHaveLength(0);

    await user.click(within(sheet).getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(mock.batches).toHaveLength(2));
    expect(mock.batches.map((b) => [b.admin, b.changes.map((c) => c.kind)])).toEqual([
      [true, ["setHandsFree"]],
      [false, ["useHandsFreeForCommunications"]],
    ]);
    // The recording has no hands-free endpoints, so the second change reports why.
    expect(await screen.findByText(/Not changed: hands-free audio for voice chat/)).toBeInTheDocument();
    // The hands-free profile is now on, so the mono tile is the current one.
    await waitFor(() => expect(tile(/^Mono audio with mic/)).toHaveAttribute("aria-pressed", "true"));
  });

  it("choosing the current tile does nothing; Review opens the current mode's plan when attention is needed", async () => {
    const user = userEvent.setup();
    makeMock((s) => {
      s.duckingMode = "reduce80";
    });
    const fixPreset = vi.spyOn(mock, "fixPreset");
    render(<WindowsAudioPage />);
    await ready();
    await user.click(tile(/^Stereo audio/));
    expect(fixPreset).not.toHaveBeenCalled();
    expect(screen.getByText("Needs attention (1)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Review" }));
    expect(fixPreset).toHaveBeenCalledWith("stereo", ADDRESS, "AAC");
    expect(await screen.findByRole("dialog", { name: "Switch to Stereo audio" })).toBeInTheDocument();
  });

  it("keeps Restore inside the closed Advanced disclosure", async () => {
    const user = userEvent.setup();
    render(<WindowsAudioPage />);
    await ready();
    const toggle = screen.getByRole("button", { name: "Advanced" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /Restore previous settings/ })).toBeNull();
    await user.click(toggle);
    expect(screen.queryByRole("button", { name: /Restore previous settings/ })).toBeNull();
    expect(screen.getByText(/Nothing to restore yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open Windows Sound settings/ })).toBeEnabled();

    await user.click(within(rowOf("Mono mix (accessibility)")).getByRole("switch"));
    expect(await screen.findByRole("button", { name: /Restore previous settings/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Forget restore point/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Restore previous settings/ }));
    expect(await screen.findByRole("dialog", { name: "Restore Windows settings?" })).toBeInTheDocument();
  });
});

describe("PlanPreviewSheet", () => {
  it("says there is nothing to change and offers only Close", () => {
    render(<PlanPreviewSheet kind="stereo" plan={stereoPlan as Plan} onConfirm={vi.fn()} onClose={vi.fn()} />);
    const sheet = screen.getByRole("dialog", { name: "Switch to Stereo audio" });
    expect(sheet).toHaveTextContent("Nothing to change.");
    expect(sheet).toHaveTextContent("not connected to Windows");
    expect(within(sheet).queryByRole("button", { name: "Apply" })).toBeNull();
    expect(within(sheet).getByRole("button", { name: "Close" })).toBeInTheDocument();
  });
});
