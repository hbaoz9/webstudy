// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeacherAssessmentsPage from "./TeacherAssessmentsPage";
import { createRevision, getAssessment, getRevision, publishRevision, saveDraft } from "../../service/api/assessments";
import { getTeacherQuestion, listTeacherQuestions } from "../../service/api/questions";

vi.mock("../../service/api/assessments", () => ({
  listAssessments: vi.fn(), createAssessment: vi.fn(), getAssessment: vi.fn(), getRevision: vi.fn(),
  saveDraft: vi.fn(), publishRevision: vi.fn(), createRevision: vi.fn(), deleteAssessment: vi.fn(), updateAssessment: vi.fn(),
}));
vi.mock("../../service/api/questions", () => ({ listTeacherQuestions: vi.fn(), getTeacherQuestion: vi.fn() }));

const source = { id: "q", version: 1, content: "Bank question", type: "single_choice" };
const snapshot = { id: "sq", sourceQuestionId: "q", sourceQuestionVersion: 1, position: 1,
  type: "single_choice", publicContent: { content: "Snapshot question", options: [{ id: "a", text: "Choice A" }] }, maxPoints: "1.000000" };
const draft = { id: "r", assessmentId: "a", revisionNo: 1, status: "draft", title: "Exam", instructions: "", version: 1,
  totalPoints: "1.000000", questions: [snapshot] };
const assessment = { id: "a", title: "Exam", version: 1, revisions: [{ id: "r", status: "draft", revisionNo: 1 }] };
let host: HTMLDivElement;
let root: Root;
function button(label: string) { const found = [...host.querySelectorAll("button")].find(b => b.textContent?.trim() === label); if (!found) throw new Error(label); return found; }
async function render() {
  const router = createMemoryRouter([{ path: "/teacher/assessments/:assessmentId", element: <TeacherAssessmentsPage /> }], { initialEntries: ["/teacher/assessments/a"] });
  await act(async () => root.render(<RouterProvider router={router} />));
}

