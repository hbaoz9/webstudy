import { describe, expect, it } from "vitest";

import { getAssignmentDisplayStatus, getAssignmentResultVisibility } from "./assignmentQuestion";

describe("student assignment listing", () => {
  it("maps draft, active and expired assignments to display statuses", () => {
    const now = Date.parse("2026-10-22T12:00:00Z");
    expect(getAssignmentDisplayStatus({ status: "draft" }, now)).toBe("Bản nháp");
    expect(getAssignmentDisplayStatus({ status: "published", dueAt: "2026-10-23T12:00:00Z" }, now)).toBe("Đang mở");
    expect(getAssignmentDisplayStatus({ status: "published", dueAt: "2026-10-21T12:00:00Z" }, now)).toBe("Đã hết hạn");
  });

  it("uses score visibility for legacy assignments and rejects unknown values", () => {
    expect(getAssignmentResultVisibility({ resultVisibility: undefined } as never)).toBe("score");
    expect(getAssignmentResultVisibility({ resultVisibility: "answers" } as never)).toBe("answers");
    expect(getAssignmentResultVisibility({ resultVisibility: "unexpected" } as never)).toBe("hidden");
  });
});
