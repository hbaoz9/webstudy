// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudentAssessmentsPage from "./StudentAssessmentsPage";
import StudentAssessmentWorkPage from "./StudentAssessmentWorkPage";

let userId = "student-a";
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ session: { userId, role: "student" }, status: "ready" }) }));
const api = vi.hoisted(() => ({
  listStudentDistributions: vi.fn(), listHistoricalDistributions: vi.fn(),
  getStudentDistribution: vi.fn(), getEligibility: vi.fn(), listOwnAttempts: vi.fn(),
  getAttempt: vi.fn(), getStudentResult: vi.fn(), startAttempt: vi.fn(),
  saveAttemptAnswer: vi.fn(), submitAttempt: vi.fn(),
}));
vi.mock("../../service/api/attempts", () => api);

const distribution = { id: "distribution-1", classroomId: "class-1", classroomName: "Lớp 10A",
  title: "Ôn tập địa lí", opensAt: "2026-11-01T00:00:00Z", deadlineAt: "2026-12-01T00:00:00Z",
  status: "active", attemptAvailable: true };
const eligibility = { canStart: true, reasonCode: null, effectiveAttemptLimit: 2, usedAttempts: 0,
  remainingAttempts: 2, effectiveDeadlineAt: distribution.deadlineAt, effectiveRemainingSeconds: 3600,
  serverNow: new Date().toISOString(), canSaveAnswer: false, canSubmit: false };
const attempt = { id: "attempt-1", distributionId: distribution.id, revisionId: "revision-1", attemptNo: 1,
  version: 1, status: "IN_PROGRESS", gradingStatus: "NOT_GRADED", startedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 3600000).toISOString(), finalizedAt: null, finalizationReason: null,
  serverNow: new Date().toISOString(), answers: {}, questions: [{ id: "question-1", position: 1,
    type: "single_choice", maxPoints: "1.000000", content: { content: "Thủ đô Việt Nam?",
      options: [{ id: "a", text: "Hà Nội" }, { id: "b", text: "Huế" }] } }] };

let root: Root;
let host: HTMLDivElement;
async function render(path: string) {
  await act(async () => { root.render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/student/assessments" element={<StudentAssessmentsPage />} />
    <Route path="/student/assessments/:distributionId" element={<StudentAssessmentWorkPage />} />
  </Routes></MemoryRouter>); });
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  userId = "student-a";
  sessionStorage.clear();
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  api.listStudentDistributions.mockResolvedValue({ data: [distribution], meta: { currentPage: 1, total: 1, lastPage: 1 } });
  api.listHistoricalDistributions.mockResolvedValue({ data: [], meta: { currentPage: 1, total: 0, lastPage: 1 } });
  api.getStudentDistribution.mockResolvedValue(distribution);
  api.getEligibility.mockResolvedValue(eligibility);
  api.listOwnAttempts.mockResolvedValue({ data: [] });
  api.getStudentResult.mockResolvedValue({ status: "PENDING_GRADING", scoreVisible: false, answerVisible: false, aggregateScore: null });
  api.getAttempt.mockResolvedValue(attempt);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.clearAllMocks(); });