describe("assessment draft UI", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.mocked(getAssessment).mockResolvedValue(assessment as never);
    vi.mocked(getRevision).mockResolvedValue(draft as never);
    vi.mocked(getTeacherQuestion).mockResolvedValue(source as never);
    vi.mocked(listTeacherQuestions).mockResolvedValue({ data: [source], meta: { last_page: 1 } } as never);
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

  it("renders saved snapshot and keeps assignment prototype separate", async () => {
    await render();
    expect(host.textContent).toContain("Snapshot question");
    expect(host.textContent).toContain("Choice A");
    expect(host.textContent).not.toContain("Giao bài cho lớp");
    expect(publishRevision).not.toHaveBeenCalled();
  });

  it.each([
    ["single_choice", { options: [{ id: "option-uuid-1", text: "Phương án một" }, { id: "option-uuid-2", text: "Phương án hai" }] }, "A. Phương án một"],
    ["multiple_choice", { options: [{ id: "option-uuid-1", text: "Phương án một" }, { id: "option-uuid-2", text: "Phương án hai" }] }, "B. Phương án hai"],
    ["true_false", {}, "Snapshot question"],
    ["true_false_group", { statements: [{ id: "statement-uuid-1", content: "Nhận định một" }, { id: "statement-uuid-2", content: "Nhận định hai" }] }, "Ý 1. Nhận định một"],
    ["short_answer", {}, "Snapshot question"],
    ["essay_text", {}, "Snapshot question"],
  ])("renders %s without exposing internal option or statement IDs", async (type, content, expected) => {
    vi.mocked(getRevision).mockResolvedValue({ ...draft, questions: [{ ...snapshot, type, publicContent: { content: "Snapshot question", ...content } }] } as never);
    await render();
    expect(host.textContent).toContain(expected);
    expect(host.textContent).not.toContain("option-uuid");
    expect(host.textContent).not.toContain("statement-uuid");
  });

  it("compacts displayed points while preserving the saved decimal payload", async () => {
    vi.mocked(getRevision).mockResolvedValue({ ...draft, questions: [
      { ...snapshot, id: "s1", maxPoints: "2.500000" },
      { ...snapshot, id: "s2", sourceQuestionId: "q2", position: 2, maxPoints: "1.250000" },
      { ...snapshot, id: "s3", sourceQuestionId: "q3", position: 3, maxPoints: "1.000000" },
    ] } as never);
    vi.mocked(saveDraft).mockRejectedValue(new Error("network"));
    await render();
    expect(host.textContent).toContain("2.5 điểm");
    expect(host.textContent).toContain("1.25 điểm");
    expect(host.textContent).toContain("1 điểm");
    expect(host.textContent).toContain("Tổng điểm nháp: 4.75");
    expect([...host.querySelectorAll('input[aria-label^="Điểm câu"]')].map(input => (input as HTMLInputElement).value)).toEqual(["2.5", "1.25", "1"]);
    await act(async () => { button("Lưu bản nháp").click(); });
    expect(saveDraft).toHaveBeenCalledWith("r", 1, "Exam", "", [
      { revisionQuestionId: "s1", maxPoints: "2.500000" },
      { revisionQuestionId: "s2", maxPoints: "1.250000" },
      { revisionQuestionId: "s3", maxPoints: "1.000000" },
    ]);
  });

  it("keeps reorder and remove actions on accessible icon buttons", async () => {
    vi.mocked(getRevision).mockResolvedValue({ ...draft, questions: [
      snapshot, { ...snapshot, id: "s2", sourceQuestionId: "q2", position: 2, publicContent: { content: "Second question" } },
    ] } as never);
    await render();
    const up = host.querySelector<HTMLButtonElement>('[aria-label="Đưa câu 1 lên"]');
    expect(up?.disabled).toBe(true);
    expect(up?.title).toBe("Đưa câu lên");
    await act(async () => { host.querySelector<HTMLButtonElement>('[aria-label="Đưa câu 1 xuống"]')?.click(); });
    expect(host.querySelector("ol li")?.textContent).toContain("Second question");
    await act(async () => { host.querySelector<HTMLButtonElement>('[aria-label="Bỏ câu 1"]')?.click(); });
    expect(host.querySelectorAll("ol li")).toHaveLength(1);
  });

  it("saves a draft with its server version and shows conflicts", async () => {
    vi.mocked(saveDraft).mockRejectedValue(new Error("conflict"));
    await render();
    await act(async () => { button("Lưu bản nháp").click(); });
    expect(saveDraft).toHaveBeenCalledWith("r", 1, "Exam", "", [{ revisionQuestionId: "sq", maxPoints: "1.000000" }]);
    expect(host.textContent).toContain("Không thể hoàn tất thao tác");
  });

  it("does not publish until confirmation and clones the published revision", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    await render();
    await act(async () => { button("Công bố bản đã lưu").click(); });
    expect(publishRevision).not.toHaveBeenCalled();
    vi.mocked(getRevision).mockResolvedValueOnce({ ...draft, status: "published", publishedAt: "2026-11-05", version: 2 } as never);
    await act(async () => { button("Revision 1 · draft").click(); });
    vi.mocked(createRevision).mockResolvedValue({ ...draft, id: "r2", revisionNo: 2 } as never);
    await act(async () => { button("Tạo bản nháp từ revision này").click(); });
    expect(createRevision).toHaveBeenCalledWith("a", "r");
  });

  it("keeps the publish key when the response fails so retry is idempotent", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.mocked(publishRevision).mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ ...draft, status: "published", version: 2 } as never);
    await render();
    await act(async () => { button("Công bố bản đã lưu").click(); });
    await act(async () => { button("Công bố bản đã lưu").click(); });
    expect(publishRevision).toHaveBeenCalledTimes(2);
    expect(vi.mocked(publishRevision).mock.calls[0][2]).toBe(vi.mocked(publishRevision).mock.calls[1][2]);
  });
});
