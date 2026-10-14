import { beforeEach, describe, expect, it } from "vitest";
import { useNavStore } from "../../src/state/navStore";

describe("navStore", () => {
  beforeEach(() => useNavStore.setState(useNavStore.getInitialState(), true));

  it("opens on Status", () => {
    expect(useNavStore.getState().page).toBe("status");
  });

  it("setPage switches the page", () => {
    useNavStore.getState().setPage("devices");
    expect(useNavStore.getState().page).toBe("devices");
  });
});