describe("Student Assessment API integration", () => {
  it("renders only server distributions and historical self access", async () => {
    api.listHistoricalDistributions.mockResolvedValue({ data: [{ ...distribution, id: "old-1", title: "Bài cũ" }] });
    await render("/student/assessments");
    expect(document.body.textContent).toContain("Ôn tập địa lí");
    expect(document.body.textContent).toContain("Bài cũ");
    expect(document.querySelector('a[href="/student/assessments/distribution-1"]')).not.toBeNull();
    expect(api.listStudentDistributions).toHaveBeenCalledWith(1, undefined);
  });

  it("shows server history without a redundant empty card", async () => {
    api.listStudentDistributions.mockResolvedValue({ data: [], meta: { currentPage: 1, total: 0, lastPage: 1 } });
    api.listHistoricalDistributions.mockResolvedValue({ data: [{ ...distribution, id: "old-1", title: "Bài đã làm" }] });
    await render("/student/assessments");
    expect(document.body.textContent).toContain("Bài đã làm");
    expect(document.body.textContent).not.toContain("Hiện chưa có bài mới được giao cho bạn");
  });

  it("shows an in-progress action only from the student's attempt API", async () => {
    api.listOwnAttempts.mockResolvedValue({ data: [attempt] });
    await render("/student/assessments");
    expect(document.body.textContent).toContain("Đang làm");
    expect(document.body.textContent).toContain("Tiếp tục làm");
    expect(api.listOwnAttempts).toHaveBeenCalledWith("distribution-1");
  });

  it("shows result availability only after the result API allows it", async () => {
    api.listOwnAttempts.mockResolvedValue({ data: [{ ...attempt, status: "SUBMITTED" }] });
    api.getStudentResult.mockResolvedValue({ status: "FINAL", scoreVisible: true, answerVisible: false, aggregateScore: "1.000000" });
    await render("/student/assessments");
    expect(document.body.textContent).toContain("Đã có kết quả");
    expect(document.body.textContent).toContain("Xem kết quả");
    expect(document.body.textContent).not.toContain("1.000000");
  });

  it("passes class context to the server without treating it as authorization", async () => {
    await render("/student/assessments?classId=class-1");
    expect(api.listStudentDistributions).toHaveBeenCalledWith(1, "class-1");
    expect(api.listHistoricalDistributions).toHaveBeenCalledWith(1, "class-1");
  });

  it("distinguishes an API failure from an empty list and supports retry", async () => {
    api.listStudentDistributions.mockRejectedValueOnce(new Error("network"));
    await render("/student/assessments");
    expect(document.body.textContent).toContain("Không thể tải bài được giao");
    const retry = [...document.querySelectorAll("button")].find(item => item.textContent === "Thử lại")!;
    await act(async () => { retry.click(); });
    expect(document.body.textContent).toContain("Ôn tập địa lí");
  });

  it("loads an in-progress attempt from the server and keeps answer keys private", async () => {
    api.listOwnAttempts.mockResolvedValue({ data: [attempt] });
    await render("/student/assessments/distribution-1");
    expect(api.getAttempt).toHaveBeenCalledWith("attempt-1");
    expect(document.body.textContent).toContain("Thủ đô Việt Nam?");
    expect(document.body.textContent).toContain("Hà Nội");
    expect(document.body.textContent).not.toContain("correctOptionId");
  });

  it("renders all six published question types without exposing their answer keys", async () => {
    api.listOwnAttempts.mockResolvedValue({ data: [attempt] });
    const questions = [
      attempt.questions[0],
      { id: "multiple", position: 2, type: "multiple_choice", maxPoints: "1.000000", content: { content: "Chọn nhiều", options: [{ id: "x", text: "Đồng bằng" }, { id: "y", text: "Miền núi" }] } },
      { id: "boolean", position: 3, type: "true_false", maxPoints: "1.000000", content: { content: "Đúng hay sai?" } },
      { id: "group", position: 4, type: "true_false_group", maxPoints: "1.000000", content: { content: "Nhận định", statements: [{ id: "s1", content: "Nhận định thứ nhất" }, { id: "s2", content: "Nhận định thứ hai" }] } },
      { id: "number", position: 5, type: "short_answer", maxPoints: "1.000000", content: { content: "Tính số dân" } },
      { id: "essay", position: 6, type: "essay_text", maxPoints: "1.000000", content: { content: "Giải thích hiện tượng" } },
    ];
    api.getAttempt.mockResolvedValue({ ...attempt, questions });
    await render("/student/assessments/distribution-1");
    for (const text of ["Chọn nhiều", "Đúng hay sai?", "Nhận định thứ nhất", "Nhận định thứ hai", "Tính số dân", "Giải thích hiện tượng"])
      expect(document.body.textContent).toContain(text);
    expect(document.querySelectorAll("fieldset")).toHaveLength(6);
    expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
    expect(document.querySelector('input[inputmode="decimal"]')).not.toBeNull();
    expect(document.querySelector("textarea")).not.toBeNull();
    expect(document.body.textContent).not.toContain("correctAnswer");
  });

  it("never starts an attempt without server eligibility", async () => {
    api.getEligibility.mockResolvedValue({ ...eligibility, canStart: false, reasonCode: "release_locked" });
    await render("/student/assessments/distribution-1");
    expect(document.body.textContent).toContain("Chức năng làm bài chưa được mở");
    expect(api.startAttempt).not.toHaveBeenCalled();
  });

  it("keeps a local recovery copy separate from server-confirmed answers", async () => {
    api.listOwnAttempts.mockResolvedValue({ data: [attempt] });
    sessionStorage.setItem("webstudy:attempt-recovery:student-a:attempt-1", JSON.stringify({ "question-1": { optionId: "b" } }));
    await render("/student/assessments/distribution-1");
    expect(document.body.textContent).toContain("Có câu trả lời từ lần mở trước chưa được lưu");
    expect(api.saveAttemptAnswer).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLInputElement>('input[type="radio"][name="question-1"]')?.checked).toBe(false);
  });

  it("does not send an incomplete numeric answer to the server", async () => {
    api.listOwnAttempts.mockResolvedValue({ data: [attempt] });
    api.getAttempt.mockResolvedValue({ ...attempt, questions: [{ id: "question-1", position: 1,
      type: "short_answer", maxPoints: "1.000000", content: { content: "Tính mật độ dân số" } }] });
    await render("/student/assessments/distribution-1");
    const input = document.querySelector<HTMLInputElement>('input[inputmode="decimal"]')!;
    await act(async () => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "1."); input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 450)); });
    expect(api.saveAttemptAnswer).not.toHaveBeenCalled();
  });

  it("autosaves an edited answer with server version and keeps the acknowledged state", async () => {
    api.listOwnAttempts.mockResolvedValue({ data: [attempt] });
    api.saveAttemptAnswer.mockResolvedValue({ saved: true, version: 1, acceptedAt: new Date().toISOString(), serverNow: new Date().toISOString() });
    await render("/student/assessments/distribution-1");
    const option = [...document.querySelectorAll<HTMLInputElement>('input[type="radio"][name="question-1"]')]
      .find(input => input.parentElement?.textContent?.includes("Huế"))!;
    await act(async () => { option.click(); await new Promise(resolve => setTimeout(resolve, 450)); });
    expect(api.saveAttemptAnswer).toHaveBeenCalledTimes(1);
    const [attemptId, questionId, answer, expectedVersion, key] = api.saveAttemptAnswer.mock.calls[0];
    expect([attemptId, questionId, answer, expectedVersion]).toEqual(["attempt-1", "question-1", { optionId: "b" }, 0]);
    expect(typeof key).toBe("string");
    expect(document.body.textContent).toContain("Đã lưu trên máy chủ");
    expect(sessionStorage.getItem("webstudy:attempt-recovery:student-a:attempt-1")).toBeNull();
  });

  it("shows answer keys only after the result API authorizes release", async () => {
    api.listOwnAttempts.mockResolvedValue({ data: [{ ...attempt, status: "SUBMITTED" }] });
    api.getAttempt.mockResolvedValue({ ...attempt, status: "SUBMITTED" });
    const result = { status: "FINAL", scoreVisible: true, aggregateScore: "1.000000",
      answerVisible: false, answers: [{ questionId: "question-1", invalidated: false,
        answerKey: { correctOptionId: "a" }, explanation: "Giải thích riêng" }] };
    api.getStudentResult.mockResolvedValue(result);
    await render("/student/assessments/distribution-1");
    expect(document.body.textContent).toContain("Điểm: 1.000000");
    expect(document.body.textContent).not.toContain("Giải thích riêng");
  });

  it("renders the published answer and explanation after release", async () => {
    api.listOwnAttempts.mockResolvedValue({ data: [{ ...attempt, status: "SUBMITTED" }] });
    api.getAttempt.mockResolvedValue({ ...attempt, status: "SUBMITTED" });
    api.getStudentResult.mockResolvedValue({ status: "FINAL", scoreVisible: true, aggregateScore: "1.000000",
      answerVisible: true, answers: [{ questionId: "question-1", invalidated: false,
        answerKey: { correctOptionId: "a" }, explanation: "Hà Nội là thủ đô." }] });
    await render("/student/assessments/distribution-1");
    expect(document.body.textContent).toContain("Đáp án và lời giải đã công bố");
    expect(document.body.textContent).toContain("Hà Nội là thủ đô.");
  });

  it("lets a student inspect an older own attempt without opening another student's data", async () => {
    const newest = { ...attempt, id: "attempt-2", attemptNo: 2, status: "SUBMITTED", answers: {
      "question-1": { answer: { optionId: "b" }, version: 1, acceptedAt: new Date().toISOString() },
    } };
    const older = { ...attempt, id: "attempt-1", attemptNo: 1, status: "SUBMITTED", answers: {
      "question-1": { answer: { optionId: "a" }, version: 1, acceptedAt: new Date().toISOString() },
    } };
    api.listOwnAttempts.mockResolvedValue({ data: [newest, older] });
    api.getAttempt.mockImplementation(async (id: string) => id === "attempt-2" ? newest : older);
    await render("/student/assessments/distribution-1");
    expect(document.body.textContent).toContain("Bài làm lượt 2");
    await act(async () => { [...document.querySelectorAll("button")].find(button => button.textContent === "Xem lượt 1")?.click(); });
    expect(api.getAttempt).toHaveBeenCalledWith("attempt-1");
    expect(document.body.textContent).toContain("Bài làm lượt 1");
    expect(document.body.textContent).toContain("Bài làm: Hà Nội");
  });

  it("does not show a late attempt response from another account", async () => {
    let finishOld: (value: unknown) => void = () => {};
    api.listOwnAttempts.mockResolvedValueOnce({ data: [attempt] }).mockResolvedValue({ data: [] });
    api.getAttempt.mockImplementationOnce(() => new Promise(done => { finishOld = done; }));
    await render("/student/assessments/distribution-1");
    userId = "student-b";
    await act(async () => { root.render(<MemoryRouter initialEntries={["/student/assessments/distribution-1"]}>
      <Routes><Route path="/student/assessments/:distributionId" element={<StudentAssessmentWorkPage />} /></Routes>
    </MemoryRouter>); });
    await act(async () => { finishOld(attempt); });
    expect(document.body.textContent).not.toContain("Thủ đô Việt Nam?");
  });
});
