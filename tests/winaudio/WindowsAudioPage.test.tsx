import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import recording from "../../src-tauri/fixtures/winaudio/test-pc.json";
import callsPlan from "../../src-tauri/fixtures/winaudio/plan-calls.json";
import musicPlan from "../../src-tauri/fixtures/winaudio/plan-music.json";
import { PlanPreviewSheet, ADMIN_PROMPT_NOTE } from "../../src/components/winaudio/PlanPreviewSheet";
import { createMockWinAudioApi, type MockWinAudioApi } from "../../src/lib/winaudio/mockApi";
import type { Plan, WinAudioSnapshot } from "../../src/lib/winaudio/types";
import { WindowsAudioPage } from "../../src/pages/WindowsAudioPage";

const ADDRESS = "AA:BB:CC:12:34:56";
let mock: MockWinAudioApi;

vi.mock("../../src/lib/winaudio", () => ({ getWinAudioApi: () => Promise.resolve(mock) }));
vi.mock("../../src/hooks/winaudio/useWinAudioTarget", () => ({
  useWinAudioTarget: () => ({ address: ADDRESS, codec: "AAC" }),
}));

beforeEach(() => {
  mock = createMockWinAudioApi(
    structuredClone(recording) as WinAudioSnapshot,
    { music: musicPlan as Plan, calls: callsPlan as Plan },
    { adminMs: 0 },
  );
});

const rowOf = (title: string) => screen.getByText(title).closest("li") as HTMLElement;

describe("WindowsAudioPage on the recording", () => {
  it("shows each row's live and recommended state, and the summary", async () => {
    render(<WindowsAudioPage />);
    expect(await screen.findByText("Set up for music")).toBeInTheDocument();
    const handsFree = rowOf("Hands-Free (mono call audio)");
    expect(handsFree).toHaveTextContent("Now Off");
    expect(handsFree).toHaveTextContent("Recommended Off");
    expect(rowOf("Microphone for calls")).toHaveTextContent("Snowball (Blue Snowball)");
    expect(rowOf("Format")).toHaveTextContent("48 kHz, 16-bit");
    expect(rowOf("Let Windows turn off the adapter")).toHaveTextContent("differs from the recommendation");
    expect(screen.getByText(/not connected to Windows now/)).toBeInTheDocument();
  });

  it("marks admin rows with the shield, and only them", async () => {
    render(<WindowsAudioPage />);
    await screen.findByText("Set up for music");
    const shield = /needs a Windows permission prompt/;
    expect(rowOf("Hands-Free (mono call audio)")).toHaveTextContent(shield);
    expect(rowOf("Absolute volume")).toHaveTextContent(shield);
    expect(rowOf("Let Windows turn off the adapter")).toHaveTextContent(shield);
    expect(rowOf("Audio enhancements")).not.toHaveTextContent(shield);
    expect(rowOf("Mono audio")).not.toHaveTextContent(shield);
  });

  it("a switch applies its one change and the row re-reads", async () => {
    const user = userEvent.setup();
    render(<WindowsAudioPage />);
    await screen.findByText("Set up for music");
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
    expect(screen.getByText("1 change applied and checked.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
  });

  it("Fix for calls previews the plan, then applies admin first", async () => {
    const user = userEvent.setup();
    render(<WindowsAudioPage />);
    await screen.findByText("Set up for music");
    await user.click(screen.getByRole("button", { name: "Fix for calls" }));
    const sheet = await screen.findByRole("dialog", { name: "Fix for calls" });
    const items = within(within(sheet).getByRole("list", { name: "Changes" })).getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual([
      "Turn Hands-Free (mono call audio) on.(needs a Windows permission prompt)",
      "Use the headphones' Hands-Free audio and microphone for calls.",
    ]);
    expect(sheet).toHaveTextContent(ADMIN_PROMPT_NOTE);
    expect(sheet).toHaveTextContent("Music will be mono");
    expect(mock.batches).toHaveLength(0);

    await user.click(within(sheet).getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(mock.batches).toHaveLength(2));
    expect(mock.batches.map((b) => [b.admin, b.changes.map((c) => c.kind)])).toEqual([
      [true, ["setHandsFree"]],
      [false, ["useHandsFreeForCommunications"]],
    ]);
    // The recording has no Hands-Free endpoints, so the second change reports why.
    expect(await screen.findByText(/Not changed: Hands-Free for calls/)).toBeInTheDocument();
  });
});

describe("PlanPreviewSheet", () => {
  it("says there is nothing to change and offers only Close", () => {
    render(<PlanPreviewSheet kind="music" plan={musicPlan as Plan} onConfirm={vi.fn()} onClose={vi.fn()} />);
    const sheet = screen.getByRole("dialog", { name: "Fix for music" });
    expect(sheet).toHaveTextContent("Nothing to change.");
    expect(sheet).toHaveTextContent("not connected to Windows");
    expect(within(sheet).queryByRole("button", { name: "Apply" })).toBeNull();
    expect(within(sheet).getByRole("button", { name: "Close" })).toBeInTheDocument();
  });
});
