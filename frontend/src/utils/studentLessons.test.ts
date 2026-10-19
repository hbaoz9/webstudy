import { describe, expect, it } from "vitest";
import type { AssignmentV2 } from "../types/assignment";
import type { CurriculumLesson, LessonContent } from "../types/curriculum";
import { getPublishedStudentLessons, getVisibleStudentLessonAssignments, selectStudentLesson } from "./studentLessons";

const lessons: CurriculumLesson[] = [
  { id: "first", number: 1, title: "First", chapterId: "chapter" },
  { id: "second", number: 2, title: "Second", chapterId: "chapter" },
];
const contents: Record<string, LessonContent> = {
  first: { lessonId: "first", status: "published", explanation: "First", objectives: [], keyPoints: [], sections: [], updatedAt: "" },
  second: { lessonId: "second", status: "draft", explanation: "Second", objectives: [], keyPoints: [], sections: [], updatedAt: "" },
};
const assignment: AssignmentV2 = {
  id: "a", title: "A", classroomId: "class-a", status: "published", questions: [], createdAt: "", updatedAt: "",
};

describe("student lesson selection", () => {
  it("preserves curriculum order and falls back to the first published lesson", () => {
    const published = getPublishedStudentLessons(lessons, contents);
    expect(published.map((lesson) => lesson.id)).toEqual(["first"]);
    expect(selectStudentLesson(published, "missing")?.id).toBe("first");
    expect(selectStudentLesson(published, "first")?.id).toBe("first");
    expect(selectStudentLesson([], "first")).toBeUndefined();
  });
  it("filters assignment links by active class, publication and requested class", () => {
    const all = [assignment, { ...assignment, id: "draft", status: "draft" as const },
      { ...assignment, id: "other", classroomId: "class-b" }];
    expect(getVisibleStudentLessonAssignments(all, false, new Set(["class-a"]), null)).toEqual([]);
    expect(getVisibleStudentLessonAssignments(all, true, new Set(["class-a"]), null).map((item) => item.id)).toEqual(["a"]);
    expect(getVisibleStudentLessonAssignments(all, true, new Set(["class-a"]), "class-b")).toEqual([]);
  });
});
