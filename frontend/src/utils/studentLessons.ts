import type { AssignmentV2 } from "../types/assignment";
import type { CurriculumLesson, LessonContent } from "../types/curriculum";

export function getPublishedStudentLessons(
  lessons: readonly CurriculumLesson[],
  contents: Readonly<Record<string, LessonContent>>,
) {
  return lessons.filter((lesson) => contents[lesson.id]?.status === "published");
}

export function selectStudentLesson(
  publishedLessons: readonly CurriculumLesson[],
  requestedId: string | null,
) {
  return publishedLessons.find((lesson) => lesson.id === requestedId) ?? publishedLessons[0];
}

export function getVisibleStudentLessonAssignments(
  assignments: readonly AssignmentV2[],
  hasStudentProfile: boolean,
  activeClassIds: ReadonlySet<string>,
  requestedClassId: string | null,
) {
  return assignments.filter((assignment) =>
    hasStudentProfile && assignment.status === "published" &&
    activeClassIds.has(assignment.classroomId) &&
    (requestedClassId === null || assignment.classroomId === requestedClassId));
}
