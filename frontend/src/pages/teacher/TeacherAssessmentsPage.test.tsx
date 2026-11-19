// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeacherAssessmentsPage from "./TeacherAssessmentsPage";
import { createAssessment, createRevision, getAssessment, getRevision, listAssessments, publishRevision, saveDraft } from "../../service/api/assessments";
import { getTeacherQuestion, listTeacherQuestions } from "../../service/api/questions";

vi.mock("./TeacherCreateQuestionPage", () => ({ default: ({ onCreated, onDirtyChange }: { onCreated: (question: object) => Promise<void>; onDirtyChange: (dirty: boolean) => void }) =>
  <div><input aria-label="Nội dung câu mới" onChange={event => onDirtyChange(Boolean(event.target.value))} />
    <button type="button" onClick={() => void onCreated({ ...source, id: "inline-q", lessonId: "geo10-kn-b07", difficulty: "recognition" })}>Lưu câu hỏi thử</button></div> }));

vi.mock("../../service/api/assessments", () => ({
  listAssessments: vi.fn(), createAssessment: vi.fn(), getAssessment: vi.fn(), getRevision: vi.fn(),
  saveDraft: vi.fn(), publishRevision: vi.fn(), createRevision: vi.fn(), deleteAssessment: vi.fn(), updateAssessment: vi.fn(),
}));
vi.mock("../../service/api/questions", () => ({ listTeacherQuestions: vi.fn(), getTeacherQuestion: vi.fn() }));
const distributionPanelProps = vi.hoisted(() => vi.fn());
vi.mock("../../components/teacher/DistributionPanel", () => ({ DistributionPanel: (props: object) => {
  distributionPanelProps(props);
  return <section aria-label="Bài đã giao" />;
} }));

const source = { id: "q", version: 1, content: "Bank question", type: "single_choice" };
const snapshot = { id: "sq", sourceQuestionId: "q", sourceQuestionVersion: 1, position: 1,
  type: "single_choice", publicContent: { content: "Snapshot question", options: [{ id: "a", text: "Choice A" }] }, maxPoints: "1.000000" };
const draft = { id: "r", assessmentId: "a", revisionNo: 1, status: "draft", title: "Exam", instructions: "", version: 1,
  totalPoints: "1.000000", questions: [snapshot] };
