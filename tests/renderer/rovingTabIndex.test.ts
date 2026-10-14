import { describe, expect, it } from "vitest";
import { clampRovingIndex, nextRovingIndex } from "../../src/hooks/useRovingTabIndex";

describe("nextRovingIndex", () => {
  it("steps right and left and clamps at the ends without wrapping", () => {
    expect(nextRovingIndex(0, "ArrowRight", 8)).toBe(1);
    expect(nextRovingIndex(7, "ArrowRight", 8)).toBe(7);
    expect(nextRovingIndex(3, "ArrowLeft", 8)).toBe(2);
    expect(nextRovingIndex(0, "ArrowLeft", 8)).toBe(0);
  });

  it("treats up/down like left/right so a vertical-arrow habit still works", () => {
    expect(nextRovingIndex(2, "ArrowDown", 8)).toBe(3);
    expect(nextRovingIndex(2, "ArrowUp", 8)).toBe(1);
  });

  it("Home and End jump to the ends", () => {
    expect(nextRovingIndex(5, "Home", 8)).toBe(0);
    expect(nextRovingIndex(2, "End", 8)).toBe(7);
  });

  it("returns null for other keys and for an empty set", () => {
    expect(nextRovingIndex(2, "Enter", 8)).toBeNull();
    expect(nextRovingIndex(2, "Tab", 8)).toBeNull();
    expect(nextRovingIndex(0, "ArrowRight", 0)).toBeNull();
  });

  it("recovers from an out-of-range current index", () => {
    expect(nextRovingIndex(20, "ArrowLeft", 8)).toBe(6);
    expect(nextRovingIndex(-4, "ArrowRight", 8)).toBe(1);
  });
});

describe("clampRovingIndex", () => {
  it("keeps a remembered index inside the set, 0 for an empty set", () => {
    expect(clampRovingIndex(5, 8)).toBe(5);
    expect(clampRovingIndex(9, 8)).toBe(7);
    expect(clampRovingIndex(-1, 8)).toBe(0);
    expect(clampRovingIndex(3, 0)).toBe(0);
  });
});
