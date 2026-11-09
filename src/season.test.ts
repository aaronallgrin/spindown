import { describe, expect, it } from "vitest";
import { seasonOf } from "./season";

describe("seasonOf", () => {
  it("splits the year at meteorological seasons", () => {
    expect(seasonOf(new Date(2026, 11, 1))).toBe("winter");
    expect(seasonOf(new Date(2027, 1, 28))).toBe("winter");
    expect(seasonOf(new Date(2027, 2, 1))).toBe("spring");
    expect(seasonOf(new Date(2027, 5, 1))).toBe("summer");
    expect(seasonOf(new Date(2026, 10, 9))).toBe("fall");
  });
});
