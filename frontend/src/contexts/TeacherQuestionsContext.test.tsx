// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TeacherQuestionsProvider, useTeacherQuestions } from "./TeacherQuestionsContext";
import { listTeacherQuestions, createTeacherQuestion } from "../service/api/questions";
import { ApiError } from "../service/api/client";

let teacherId: string | null = "teacher-a";
vi.mock("./AuthContext", () => ({ useAuth: () => ({ session: teacherId ? { userId: teacherId, role: "teacher", teacherVerificationStatus: "verified" } : null }) }));
vi.mock("../service/api/questions", () => ({
  listTeacherQuestions: vi.fn(), createTeacherQuestion: vi.fn(), getTeacherQuestion: vi.fn(),
  updateTeacherQuestion: vi.fn(), deleteTeacherQuestion: vi.fn(),
}));

const list = vi.mocked(listTeacherQuestions);
const create = vi.mocked(createTeacherQuestion);
const row = (id: string, type = "single_choice") => ({ id, type, version: 1, lessonId: "geo10-kn-b07", chapterId: "geo10-kn-c03", difficulty: "recognition", content: id, options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correctOptionId: "a", showInLesson: false, createdAt: "2026-11-05T00:00:00Z", updatedAt: "2026-11-05T00:00:00Z" });
const page = (rows: unknown[], number: number, total: number, lastPage: number) => ({ data: rows, links: {}, meta: { current_page: number, last_page: lastPage, per_page: 100, total } });
let context: ReturnType<typeof useTeacherQuestions>;
let root: Root;
let host: HTMLDivElement;
function Probe() { context = useTeacherQuestions(); return <p>{context.ready ? context.bankQuestions.length : "loading"}</p>; }

async function render() { await act(async () => { root.render(<TeacherQuestionsProvider><Probe /></TeacherQuestionsProvider>); }); }