const manyQuestions = (count: number) => Array.from({ length: count }, (_, index) => ({
  ...snapshot, id: `snapshot-${index + 1}`, sourceQuestionId: `bank-${index + 1}`, position: index + 1,
  publicContent: { content: `Question ${index + 1} unique`, options: [{ id: `option-${index + 1}`, text: `Answer ${index + 1}` }] },
}));
const assessment = { id: "a", title: "Exam", version: 1, revisions: [{ id: "r", status: "draft", revisionNo: 1 }] };
let host: HTMLDivElement;
let root: Root;
function button(label: string) { const found = [...host.querySelectorAll("button")].find(b => b.textContent?.trim() === label); if (!found) throw new Error(label); return found; }
function setInput(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
async function goToStep(step: number) {
  await act(async () => { host.querySelectorAll<HTMLButtonElement>('nav[aria-label="Các bước soạn đề"] button')[step - 1]?.click(); });
}
async function expandQuestion(number: number) {
  await act(async () => { host.querySelector<HTMLButtonElement>(`[aria-label="Câu ${number}: Mở chi tiết"]`)?.click(); });
}
async function render(initialEntry = "/teacher/assessments/a?edit=1") {
  const router = createMemoryRouter([
    { path: "/teacher/assessments", element: <TeacherAssessmentsPage /> },
    { path: "/teacher/assessments/:assessmentId", element: <TeacherAssessmentsPage /> },
  ], { initialEntries: [initialEntry] });
  await act(async () => root.render(<RouterProvider router={router} />));
}

describe("assessment draft UI", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    sessionStorage.clear();
    vi.mocked(getAssessment).mockResolvedValue(assessment as never);
    vi.mocked(getRevision).mockResolvedValue(draft as never);
    vi.mocked(getTeacherQuestion).mockResolvedValue(source as never);
    vi.mocked(listTeacherQuestions).mockResolvedValue({ data: [source], meta: { last_page: 1 } } as never);
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

  it("allocates objective and essay points to ten without changing the published snapshot", async () => {
    vi.mocked(saveDraft).mockRejectedValue(new Error("offline"));
    vi.mocked(getRevision).mockResolvedValue({ ...draft, questions: [snapshot,
      { ...snapshot, id: "essay-snapshot", sourceQuestionId: "essay", position: 2, type: "essay_text",
        publicContent: { content: "Explain" } }] } as never);
    await render();
    await act(async () => { button("6–4").click(); });
    expect([...host.querySelectorAll<HTMLInputElement>('input[aria-label^="Điểm câu"]')].map(input => input.value)).toEqual(["6", "4"]);
    expect(host.textContent).toContain("Tổng điểm nháp: 10");
    await act(async () => { button("Lưu bản nháp").click(); });
    expect(saveDraft).toHaveBeenCalledWith("r", 1, "Exam", "", [
      { revisionQuestionId: "sq", maxPoints: "6.000000" },
      { revisionQuestionId: "essay-snapshot", maxPoints: "4.000000" },
    ]);
  });

  it("shows a published assessment as an overview without draft wizard controls", async () => {
    vi.mocked(getAssessment).mockResolvedValue({ ...assessment, revisions: [{ id: "r", status: "published", revisionNo: 1 }] } as never);
    vi.mocked(getRevision).mockResolvedValue({ ...draft, status: "published", publishedAt: "2026-11-05T00:00:00Z" } as never);
    await render();
    expect(host.textContent).toContain("Đề đã hoàn tất");
    expect(host.querySelector('nav[aria-label="Các bước soạn đề"]')).toBeNull();
    expect(host.querySelector<HTMLInputElement>('#revision-title')).toBeNull();
    expect(host.querySelector('[role="tablist"][aria-label="Chi tiết đề đã hoàn tất"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Tổng quan đề đã hoàn tất"]')).not.toBeNull();
    await act(async () => { button("Nội dung đề").click(); });
    expect(host.querySelector('[aria-label="Xem đề đã hoàn tất"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Tổng quan đề đã hoàn tất"]')).toBeNull();
    await act(async () => { button("Chấm bài").click(); });
    expect(host.querySelector('[aria-label="Chọn đợt giao"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Xem đề đã hoàn tất"]')).toBeNull();
  });

  it("scopes every published tab to the assessment and opens assignment only from its main action", async () => {
    vi.mocked(getAssessment).mockResolvedValue({ ...assessment, revisions: [{ id: "r", status: "published", revisionNo: 1 }] } as never);
    vi.mocked(getRevision).mockResolvedValue({ ...draft, status: "published", publishedAt: "2026-11-05T00:00:00Z" } as never);
    await render();
    expect(distributionPanelProps).toHaveBeenLastCalledWith(expect.objectContaining({ assessmentId: "a", revisionId: "r", showForm: false }));
    await act(async () => { button("Giao bài cho lớp").click(); });
    expect(distributionPanelProps).toHaveBeenLastCalledWith(expect.objectContaining({ assessmentId: "a", revisionId: "r", showForm: true }));
    await act(async () => { button("Giao bài cho lớp").click(); button("Chấm bài").click(); });
    expect(distributionPanelProps).toHaveBeenLastCalledWith(expect.objectContaining({ assessmentId: "a", showForm: false, targetTab: "grading" }));
    await act(async () => { button("Kết quả").click(); });
    expect(distributionPanelProps).toHaveBeenLastCalledWith(expect.objectContaining({ assessmentId: "a", showForm: false, targetTab: "results" }));
  });

  it("opens a saved draft as an overview and enters the wizard only for editing", async () => {
    await render("/teacher/assessments/a");
    expect(host.textContent).toContain("Tổng điểm đã lưu 1");
    expect(host.querySelector('nav[aria-label="Các bước soạn đề"]')).toBeNull();
    await act(async () => { button("Tiếp tục soạn").click(); });
    expect(host.querySelector('nav[aria-label="Các bước soạn đề"]')).not.toBeNull();
  });

  it("blocks a zero-point question before saving a draft", async () => {
    await render();
    const input = host.querySelector<HTMLInputElement>('input[aria-label="Điểm câu 1"]')!;
    await act(async () => setInput(input, "0"));
    await act(async () => { button("Lưu bản nháp").click(); });
    expect(saveDraft).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Điểm mỗi câu phải lớn hơn 0");
  });

  it("renders saved snapshot and keeps assignment prototype separate", async () => {
    await render();
    expect(host.textContent).toContain("Snapshot question");
    expect(host.textContent).not.toContain("Choice A");
    await expandQuestion(1);
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
    await expandQuestion(1);
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
    await goToStep(3);
    await act(async () => { button("Hoàn tất đề").click(); });
    expect(publishRevision).not.toHaveBeenCalled();
    await act(async () => { host.querySelector("details summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    vi.mocked(getRevision).mockResolvedValueOnce({ ...draft, status: "published", publishedAt: "2026-11-05", version: 2 } as never);
    await act(async () => { button("Phiên bản 1 · Bản nháp").click(); });
    vi.mocked(createRevision).mockResolvedValue({ ...draft, id: "r2", revisionNo: 2 } as never);
    await goToStep(1);
    await act(async () => { button("Tạo bản nháp từ đề này").click(); });
    expect(createRevision).toHaveBeenCalledWith("a", "r");
  });

  it("keeps the publish key when the response fails so retry is idempotent", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.mocked(publishRevision).mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ ...draft, status: "published", version: 2 } as never);
    await render();
    await goToStep(3);
    await act(async () => { button("Hoàn tất đề").click(); });
    await act(async () => { button("Hoàn tất đề").click(); });
    expect(publishRevision).toHaveBeenCalledTimes(2);
    expect(vi.mocked(publishRevision).mock.calls[0][2]).toBe(vi.mocked(publishRevision).mock.calls[1][2]);
  });

  it("adds an inline-created Bank question to the draft with one save", async () => {
    vi.mocked(saveDraft).mockResolvedValue({ ...draft, version: 2, questions: [snapshot, { ...snapshot, id: "new-snapshot", sourceQuestionId: "q2" }] } as never);
    await render();
    await act(async () => { button("Tạo câu hỏi mới").click(); });
    await act(async () => { button("Lưu câu hỏi thử").click(); });
    expect(saveDraft).toHaveBeenCalledWith("r", 1, "Exam", "", [
      { revisionQuestionId: "sq", maxPoints: "1.000000" },
      { sourceQuestionId: "inline-q", sourceQuestionVersion: 1, maxPoints: "1.000000" },
    ]);
    expect(host.textContent).toContain("Đã tạo câu hỏi và lưu vào bản nháp");
  });

  it("keeps the created source after a failed Draft save and recovers without creating it again", async () => {
    vi.mocked(saveDraft).mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ ...draft, version: 2, questions: [snapshot, { ...snapshot, id: "new-snapshot", sourceQuestionId: "inline-q" }] } as never);
    await render();
    await act(async () => { button("Tạo câu hỏi mới").click(); });
    await act(async () => { button("Lưu câu hỏi thử").click(); });
    expect(host.textContent).toContain("Không tạo lại câu hỏi này");
    await act(async () => { button("Kiểm tra và thêm lại").click(); });
    expect(saveDraft).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain("Đã thêm câu hỏi vào bản nháp");
  });

  it("recovers a known Bank source after F5 without repeating the POST", async () => {
    vi.mocked(saveDraft).mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ ...draft, version: 2, questions: [snapshot, { ...snapshot, id: "new-snapshot", sourceQuestionId: "inline-q" }] } as never);
    vi.mocked(getTeacherQuestion).mockImplementation(async id => ({ ...source, id }) as never);
    await render();
    await act(async () => { button("Tạo câu hỏi mới").click(); });
    await act(async () => { button("Lưu câu hỏi thử").click(); });
    await act(async () => { root.unmount(); });
    root = createRoot(host);
    await render();
    expect(host.textContent).toContain("Không tạo lại câu hỏi này");
    await act(async () => { button("Kiểm tra và thêm lại").click(); });
    expect(saveDraft).toHaveBeenCalledTimes(2);
    expect(vi.mocked(saveDraft).mock.calls[1][4]).toEqual(expect.arrayContaining([
      { sourceQuestionId: "inline-q", sourceQuestionVersion: 1, maxPoints: "1.000000" },
    ]));
    expect(sessionStorage.getItem("webstudy:assessment-inline:r")).toBeNull();
  });

  it("recognizes a Draft write that committed before its response was lost", async () => {
    vi.mocked(saveDraft).mockRejectedValueOnce(new Error("response lost"));
    await render();
    await act(async () => { button("Tạo câu hỏi mới").click(); });
    await act(async () => { button("Lưu câu hỏi thử").click(); });
    await act(async () => { root.unmount(); });
    root = createRoot(host);
    vi.mocked(getRevision).mockResolvedValue({ ...draft, version: 2, questions: [snapshot, { ...snapshot, id: "persisted", sourceQuestionId: "inline-q" }] } as never);
    await render();
    await act(async () => { button("Kiểm tra và thêm lại").click(); });
    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain("Câu hỏi đã có trong bản nháp");
    expect(sessionStorage.getItem("webstudy:assessment-inline:r")).toBeNull();
  });

  it("shows Distribution as unavailable without sending a request", async () => {
    await render();
    await goToStep(3);
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Giao bài — chưa khả dụng"]')?.disabled).toBe(true);
    expect(publishRevision).not.toHaveBeenCalled();
  });

  it("keeps class context in the back link and blocks leaving an unsaved draft", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    await render("/teacher/assessments/a?classId=class-uuid&edit=1");
    await goToStep(1);
    expect(host.querySelector<HTMLAnchorElement>('a[href="/teacher/assessments?classId=class-uuid"]')).not.toBeNull();
    const input = host.querySelector<HTMLInputElement>("#revision-title")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "Changed draft");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { host.querySelector<HTMLAnchorElement>('a[href="/teacher/assessments?classId=class-uuid"]')?.click(); });
    expect(window.confirm).toHaveBeenCalled();
    expect(host.querySelector<HTMLInputElement>("#revision-title")?.value).toBe("Changed draft");
  });

  it("moves through three steps without saving and preserves unsaved information", async () => {
    await render("/teacher/assessments/a?step=1");
    expect(host.querySelector('nav[aria-label="Các bước soạn đề"] [aria-current="step"]')?.textContent).toContain("Thông tin");
    expect(host.querySelector(".lg\\:grid-cols-2")).not.toBeNull();
    const input = host.querySelector<HTMLInputElement>("#revision-title")!;
    await act(async () => setInput(input, "Tên đề chưa lưu"));
    await act(async () => { button("Tiếp tục").click(); });
    expect(host.textContent).toContain("Câu hỏi trong đề");
    await act(async () => { button("Quay lại").click(); });
    expect(host.querySelector<HTMLInputElement>("#revision-title")?.value).toBe("Tên đề chưa lưu");
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it("keeps the inline editor mounted while reviewing another step", async () => {
    await render();
    await act(async () => { button("Tạo câu hỏi mới").click(); });
    const input = host.querySelector<HTMLInputElement>('[aria-label="Nội dung câu mới"]')!;
    await act(async () => setInput(input, "Câu đang soạn"));
    await goToStep(3);
    expect(host.querySelector<HTMLInputElement>('[aria-label="Nội dung câu mới"]')?.value).toBe("Câu đang soạn");
    await goToStep(2);
    expect(host.querySelector<HTMLElement>('[aria-label="Tạo câu hỏi trong đề"]')?.className).not.toContain("hidden");
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it("searches and pages the server Bank, marking selected questions", async () => {
    vi.mocked(listTeacherQuestions).mockResolvedValue({ data: [{ ...source, id: "bank-q2", content: "Bank question two" }], meta: { last_page: 2 } } as never);
    await render();
    await act(async () => { button("Chọn từ Ngân hàng").click(); });
    expect(host.textContent).toContain("Bank question");
    await act(async () => { button("Thêm câu").click(); });
    expect(host.textContent).toContain("Đã thêm");
    await act(async () => { button("Sau").click(); });
    expect(listTeacherQuestions).toHaveBeenCalledWith(expect.objectContaining({ page: 2, perPage: 20 }));
    const search = host.querySelector<HTMLInputElement>('[aria-label="Tìm câu hỏi trong Ngân hàng"]')!;
    await act(async () => setInput(search, "khí hậu"));
    expect(listTeacherQuestions).toHaveBeenCalledWith(expect.objectContaining({ page: 1, q: "khí hậu" }));
  });

  it("starts a new server-backed draft from the main entry without choosing a class", async () => {
    vi.mocked(listAssessments).mockResolvedValue({ data: [], meta: { lastPage: 1 } } as never);
    vi.mocked(createAssessment).mockResolvedValue({ ...assessment, id: "new-a" } as never);
    await render("/teacher/assessments");
    const input = host.querySelector<HTMLInputElement>("#assessment-new-title")!;
    await act(async () => setInput(input, "Đề mới"));
    await act(async () => { button("Bắt đầu soạn").click(); });
    expect(createAssessment).toHaveBeenCalledWith("Đề mới", "");
    expect(getAssessment).toHaveBeenCalledWith("new-a");
    expect(host.querySelector('nav[aria-label="Các bước soạn đề"] [aria-current="step"]')?.textContent).toContain("Thông tin");
  });

  it("does not guess Draft or Published status from the summary-only list API", async () => {
    vi.mocked(listAssessments).mockResolvedValue({ data: [{ ...assessment, revisions: null }], meta: { lastPage: 1 } } as never);
    await render("/teacher/assessments");
    expect(host.textContent).toContain("Mở để xem bản nháp và các phiên bản");
    expect(host.textContent).not.toContain("Đề đã hoàn tất");
  });

  it("pages 60 questions without rendering all details and moves across a page boundary", async () => {
    vi.mocked(getRevision).mockResolvedValue({ ...draft, questions: manyQuestions(60) } as never);
    vi.mocked(saveDraft).mockRejectedValue(new Error("network"));
    await render();
    expect(host.querySelectorAll('ol[aria-label="Câu hỏi trong đề"] li')).toHaveLength(10);
    expect(host.textContent).not.toContain("Question 59 unique");
    expect(host.textContent).not.toContain("Answer 1");
    await act(async () => { host.querySelector<HTMLButtonElement>('[aria-label="Đưa câu 10 xuống"]')?.click(); });
    expect(host.querySelector('[data-question-number="11"]')?.textContent).toContain("Question 10 unique");
    expect(host.querySelector('[data-question-number="10"]')).toBeNull();
    await act(async () => { button("Lưu bản nháp").click(); });
    const savedQuestions = vi.mocked(saveDraft).mock.calls[0][4];
    expect(savedQuestions[9]).toEqual({ revisionQuestionId: "snapshot-11", maxPoints: "1.000000" });
    expect(savedQuestions[10]).toEqual({ revisionQuestionId: "snapshot-10", maxPoints: "1.000000" });
  });

  it("shows a large draft without waiting for every Bank source check", async () => {
    vi.mocked(getRevision).mockResolvedValue({ ...draft, questions: manyQuestions(60) } as never);
    vi.mocked(getTeacherQuestion).mockImplementation(() => new Promise(() => {}));
    await render();
    expect(host.querySelectorAll('ol[aria-label="Câu hỏi trong đề"] li')).toHaveLength(10);
    expect(host.textContent).not.toContain("Đang tải bộ đề...");
  });

  it("searches the whole draft while preserving absolute position and points", async () => {
    vi.mocked(getRevision).mockResolvedValue({ ...draft, questions: manyQuestions(60) } as never);
    vi.mocked(saveDraft).mockRejectedValue(new Error("network"));
    await render();
    const search = host.querySelector<HTMLInputElement>('[aria-label="Tìm câu hỏi trong đề"]')!;
    await act(async () => setInput(search, "Question 59 unique"));
    expect(host.querySelectorAll('ol[aria-label="Câu hỏi trong đề"] li')).toHaveLength(1);
    expect(host.querySelector('[data-question-number="59"]')?.textContent).toContain("Question 59 unique");
    await act(async () => setInput(host.querySelector<HTMLInputElement>('[aria-label="Điểm câu 59"]')!, "2.5"));
    await act(async () => { button("Lưu bản nháp").click(); });
    expect(vi.mocked(saveDraft).mock.calls[0][4]).toHaveLength(60);
    expect(vi.mocked(saveDraft).mock.calls[0][4][58]).toEqual({ revisionQuestionId: "snapshot-59", maxPoints: "2.5" });
  });

  it("reviews ten collapsed questions per page and expands only the current page", async () => {
    vi.mocked(getRevision).mockResolvedValue({ ...draft, questions: manyQuestions(60) } as never);
    await render();
    await goToStep(3);
    expect(host.querySelectorAll('ol[aria-label="Câu hỏi xem lại"] li')).toHaveLength(10);
    expect(host.textContent).not.toContain("Answer 1");
    await act(async () => { button("Mở tất cả trang này").click(); });
    expect(host.textContent).toContain("Answer 1");
    expect(host.textContent).not.toContain("Answer 11");
    await act(async () => { host.querySelector<HTMLButtonElement>('nav[aria-label="Trang câu hỏi trong đề"] button:last-child')?.click(); });
    expect(host.textContent).toContain("Question 11 unique");
    expect(host.textContent).not.toContain("Answer 11");
    await act(async () => { button("Mở tất cả trang này").click(); });
    expect(host.textContent).toContain("Answer 11");
    await act(async () => { button("Thu gọn trang này").click(); });
    expect(host.textContent).not.toContain("Answer 11");
    await act(async () => setInput(host.querySelector<HTMLInputElement>('[aria-label="Tìm câu hỏi khi xem lại"]')!, "Question 59 unique"));
    expect(host.querySelectorAll('ol[aria-label="Câu hỏi xem lại"] li')).toHaveLength(1);
    expect(host.querySelector('[data-question-number="59"]')?.textContent).toContain("Question 59 unique");
  });

  it("distinguishes saving, saved, unsaved and failed states and reloads server data", async () => {
    let persisted = { ...draft, questions: [snapshot] };
    vi.mocked(getRevision).mockImplementation(async () => persisted as never);
    let finishSave: ((value: typeof draft) => void) | undefined;
    vi.mocked(saveDraft).mockImplementationOnce(() => new Promise(resolve => { finishSave = value => resolve(value as never); }));
    await render();
    expect(host.querySelector('[aria-label="Trạng thái lưu bản nháp"]')?.textContent).toBe("Đã lưu trên máy chủ");
    await act(async () => setInput(host.querySelector<HTMLInputElement>('[aria-label="Điểm câu 1"]')!, "2.5"));
    expect(host.querySelector('[aria-label="Trạng thái lưu bản nháp"]')?.textContent).toBe("Chưa lưu thay đổi");
    await act(async () => { button("Lưu bản nháp").click(); });
    expect(host.querySelector('[aria-label="Trạng thái lưu bản nháp"]')?.textContent).toBe("Đang lưu");
    expect(host.querySelector<HTMLInputElement>('[aria-label="Điểm câu 1"]')?.disabled).toBe(true);
    persisted = { ...draft, version: 2, totalPoints: "2.500000", questions: [{ ...snapshot, maxPoints: "2.500000" }] };
    await act(async () => { finishSave?.(persisted); });
    expect(host.textContent).toContain("Tổng điểm đã lưu 2.5");
    expect(host.textContent).toContain("Tiếp tục soạn");
    await act(async () => { root.unmount(); }); root = createRoot(host);
    await render();
    expect(host.querySelector<HTMLInputElement>('[aria-label="Điểm câu 1"]')?.value).toBe("2.5");
    expect(host.textContent).toContain("Tổng điểm nháp: 2.5");
    await act(async () => setInput(host.querySelector<HTMLInputElement>('[aria-label="Điểm câu 1"]')!, "3"));
    vi.mocked(saveDraft).mockRejectedValueOnce(new Error("network"));
    await act(async () => { button("Lưu bản nháp").click(); });
    expect(host.querySelector('[aria-label="Trạng thái lưu bản nháp"]')?.textContent).toBe("Lưu thất bại");
    expect(host.querySelector<HTMLInputElement>('[aria-label="Điểm câu 1"]')?.value).toBe("3");
    expect(host.textContent).toContain("Không thể hoàn tất thao tác");
    persisted = { ...draft, version: 3, totalPoints: "3.000000", questions: [{ ...snapshot, maxPoints: "3.000000" }] };
    vi.mocked(saveDraft).mockResolvedValueOnce(persisted as never);
    await act(async () => { button("Lưu bản nháp").click(); });
    expect(host.textContent).toContain("Tổng điểm đã lưu 3");
    expect(host.textContent).toContain("Snapshot question · 3 điểm");
  });
});
