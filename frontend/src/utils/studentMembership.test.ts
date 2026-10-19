import { describe, expect, it } from "vitest";
import type { StudentClassItem } from "../hooks/useStudentClassMemberships";
import { getActiveStudentClassIds } from "./studentMembership";

function membership(id: string, status: StudentClassItem["status"], archived = false): StudentClassItem {
  return {
    classroom: { id, name: id, code: id, studentCount: 0, completionRate: 0, coverImage: "", status: archived ? "archived" : "active" },
    request: { id, studentId: "student", studentName: "S", email: "s@example.com", studentCode: "1",
      declaredClass: id, requestedAt: "", verificationStatus: "matched", status: "approved" },
    status,
  };
}
describe("active student classes", () => {
  it("handles no profile or membership, multiple classes, removed and archived memberships", () => {
    expect([...getActiveStudentClassIds([])]).toEqual([]);
    expect([...getActiveStudentClassIds([membership("a", "joined"), membership("b", "joined"),
      membership("removed", "needs_link"), membership("old", "joined", true), membership("", "joined")])]).toEqual(["a", "b"]);
  });
});
