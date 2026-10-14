import { describe, expect, it } from "vitest";
import { idleOptimistic, optimisticReducer, resolveOptimistic, type OptimisticOptions } from "../../src/lib/optimistic";

const options: OptimisticOptions<number> = { equals: Object.is, timeoutMs: 2000 };
const reduce = (state: ReturnType<typeof idleOptimistic<number>>, action: Parameters<typeof optimisticReducer<number>>[1]) =>
  optimisticReducer(state, action, options);

describe("optimisticReducer (the rules behind useOptimisticValue)", () => {
  it("shows the confirmed value when nothing is held", () => {
    const state = idleOptimistic(30);
    expect(resolveOptimistic(state, 30)).toBe(30);
    expect(resolveOptimistic(state, 45)).toBe(45);
  });

  it("holds a set value over a different confirmed value", () => {
    const state = reduce(idleOptimistic(30), { type: "set", value: 70, at: 1000 });
    expect(state.held).toBe(true);
    expect(resolveOptimistic(state, 30)).toBe(70);
  });

  it("releases when the store confirms the same value", () => {
    let state = reduce(idleOptimistic(30), { type: "set", value: 70, at: 1000 });
    state = reduce(state, { type: "confirm", value: 70, at: 1080 });
    expect(state.held).toBe(false);
    expect(resolveOptimistic(state, 70)).toBe(70);
  });

  it("keeps holding when a different confirmation arrives inside the timeout", () => {
    let state = reduce(idleOptimistic(30), { type: "set", value: 70, at: 1000 });
    state = reduce(state, { type: "confirm", value: 50, at: 1500 }); // the previous throttled command echoing
    expect(state.held).toBe(true);
    expect(resolveOptimistic(state, 50)).toBe(70);
  });

  it("gives way to a different confirmation once 2 s have passed", () => {
    let state = reduce(idleOptimistic(30), { type: "set", value: 70, at: 1000 });
    state = reduce(state, { type: "confirm", value: 50, at: 3000 });
    expect(state.held).toBe(false);
    expect(resolveOptimistic(state, 50)).toBe(50);
  });

  it("expires on the timer only after the timeout", () => {
    let state = reduce(idleOptimistic(30), { type: "set", value: 70, at: 1000 });
    state = reduce(state, { type: "expire", at: 2999 });
    expect(state.held).toBe(true);
    state = reduce(state, { type: "expire", at: 3000 });
    expect(state.held).toBe(false);
  });

  it("a later set restarts the hold", () => {
    let state = reduce(idleOptimistic(30), { type: "set", value: 70, at: 1000 });
    state = reduce(state, { type: "set", value: 80, at: 2900 });
    state = reduce(state, { type: "expire", at: 3000 });
    expect(state.held).toBe(true);
    expect(resolveOptimistic(state, 30)).toBe(80);
  });

  it("ignores confirm and expire while idle", () => {
    const idle = idleOptimistic(30);
    expect(reduce(idle, { type: "confirm", value: 10, at: 5 })).toBe(idle);
    expect(reduce(idle, { type: "expire", at: 5 })).toBe(idle);
  });

  it("uses the supplied equality (whole percents)", () => {
    const close: OptimisticOptions<number> = { equals: (a, b) => Math.abs(a - b) < 1, timeoutMs: 2000 };
    let state = optimisticReducer(idleOptimistic(0), { type: "set", value: 56, at: 0 }, close);
    state = optimisticReducer(state, { type: "confirm", value: 56.13, at: 80 }, close);
    expect(state.held).toBe(false);
  });
});