describe("Teacher Question Bank server context", () => {
  beforeEach(() => {
    teacherId = "teacher-a";
    vi.clearAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

  it("loads every backend page for the assignment prototype, excluding essay", async () => {
    const first = Array.from({ length: 100 }, (_, index) => row(`q-${index}`));
    list.mockResolvedValueOnce(page(first, 1, 101, 2) as never).mockResolvedValueOnce(page([row("essay", "essay_text")], 2, 101, 2) as never);
    await render();
    expect(list).toHaveBeenCalledTimes(2);
    expect(list.mock.calls.map(([filters]) => filters?.page)).toEqual([1, 2]);
    expect(context.bankQuestions).toHaveLength(101);
    expect(context.questions).toHaveLength(100);
    expect(context.ready).toBe(true);
  });

  it("never presents an incomplete page collection as the full bank", async () => {
    list.mockResolvedValueOnce(page([row("one")], 1, 2, 1) as never);
    await render();
    expect(context.ready).toBe(false);
    expect(context.questions).toEqual([]);
    expect(context.error).toMatch(/thay đổi/);
  });

  it("collects more than 100 questions without losing later assignment candidates", async () => {
    const first = Array.from({ length: 100 }, (_, index) => row(`q-${index}`));
    const second = Array.from({ length: 100 }, (_, index) => row(`q-${index + 100}`));
    const third = Array.from({ length: 50 }, (_, index) => row(`q-${index + 200}`));
    list.mockResolvedValueOnce(page(first, 1, 250, 3) as never)
      .mockResolvedValueOnce(page(second, 2, 250, 3) as never)
      .mockResolvedValueOnce(page(third, 3, 250, 3) as never);
    await render();
    expect(list.mock.calls.map(([filters]) => filters)).toEqual([
      { page: 1, perPage: 100 }, { page: 2, perPage: 100 }, { page: 3, perPage: 100 },
    ]);
    expect(context.questions).toHaveLength(250);
    expect(context.questions[249].id).toBe("q-249");
  });

  it("does not publish a partial bank when a later page fails or repeats an ID", async () => {
    list.mockResolvedValueOnce(page(Array.from({ length: 100 }, (_, index) => row(`q-${index}`)), 1, 101, 2) as never)
      .mockRejectedValueOnce(new ApiError("Access denied", 403));
    await render();
    expect(context.ready).toBe(false);
    expect(context.questions).toEqual([]);
    expect(context.error).toBe("Access denied");
    list.mockResolvedValueOnce(page(Array.from({ length: 100 }, (_, index) => row(`q-${index}`)), 1, 101, 2) as never)
      .mockResolvedValueOnce(page([row("q-0")], 2, 101, 2) as never);
    await act(async () => { await context.reload(); });
    expect(context.ready).toBe(false);
    expect(context.questions).toEqual([]);
  });

  it("ignores an older session response after another teacher has loaded", async () => {
    let resolveOld!: (value: never) => void;
    list.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce(page([row("teacher-b-question")], 1, 1, 1) as never);
    await render();
    teacherId = "teacher-b";
    await act(async () => { root.render(<TeacherQuestionsProvider><Probe /></TeacherQuestionsProvider>); });
    expect(context.questions.map((item) => item.id)).toEqual(["teacher-b-question"]);
    await act(async () => { resolveOld(page([row("teacher-a-question")], 1, 1, 1) as never); });
    expect(context.questions.map((item) => item.id)).toEqual(["teacher-b-question"]);
    teacherId = null;
    await act(async () => { root.render(<TeacherQuestionsProvider><Probe /></TeacherQuestionsProvider>); });
    expect(context.questions).toEqual([]);
  });

  it("hides the previous teacher's questions immediately when the session changes", async () => {
    list.mockResolvedValueOnce(page([row("teacher-a-question")], 1, 1, 1) as never);
    let resolveOther!: (value: never) => void;
    list.mockImplementationOnce(() => new Promise((resolve) => { resolveOther = resolve; }));
    await render();
    expect(context.questions).toHaveLength(1);
    teacherId = "teacher-b";
    await act(async () => { root.render(<TeacherQuestionsProvider><Probe /></TeacherQuestionsProvider>); });
    expect(context.questions).toEqual([]);
    await act(async () => { resolveOther(page([row("teacher-b-question")], 1, 1, 1) as never); });
    expect(context.questions.map((item) => item.id)).toEqual(["teacher-b-question"]);
  });

  it("reports partial Word import without replaying successful POSTs", async () => {
    list.mockResolvedValue(page([], 1, 0, 1) as never);
    create.mockResolvedValueOnce(row("saved") as never).mockRejectedValueOnce(new Error("invalid"));
    await render();
    const input = { type: "single_choice" as const, lessonId: "geo10-kn-b07", difficulty: "recognition" as const, content: "Question", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correctOptionId: "a" };
    let result!: Awaited<ReturnType<typeof context.importQuestions>>;
    await act(async () => { result = await context.importQuestions([input, input]); });
    expect(result).toMatchObject({ imported: ["saved"], failedAt: 1 });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("confirms each successful Word POST once before completing the import", async () => {
    list.mockResolvedValue(page([], 1, 0, 1) as never);
    create.mockResolvedValueOnce(row("first") as never).mockResolvedValueOnce(row("second") as never).mockResolvedValueOnce(row("third") as never);
    await render();
    const inputs = ["First", "Second", "Third"].map((content) => ({ type: "true_false" as const, lessonId: "geo10-kn-b07", difficulty: "recognition" as const, content, correctAnswer: true }));
    let result!: Awaited<ReturnType<typeof context.importQuestions>>;
    await act(async () => { result = await context.importQuestions(inputs); });
    expect(result).toMatchObject({ imported: ["first", "second", "third"], failedAt: null });
    expect(create.mock.calls.map(([input]) => input.content)).toEqual(["First", "Second", "Third"]);
  });

  it("stops at a validation error and allows an explicit retry of only unsaved Word rows", async () => {
    list.mockResolvedValue(page([], 1, 0, 1) as never);
    create.mockResolvedValueOnce(row("saved-1") as never)
      .mockRejectedValueOnce(new ApiError("Invalid", 422, { lessonId: ["Invalid lesson"] }))
      .mockResolvedValueOnce(row("saved-2") as never)
      .mockResolvedValueOnce(row("saved-3") as never);
    await render();
    const inputs = ["first", "second", "third"].map((content) => ({ type: "single_choice" as const, lessonId: "geo10-kn-b07", difficulty: "recognition" as const, content, options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correctOptionId: "a" }));
    let first!: Awaited<ReturnType<typeof context.importQuestions>>;
    let retry!: Awaited<ReturnType<typeof context.importQuestions>>;
    await act(async () => { first = await context.importQuestions(inputs); });
    expect(first).toMatchObject({ imported: ["saved-1"], failedAt: 1, uncertain: false });
    expect(create).toHaveBeenCalledTimes(2);
    await act(async () => { retry = await context.importQuestions(inputs.slice(first.imported.length)); });
    expect(retry).toMatchObject({ imported: ["saved-2", "saved-3"], failedAt: null });
    expect(create).toHaveBeenCalledTimes(4);
    expect(create.mock.calls.map(([input]) => input.content)).toEqual(["first", "second", "second", "third"]);
  });

  it("marks a network-interrupted Word POST as uncertain and never auto-retries", async () => {
    list.mockResolvedValue(page([], 1, 0, 1) as never);
    create.mockRejectedValueOnce(new ApiError("Network interrupted"));
    await render();
    const input = { type: "true_false" as const, lessonId: "geo10-kn-b07", difficulty: "recognition" as const, content: "Question", correctAnswer: true };
    let result!: Awaited<ReturnType<typeof context.importQuestions>>;
    await act(async () => { result = await context.importQuestions([input, input]); });
    expect(result).toMatchObject({ imported: [], failedAt: 0, uncertain: true });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it.each([500, 502, 503, 504, 599])("stops an import after HTTP %i and marks the current POST uncertain", async (status) => {
    const persisted: string[] = [];
    list.mockResolvedValue(page([], 1, 0, 1) as never);
    create.mockImplementationOnce(async (input) => {
      persisted.push(input.content);
      return row("confirmed-first") as never;
    }).mockImplementationOnce(async (input) => {
      persisted.push(input.content);
      throw new ApiError("Unable to save", status);
    });
    await render();
    const inputs = ["First", "Committed without response", "Never sent"].map((content) => ({ type: "true_false" as const, lessonId: "geo10-kn-b07", difficulty: "recognition" as const, content, correctAnswer: true }));
    let result!: Awaited<ReturnType<typeof context.importQuestions>>;
    await act(async () => { result = await context.importQuestions(inputs); });
    expect(result).toMatchObject({ imported: ["confirmed-first"], failedAt: 1, uncertain: true });
    expect(persisted).toEqual(["First", "Committed without response"]);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("treats an unexpected transport error without an HTTP response as uncertain", async () => {
    list.mockResolvedValue(page([], 1, 0, 1) as never);
    create.mockRejectedValueOnce(new Error("Connection interrupted"));
    await render();
    const input = { type: "true_false" as const, lessonId: "geo10-kn-b07", difficulty: "recognition" as const, content: "Question", correctAnswer: true };
    let result!: Awaited<ReturnType<typeof context.importQuestions>>;
    await act(async () => { result = await context.importQuestions([input, input]); });
    expect(result).toMatchObject({ imported: [], failedAt: 0, uncertain: true });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403])("stops on HTTP %i without counting the rejected row as saved", async (status) => {
    list.mockResolvedValue(page([], 1, 0, 1) as never);
    create.mockRejectedValueOnce(new ApiError("Not authorized", status));
    await render();
    const input = { type: "true_false" as const, lessonId: "geo10-kn-b07", difficulty: "recognition" as const, content: "Question", correctAnswer: true };
    let result!: Awaited<ReturnType<typeof context.importQuestions>>;
    await act(async () => { result = await context.importQuestions([input, input]); });
    expect(result).toMatchObject({ imported: [], failedAt: 0, uncertain: false });
    expect(create).toHaveBeenCalledTimes(1);
  });
});
