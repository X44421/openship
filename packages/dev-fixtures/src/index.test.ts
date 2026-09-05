import { describe, expect, it } from "vitest";

import { fixtureId } from "./index";

describe("fixtureId", () => {
  it("is deterministic for identical inputs", () => {
    expect(fixtureId("dataset", 7)).toBe(fixtureId("dataset", 7));
  });

  it("pads sequences to a stable sortable width", () => {
    expect(fixtureId("dataset", 1)).toBe("dataset-0001");
    expect(fixtureId("dataset", 1234)).toBe("dataset-1234");
    expect(fixtureId("row", 12) < fixtureId("row", 345)).toBe(true);
  });
});
