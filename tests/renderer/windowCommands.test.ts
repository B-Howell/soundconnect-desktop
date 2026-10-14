import { describe, expect, it, vi } from "vitest";
import {
  bindWindowCommands,
  noopWindowCommands,
  type WindowLike,
} from "../../src/components/frame/windowCommands";

function fakeWindow(overrides: Partial<WindowLike> = {}): WindowLike & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    minimize: async () => {
      calls.push("minimize");
    },
    toggleMaximize: async () => {
      calls.push("toggleMaximize");
    },
    close: async () => {
      calls.push("close");
    },
    isMaximized: async () => false,
    ...overrides,
  };
}

describe("bindWindowCommands", () => {
  it("forwards each click to the matching window call", async () => {
    const win = fakeWindow();
    const commands = bindWindowCommands(win);
    commands.minimize();
    commands.toggleMaximize();
    commands.close();
    await Promise.resolve();
    expect(win.calls).toEqual(["minimize", "toggleMaximize", "close"]);
  });

  it("reports a rejected window call instead of throwing from the handler", async () => {
    const error = new Error("window.close not allowed");
    const win = fakeWindow({ close: () => Promise.reject(error) });
    const report = vi.fn();
    const commands = bindWindowCommands(win, report);
    expect(() => commands.close()).not.toThrow();
    await Promise.resolve();
    expect(report).toHaveBeenCalledWith(error);
  });

  it("offers inert commands for the plain browser", () => {
    expect(() => {
      noopWindowCommands.minimize();
      noopWindowCommands.toggleMaximize();
      noopWindowCommands.close();
    }).not.toThrow();
  });
});
