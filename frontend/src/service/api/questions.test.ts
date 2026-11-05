import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTeacherQuestion, deleteTeacherQuestion, getTeacherQuestion, listTeacherQuestions, teacherQuestionPayload, updateTeacherQuestion } from "./questions";
import type { QuestionBankInput } from "../../types/question";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const input: Extract<QuestionBankInput, { type: "single_choice" }> = {
  type: "single_choice", lessonId: "geo10-kn-b07", chapter: "ignored", difficulty: "recognition",
  content: "Question", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }],
  correctOptionId: "a", showInLesson: false,
};
const row = { ...input, id: "uuid-1", version: 1, chapterId: "geo10-kn-c03", createdAt: "2026-11-05T00:00:00Z", updatedAt: "2026-11-05T00:00:00Z" };

describe("Teacher Question Bank API", () => {
  beforeEach(() => {
    vi.stubGlobal("document", { cookie: "XSRF-TOKEN=test-token" });
    vi.stubGlobal("window", new EventTarget());
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("sends server filters and reads filtered pagination metadata", async () => {
    const response = { data: [row], links: { first: null, last: null, prev: null, next: null }, meta: { current_page: 2, last_page: 3, per_page: 20, total: 45 } };
    const fetchMock = vi.fn().mockResolvedValue(json(response));
    vi.stubGlobal("fetch", fetchMock);
    await expect(listTeacherQuestions({ page: 2, perPage: 20, q: "river", type: "single_choice", chapterId: "geo10-kn-c03", sort: "lesson" })).resolves.toEqual(response);
    const url = new URL(String(fetchMock.mock.calls[0][0]), "http://local.test");
    expect(url.pathname).toBe("/api/teacher/questions");
    expect(Object.fromEntries(url.searchParams)).toEqual({ page: "2", perPage: "20", q: "river", type: "single_choice", chapterId: "geo10-kn-c03", sort: "lesson" });
    expect(fetchMock.mock.calls[0][1].credentials).toBe("include");
  });

  it("projects only contract fields and keeps lesson IDs as strings", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(json({ data: row }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(createTeacherQuestion(input)).resolves.toEqual(row);
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body).toEqual({ type: "single_choice", lessonId: "geo10-kn-b07", difficulty: "recognition", content: "Question", showInLesson: false, options: input.options, correctOptionId: "a" });
    expect(JSON.stringify(body)).not.toMatch(/teacherId|teacher_id|chapter|version/);
  });

  it("uses the persisted version for PUT and DELETE without local writes", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ data: row }))
      .mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(json({ data: { ...row, version: 2 } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", { getItem: vi.fn(), setItem: vi.fn() });
    await expect(getTeacherQuestion("uuid-1")).resolves.toEqual(row);
    await expect(updateTeacherQuestion("uuid-1", input, 1)).resolves.toMatchObject({ version: 2 });
    await deleteTeacherQuestion("uuid-1", 2);
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).expectedVersion).toBe(1);
    expect(JSON.parse(fetchMock.mock.calls[4][1].body)).toEqual({ expectedVersion: 2 });
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });

  it("preserves essay rubric and true/false statement keys for teacher-only requests", () => {
    expect(teacherQuestionPayload({ type: "essay_text", lessonId: "geo10-kn-b07", difficulty: "recognition", content: "Explain", rubricText: "Criteria" })).toMatchObject({ type: "essay_text", rubricText: "Criteria" });
    expect(teacherQuestionPayload({ type: "true_false_group", lessonId: "geo10-kn-b07", difficulty: "recognition", content: "Judge", statements: [{ id: "a", content: "A", correctAnswer: true }, { id: "b", content: "B", correctAnswer: false }] })).toMatchObject({ statements: [{ id: "a", content: "A", correctAnswer: true }, { id: "b", content: "B", correctAnswer: false }] });
  });

  it.each([401, 403, 404, 409, 422])("propagates HTTP %i without prototype fallback", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ message: "Failed" }, status)));
    vi.stubGlobal("localStorage", { getItem: vi.fn(), setItem: vi.fn() });
    await expect(getTeacherQuestion("uuid-1")).rejects.toMatchObject({ status });
    expect(localStorage.getItem).not.toHaveBeenCalled();
  });

  it("hides a server SQL exception for list and save while preserving validation and conflict errors", async () => {
    const raw = "SQLSTATE[42P01]: relation question_bank_questions does not exist; Connection: pgsql; SQL: select *";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ message: raw }, 500)));
    await expect(listTeacherQuestions()).rejects.toMatchObject({ status: 500, message: "Không thể tải ngân hàng câu hỏi. Vui lòng thử lại." });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(json({ message: raw }, 500)));
    await expect(createTeacherQuestion(input)).rejects.toMatchObject({ status: 500, message: "Không thể lưu câu hỏi. Vui lòng thử lại." });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(json({ message: "Invalid", errors: { lessonId: ["Bài học không hợp lệ."] } }, 422)));
    await expect(createTeacherQuestion(input)).rejects.toMatchObject({ status: 422, errors: { lessonId: ["Bài học không hợp lệ."] } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(json({ message: "Conflict" }, 409)));
    await expect(updateTeacherQuestion("uuid-1", input, 1)).rejects.toMatchObject({ status: 409, message: "Conflict" });
  });
});
