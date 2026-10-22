import { describe, expect, it } from "vitest";

import { getComparableClassName, normalizeClassName } from "./classroom";
import { normalizeStudentCode } from "./rosterMatching";

describe("student classroom membership", () => {
  it("normalizes class names before duplicate checks", () => {
    expect(normalizeClassName("  Lớp 10 A 1 ")).toBe("10 A 1");
    expect(getComparableClassName("Lớp 10 A 1")).toBe("10a1");
  });

  it("normalizes roster student codes", () => {
    expect(normalizeStudentCode(" hs 001 ")).toBe("HS001");
  });
});
