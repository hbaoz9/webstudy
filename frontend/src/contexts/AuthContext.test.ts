import { describe, expect, it } from "vitest";
import { authHomePath, type AuthSession } from "./AuthContext";

const session = (role: AuthSession["role"], teacherVerificationStatus: AuthSession["teacherVerificationStatus"]): AuthSession => ({
  role,
  teacherVerificationStatus,
  userId: "1",
  name: "Test",
  email: "test@example.com",
});

describe("auth landing path", () => {
  it("sends students to their dashboard", () => {
    expect(authHomePath(session("student", null))).toBe("/student/dashboard");
  });

  it.each(["unverified", "pending", "rejected"] as const)("sends %s teachers to verification", (status) => {
    expect(authHomePath(session("teacher", status))).toBe("/teacher/verification");
  });

  it("sends verified teachers to their dashboard", () => {
    expect(authHomePath(session("teacher", "verified"))).toBe("/teacher/dashboard");
  });

  it("sends admins to the verification queue", () => {
    expect(authHomePath(session("admin", null))).toBe("/admin/teacher-verifications");
  });
});
