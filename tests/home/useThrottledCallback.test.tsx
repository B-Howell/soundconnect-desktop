import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useThrottledCallback } from "../../src/hooks/useThrottledCallback";

describe("useThrottledCallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires the first call at once, then at most once per interval, ending on the last value", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(fn, 100));

    result.current(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith(1);

    vi.advanceTimersByTime(30);
    result.current(2);
    vi.advanceTimersByTime(30);
    result.current(3);
    expect(fn).toHaveBeenCalledTimes(1);

    // The trailing call lands when the interval since the first call ends.
    vi.advanceTimersByTime(39);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(3);

    // Nothing more is pending.
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throttles a steady stream to one call per interval", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(fn, 100));
    for (let value = 0; value < 50; value += 1) {
      result.current(value);
      vi.advanceTimersByTime(10);
    }
    vi.advanceTimersByTime(100);
    // 500 ms of calls plus the trailing flush: 0, 100, ..., 500 ms.
    expect(fn).toHaveBeenCalledTimes(6);
    expect(fn).toHaveBeenLastCalledWith(49);
  });

  it("calls at once again after a quiet interval", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(fn, 100));
    result.current("a");
    vi.advanceTimersByTime(150);
    result.current("b");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith("b");
  });

  it("uses the latest fn and stays the same function across renders", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ fn }) => useThrottledCallback(fn, 100), {
      initialProps: { fn: first },
    });
    const throttled = result.current;
    result.current(1);
    result.current(2);
    rerender({ fn: second });
    expect(result.current).toBe(throttled);
    vi.advanceTimersByTime(100);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith(2);
  });

  it("drops a pending call on cancel and on unmount", () => {
    const fn = vi.fn();
    const { result, unmount } = renderHook(() => useThrottledCallback(fn, 100));
    result.current(1);
    result.current(2);
    result.current.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);

    result.current(3);
    result.current(4);
    unmount();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(3);
  });
});
