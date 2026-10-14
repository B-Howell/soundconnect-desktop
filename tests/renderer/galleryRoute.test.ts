import { describe, expect, it } from "vitest";
import { isGalleryQuery } from "../../src/hooks/useGalleryRoute";

describe("isGalleryQuery", () => {
  it("is true only for gallery=1", () => {
    expect(isGalleryQuery("?gallery=1")).toBe(true);
    expect(isGalleryQuery("?foo=bar&gallery=1")).toBe(true);
    expect(isGalleryQuery("")).toBe(false);
    expect(isGalleryQuery("?gallery=0")).toBe(false);
    expect(isGalleryQuery("?gallery")).toBe(false);
  });
});
