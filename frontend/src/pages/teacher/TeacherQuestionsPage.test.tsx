// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeacherQuestionsPage from "./TeacherQuestionsPage";
import { listTeacherQuestions } from "../../service/api/questions";

vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ session: { userId: "teacher-a", role: "teacher" } }) }));
let bankError = "";
vi.mock("../../contexts/TeacherQuestionsContext", () => ({ useTeacherQuestions: () => ({
  bankQuestions: [], ready: true, error: bankError, reload: vi.fn(), revision: 0,
  addQuestion: vi.fn(), deleteQuestion: vi.fn(),
}) }));
vi.mock("../../service/api/questions", () => ({ listTeacherQuestions: vi.fn() }));

const list = vi.mocked(listTeacherQuestions);
const row = { id: "uuid-1", version: 1, type: "single_choice", lessonId: "geo10-kn-b07", chapterId: "geo10-kn-c03", difficulty: "recognition", content: "Question from server", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], correctOptionId: "a", showInLesson: false, createdAt: "2026-11-05T00:00:00Z", updatedAt: "2026-11-05T00:00:00Z" };
const response = (rows: unknown[], currentPage = 1, total = rows.length, lastPage = 1) => ({ data: rows, links: {}, meta: { current_page: currentPage, last_page: lastPage, per_page: 20, total } });
let root: Root;
let host: HTMLDivElement;
async function render(url = "/teacher/questions") {
  await act(async () => { root.render(<MemoryRouter initialEntries={[url]}><TeacherQuestionsPage /></MemoryRouter>); });
}

describe("Teacher Question Bank server list", () => {
  beforeEach(() => {
    vi.clearAllMocks(); bankError = ""; vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    HTMLElement.prototype.scrollIntoView = vi.fn();
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

  it("requests filtered pages from the backend instead of slicing a local first page", async () => {
    list.mockResolvedValueOnce(response([row], 1, 21, 2) as never).mockResolvedValueOnce(response([{ ...row, id: "uuid-2", content: "Second page" }], 2, 21, 2) as never);
    await render("/teacher/questions?type=single_choice");
    expect(list.mock.calls[0][0]).toMatchObject({ page: 1, perPage: 20, type: "single_choice" });
    const next = document.querySelector<HTMLButtonElement>('button[aria-label="Trang câu hỏi sau"]')!;
    await act(async () => { next.click(); });
    expect(list.mock.calls[1][0]).toMatchObject({ page: 2, perPage: 20, type: "single_choice" });
    expect(host.textContent).toContain("Second page");
  });

  it("requests deep server pages with combined lesson, chapter, type, difficulty, search and sort", async () => {
    list.mockResolvedValueOnce(response([{ ...row, id: "uuid-101", content: "Deep server result" }], 6, 121, 7) as never)
      .mockResolvedValueOnce(response([{ ...row, id: "uuid-121", content: "Last server result" }], 7, 121, 7) as never);
    await render("/teacher/questions?page=6&q=river&chapter=geo10-kn-c03&lesson=geo10-kn-b07&type=single_choice&difficulty=recognition&sort=lesson");
    expect(list.mock.calls[0][0]).toMatchObject({ page: 6, perPage: 20, q: "river", chapterId: "geo10-kn-c03", lessonId: "geo10-kn-b07", type: "single_choice", difficulty: "recognition", sort: "lesson" });
    expect(host.textContent).toContain("Deep server result");
    await act(async () => { host.querySelector<HTMLButtonElement>('button[aria-label="Trang câu hỏi sau"]')!.click(); });
    expect(list.mock.calls[1][0]).toMatchObject({ page: 7, q: "river", chapterId: "geo10-kn-c03", lessonId: "geo10-kn-b07" });
    expect(host.textContent).toContain("Last server result");
  });

  it("resets pagination when changing a filter and ignores the older response", async () => {
    let resolveOld!: (value: never) => void;
    list.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce(response([{ ...row, id: "uuid-new", content: "Filtered result" }]) as never);
    await render("/teacher/questions?page=3");
    const filter = host.querySelector<HTMLSelectElement>('select[aria-label="Lọc loại câu hỏi"]')!;
    await act(async () => { filter.value = "true_false"; filter.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(list.mock.calls[1][0]).toMatchObject({ page: 1, type: "true_false" });
    expect(host.textContent).toContain("Filtered result");
    await act(async () => { resolveOld(response([{ ...row, id: "uuid-old", content: "Stale result" }], 3, 60, 3) as never); });
    expect(host.textContent).toContain("Filtered result");
    expect(host.textContent).not.toContain("Stale result");
  });

  it("separates server errors from an empty bank and supports retry", async () => {
    list.mockRejectedValueOnce(new Error("Network unavailable")).mockResolvedValueOnce(response([]) as never);
    await render();
    expect(host.textContent).toContain("Network unavailable");
    const retry = [...host.querySelectorAll("button")].find((button) => button.textContent === "Thử lại")!;
    await act(async () => { retry.click(); });
    expect(list).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain("Ngân hàng câu hỏi đang trống");
  });

  it("shows one safe list error without presenting a failed request as zero questions", async () => {
    bankError = "Không thể tải ngân hàng câu hỏi. Vui lòng thử lại.";
    list.mockRejectedValueOnce(new Error("Không thể tải ngân hàng câu hỏi. Vui lòng thử lại."));
    await render();
    expect(host.querySelectorAll('[role="alert"]')).toHaveLength(1);
    expect(host.textContent).toContain("Không thể tải ngân hàng câu hỏi. Vui lòng thử lại.");
    expect(host.textContent).not.toContain("0 câu phù hợp");
    expect(host.textContent).not.toContain("Hiển thị 0/0 câu");
    expect(host.textContent).not.toMatch(/SQLSTATE|Connection:|select \*/);
  });

  it("shows essay text and keeps it out of the prototype assignment selection", async () => {
    list.mockResolvedValue(response([{ ...row, type: "essay_text", rubricText: "Teacher rubric" }]) as never);
    await render();
    const checkbox = host.querySelector<HTMLInputElement>('input[aria-label^="Chọn câu hỏi:"]')!;
    expect(checkbox.disabled).toBe(true);
    expect(host.textContent).toContain("Tự luận");
  });
});
