import type { StudentClassItem } from "../hooks/useStudentClassMemberships";

export function getActiveStudentClassIds(memberships: readonly StudentClassItem[]): Set<string> {
  return new Set(memberships.filter(({ classroom, status }) =>
    status === "joined" && classroom.status !== "archived" && typeof classroom.id === "string" && classroom.id.length > 0,
  ).map(({ classroom }) => classroom.id));
}
