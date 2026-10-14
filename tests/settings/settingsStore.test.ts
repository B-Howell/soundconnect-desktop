import { describe, expect, it } from "vitest";
import type { StateStorage } from "zustand/middleware";
import { safeStorage } from "../../src/state/safeStorage";
import {
  createSettingsStore,
  SETTINGS_DEFAULTS,
  SETTINGS_STORAGE_KEY,
  sanitizeSettings,
} from "../../src/state/settingsStore";
import { shortCommit } from "../../src/lib/buildInfo";
import { licenseParagraphs } from "../../src/lib/licenses";

/** An in-memory `Storage` stand-in (Node has no localStorage). */
function fakeStorage(): Storage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => Array.from(data.keys())[index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

const throwing: StateStorage = {
  getItem: () => {
    throw new Error("SecurityError: storage blocked");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError: storage blocked");
  },
};

describe("settingsStore", () => {
  it("starts with the documented defaults", () => {
    const storage = fakeStorage();
    const store = createSettingsStore(safeStorage(() => storage));
    const { theme, startWithWindows, keepRunningInTray, startMinimized } = store.getState();
    expect({ theme, startWithWindows, keepRunningInTray, startMinimized }).toEqual({
      theme: "system",
      startWithWindows: false,
      keepRunningInTray: true,
      startMinimized: false,
    });
    expect(SETTINGS_DEFAULTS.keepRunningInTray).toBe(true);
  });

  it("round-trips every setting through one storage key", () => {
    const storage = fakeStorage();
    const first = createSettingsStore(safeStorage(() => storage));
    first.getState().setTheme("light");
    first.getState().setStartWithWindows(true);
    first.getState().setStartMinimized(true);
    first.getState().setKeepRunningInTray(false);
    first.getState().setOnboardingDone(true);
    first.getState().setAutoConnect(true);

    expect(Array.from(storage.data.keys())).toEqual([SETTINGS_STORAGE_KEY]);
    const saved = JSON.parse(storage.data.get(SETTINGS_STORAGE_KEY) ?? "null");
    expect(saved.state).toEqual({
      theme: "light",
      startWithWindows: true,
      startMinimized: true,
      keepRunningInTray: false,
      onboardingDone: true,
      autoConnect: true,
    });

    const second = createSettingsStore(safeStorage(() => storage));
    expect(second.getState()).toMatchObject({
      theme: "light",
      startWithWindows: true,
      startMinimized: true,
      keepRunningInTray: false,
    });
  });

  it("survives a storage whose every call throws", () => {
    const store = createSettingsStore(safeStorage(() => throwing as unknown as Storage));
    expect(store.getState().theme).toBe("system");
    expect(() => store.getState().setTheme("dark")).not.toThrow();
    expect(store.getState().theme).toBe("dark");
  });

  it("survives a storage accessor that throws (blocked localStorage)", () => {
    const store = createSettingsStore(
      safeStorage(() => {
        throw new Error("SecurityError: access denied");
      }),
    );
    expect(() => store.getState().setStartWithWindows(true)).not.toThrow();
    expect(store.getState().startWithWindows).toBe(true);
  });

  it("ignores corrupt or ill-typed stored values", () => {
    const storage = fakeStorage();
    storage.setItem(SETTINGS_STORAGE_KEY, "{not json");
    expect(createSettingsStore(safeStorage(() => storage)).getState().theme).toBe("system");

    storage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ state: { theme: "sepia", startWithWindows: "yes", keepRunningInTray: false }, version: 1 }),
    );
    expect(createSettingsStore(safeStorage(() => storage)).getState()).toMatchObject({
      theme: "system",
      startWithWindows: false,
      keepRunningInTray: false,
    });
  });

  it("sanitizeSettings keeps only known, well-typed fields", () => {
    expect(sanitizeSettings(null)).toEqual({});
    expect(sanitizeSettings({ theme: "dark", startMinimized: true, extra: 1 })).toEqual({
      theme: "dark",
      startMinimized: true,
    });
  });
});

describe("shortCommit", () => {
  it("abbreviates a full hash and leaves a fallback alone", () => {
    expect(shortCommit("4c91fe69711ce638a34e066d9bdcfaff504bbec8")).toBe("4c91fe6");
    expect(shortCommit("unknown")).toBe("unknown");
  });
});

describe("licenseParagraphs", () => {
  it("splits on blank lines and joins hard-wrapped lines, CRLF or LF", () => {
    const lines = ["MIT License", "", "Copyright (c) A", "", "Permission is", "granted.", ""];
    expect(licenseParagraphs(lines.join("\r\n"))).toEqual(licenseParagraphs(lines.join("\n")));
    expect(licenseParagraphs(lines.join("\r\n"))).toEqual([
      "MIT License",
      "Copyright (c) A",
      "Permission is granted.",
    ]);
  });
});
