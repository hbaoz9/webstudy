import { describe, expect, it } from "vitest";
import { getAssignmentBadge, getStudentInitials } from "./studentPresentation";

describe("student presentation", () => {
  it("uses Vietnamese name initials and a safe fallback", () => {
    expect(getStudentInitials("  Đặng Thị Ánh ")).toBe("ĐÁ");
    expect(getStudentInitials("Nguyễn")).toBe("N");
    expect(getStudentInitials("  ")).toBe("HS");
    expect(getStudentInitials("123")).toBe("HS");
    expect(getStudentInitials(undefined)).toBe("HS");
  });
  it("keeps assignment states distinct and readable", () => {
    expect(getAssignmentBadge("submitted")).toEqual({ label: "Đã nộp", tone: "info" });
    expect(getAssignmentBadge("graded")).toEqual({ label: "Đã chấm", tone: "success" });
    expect(getAssignmentBadge("expired")).toEqual({ label: "Hết hạn", tone: "warning" });
    expect(getAssignmentBadge("draft_error").label).toBe("Nháp cần kiểm tra");
  });
});
