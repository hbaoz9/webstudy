import { describe, expect, it } from "vitest";

import { buildLessonSavePayload, validateLessonContent } from "./lessonForm";

const lesson = {
  explanation: "  Nội dung bài học  ",
  objectives: [" Mục tiêu ", ""],
  keyPoints: [" Ý chính "],
  sections: [{ title: " Phần 1 ", keyPoints: [" Điểm 1 ", ""], videoUrl: "" }],
};

describe("student lesson data", () => {
  it("requires lesson content before publishing but permits an incomplete draft", () => {
    expect(validateLessonContent({ ...lesson, explanation: "" } as never, "draft")).toBeNull();
    expect(validateLessonContent({ ...lesson, explanation: "" } as never, "published"))
      .toBe("Vui lòng nhập nội dung bài học trước khi đăng.");
  });

  it("cleans list and section fields in the saved payload", () => {
    const payload = buildLessonSavePayload(lesson as never, "published", "2026-10-22T00:00:00Z");
    expect(payload.objectives).toEqual(["Mục tiêu"]);
    expect(payload.keyPoints).toEqual(["Ý chính"]);
    expect(payload.sections?.[0].title).toBe("Phần 1");
    expect(payload.sections?.[0].keyPoints).toEqual(["Điểm 1"]);
  });
});
