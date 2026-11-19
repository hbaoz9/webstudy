// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TeacherAttemptPanel } from "./TeacherAttemptPanel";
import { ApiError } from "../../service/api/client";
import type { Distribution } from "../../service/api/distributions";

const api = vi.hoisted(() => ({ listTeacherAttempts: vi.fn(), listTeacherResults: vi.fn(), listStudentExceptions: vi.fn(),
  getTeacherAttempt: vi.fn(), getTeacherClassroomRoster: vi.fn(), publishAttemptScores: vi.fn(), gradeEssay: vi.fn() }));
vi.mock("../../service/api/attempts", () => api);
vi.mock("../../service/api/classrooms", () => ({ getTeacherClassroomRoster: api.getTeacherClassroomRoster }));

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  api.listTeacherAttempts.mockResolvedValue({ data: [{ id: "attempt-1", studentId: 12, studentName: "Học sinh A",
    attemptNo: 1, status: "SUBMITTED", gradingStatus: "PENDING_ESSAY" }], meta: { total: 1, lastPage: 1 } });
  api.listStudentExceptions.mockResolvedValue({ data: [] });
  api.listTeacherResults.mockResolvedValue({ data: [
    { studentId: 12, studentName: "Học sinh A", status: "PENDING_GRADING", aggregateScore: null, activeGeneration: 1, calculatedAt: null },
    { studentId: 13, studentName: "Học sinh B", status: "FINAL", aggregateScore: "0.750000", activeGeneration: 1, calculatedAt: null },
  ], meta: { total: 2, lastPage: 1 } });
  api.getTeacherClassroomRoster.mockResolvedValue({ data: [] });
  api.publishAttemptScores.mockResolvedValue({});
  api.gradeEssay.mockResolvedValue({});
  api.getTeacherAttempt.mockResolvedValue({ id: "attempt-1", studentId: 12, studentName: "Học sinh A", attemptNo: 1,
    status: "SUBMITTED", gradingStatus: "PENDING_ESSAY", version: 2, expiresAt: "2026-12-01T00:00:00Z",
    revisionId: "revision-1", answers: { q1: { answer: { text: "Đồng bằng có mật độ dân số cao." } } },
    questions: [{ id: "q1", position: 1, type: "essay_text", maxPoints: "2.000000",
      content: { content: "Giải thích mật độ dân số" } }] });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.clearAllMocks(); });

describe("teacher attempt review", () => {
  it("uses one accessible refresh action, blocks repeated requests and reports failure", async () => {
    await act(async () => root.render(<TeacherAttemptPanel distribution={{ id: "distribution-1", classroomId: "class-1",
      lifecycleStatus: "active" } as Distribution} initialOpen activeSection="grading" />));
    let rejectRefresh!: (reason: Error) => void;
    api.listTeacherAttempts.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRefresh = reject; }));
    const refresh = host.querySelector<HTMLButtonElement>('button[aria-label="Tải lại danh sách lượt làm"]')!;
    expect(refresh.title).toBe("Tải lại danh sách lượt làm");
    await act(async () => { refresh.click(); refresh.click(); });
    expect(refresh.disabled).toBe(true);
    await act(async () => rejectRefresh(new Error("network")));
    expect(refresh.disabled).toBe(false);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Không thể tải lượt làm");
  });

  async function openAttempt() {
    await act(async () => root.render(<TeacherAttemptPanel distribution={{ id: "distribution-1", classroomId: "class-1",
      lifecycleStatus: "active" } as Distribution} />));
    await act(async () => { [...host.querySelectorAll("button")].find(button => button.textContent?.includes("Theo dõi lượt làm"))?.click(); });
    await act(async () => { [...host.querySelectorAll("button")].find(button => button.textContent === "Xem và chấm")?.click(); });
  }

  function enterPoints(value: string) {
    const input = host.querySelector<HTMLInputElement>('input[aria-label="Điểm câu 1"]')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  it("shows a student's essay as readable text for grading", async () => {
    await act(async () => root.render(<TeacherAttemptPanel distribution={{ id: "distribution-1", classroomId: "class-1",
      lifecycleStatus: "active" } as Distribution} />));
    await act(async () => { [...host.querySelectorAll("button")].find(button => button.textContent?.includes("Theo dõi lượt làm"))?.click(); });
    await act(async () => { [...host.querySelectorAll("button")].find(button => button.textContent === "Xem và chấm")?.click(); });
    expect(host.textContent).toContain("Học sinh A");
    expect(host.textContent).toContain("Bài làm: Đồng bằng có mật độ dân số cao.");
    expect(host.textContent).not.toContain('"text":');
  });

  it("keeps a confirmed teacher command distinct from a failed refresh", async () => {
    await act(async () => root.render(<TeacherAttemptPanel distribution={{ id: "distribution-1", classroomId: "class-1",
      lifecycleStatus: "active", scoreReleaseMode: "MANUAL" } as Distribution} />));
    await act(async () => { [...host.querySelectorAll("button")].find(button => button.textContent?.includes("Theo dõi lượt làm"))?.click(); });
    api.listTeacherAttempts.mockRejectedValueOnce(new Error("refresh failed"));
    await act(async () => { [...host.querySelectorAll("button")].find(button => button.textContent === "Kết quả & Công bố")?.click(); });
    await act(async () => { [...host.querySelectorAll("button")].find(button => button.textContent === "Công bố điểm")?.click(); });
    expect(api.publishAttemptScores).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain("Thao tác đã được lưu, nhưng chưa tải lại được dữ liệu");
    expect(host.textContent).toContain("Máy chủ đã xác nhận thao tác");
  });

  it("rejects points above the published maximum without sending a request", async () => {
    await openAttempt();
    await act(async () => enterPoints("5"));
    await act(async () => { [...host.querySelectorAll("button")].find(button => button.textContent === "Lưu điểm")?.click(); });
    expect(api.gradeEssay).not.toHaveBeenCalled();
    expect(host.textContent).toContain("từ 0 đến 2");
  });

  it("normalizes Vietnamese decimal input and confirms the saved score from the server", async () => {
    await openAttempt();
    await act(async () => enterPoints("1,5"));
    await act(async () => { [...host.querySelectorAll("button")].find(button => button.textContent === "Lưu điểm")?.click(); });
    expect(api.gradeEssay).toHaveBeenCalledWith("attempt-1", "q1", "1.500000", 2, "", expect.any(String));
    expect(host.textContent).toContain("Máy chủ đã xác nhận thao tác");
  });

  it("keeps the entered score after a 422 and shows the validation error", async () => {
    api.gradeEssay.mockRejectedValueOnce(new ApiError("invalid", 422, { points: ["Điểm vượt thang điểm của câu."] }));
    await openAttempt();
    await act(async () => enterPoints("1,5"));
    await act(async () => { [...host.querySelectorAll("button")].find(button => button.textContent === "Lưu điểm")?.click(); });
    expect(host.textContent).toContain("Điểm vượt thang điểm của câu.");
    expect(host.querySelector<HTMLInputElement>('input[aria-label="Điểm câu 1"]')?.value).toBe("1,5");
    expect(host.textContent).not.toContain("Máy chủ đã xác nhận thao tác");
  });

  it("saves once and opens the next pending student's attempt", async () => {
    const first = await api.getTeacherAttempt();
    api.listTeacherAttempts.mockResolvedValue({ data: [
      { id: "attempt-1", studentId: 12, studentName: "Học sinh A", attemptNo: 1, status: "SUBMITTED", gradingStatus: "PENDING_ESSAY" },
      { id: "attempt-2", studentId: 13, studentName: "Học sinh B", attemptNo: 1, status: "SUBMITTED", gradingStatus: "PENDING_ESSAY" },
    ], meta: { total: 2, lastPage: 1 }, links: { next: null } });
    api.getTeacherAttempt.mockImplementation(async (id: string) => id === "attempt-2"
      ? { ...first, id, studentId: 13, studentName: "Học sinh B" } : first);
    await openAttempt();
    await act(async () => enterPoints("1,5"));
    await act(async () => { [...host.querySelectorAll("button")].find(button => button.textContent === "Lưu & chấm bài tiếp theo")?.click(); });
    expect(api.gradeEssay).toHaveBeenCalledTimes(1);
    expect(api.getTeacherAttempt).toHaveBeenCalledWith("attempt-2");
    expect(host.querySelector("h5")?.textContent).toContain("Học sinh B");
  });

  it("ignores an older student's detail response after switching students", async () => {
    const template = await api.getTeacherAttempt();
    let resolveOld!: (value: unknown) => void;
    api.listTeacherAttempts.mockResolvedValue({ data: [
      { id: "attempt-1", studentId: 12, studentName: "Học sinh A", attemptNo: 1, status: "SUBMITTED", gradingStatus: "PENDING_ESSAY" },
      { id: "attempt-2", studentId: 13, studentName: "Học sinh B", attemptNo: 1, status: "SUBMITTED", gradingStatus: "PENDING_ESSAY" },
    ], meta: { total: 2, lastPage: 1 }, links: { next: null } });
    api.getTeacherAttempt.mockImplementation((id: string) => id === "attempt-1"
      ? new Promise(resolve => { resolveOld = resolve; })
      : Promise.resolve({ ...template, id, studentName: "Học sinh B" }));
    await act(async () => root.render(<TeacherAttemptPanel distribution={{ id: "distribution-1", classroomId: "class-1",
      lifecycleStatus: "active" } as Distribution} />));
    await act(async () => { [...host.querySelectorAll("button")].find(button => button.textContent?.includes("Theo dõi lượt làm"))?.click(); });
    const buttons = [...host.querySelectorAll("button")].filter(button => button.textContent === "Xem và chấm");
    await act(async () => { buttons[0].click(); });
    await act(async () => { buttons[1].click(); });
    expect(host.querySelector("h5")?.textContent).toContain("Học sinh B");
    await act(async () => resolveOld({ ...template, studentName: "Học sinh A" }));
    expect(host.querySelector("h5")?.textContent).toContain("Học sinh B");
  });

  it("does not send duplicate grade requests on a rapid double click", async () => {
    let resolveGrade!: (value: unknown) => void;
    api.gradeEssay.mockImplementation(() => new Promise(resolve => { resolveGrade = resolve; }));
    await openAttempt();
    await act(async () => enterPoints("1"));
    const save = [...host.querySelectorAll("button")].find(button => button.textContent === "Lưu điểm")!;
    await act(async () => { save.click(); save.click(); });
    expect(api.gradeEssay).toHaveBeenCalledTimes(1);
    await act(async () => resolveGrade({}));
  });

  it("shows automatic score release and never-answer policy without manual publish buttons", async () => {
    await act(async () => root.render(<TeacherAttemptPanel distribution={{ id: "distribution-1", classroomId: "class-1",
      lifecycleStatus: "active", scoreReleaseMode: "AFTER_DISTRIBUTION_ENDED_AND_GRADED", answerReleaseMode: "NEVER" } as Distribution} />));
    await act(async () => { [...host.querySelectorAll("button")].find(button => button.textContent?.includes("Theo dõi lượt làm"))?.click(); });
    await act(async () => { [...host.querySelectorAll("button")].find(button => button.textContent === "Kết quả & Công bố")?.click(); });
    expect(host.textContent).toContain("Tổng điểm tự hiển thị");
    expect(host.textContent).toContain("Đáp án không được công bố");
    expect([...host.querySelectorAll("button")].some(button => button.textContent === "Công bố điểm")).toBe(false);
    expect([...host.querySelectorAll("button")].some(button => button.textContent === "Công bố đáp án")).toBe(false);
  });

  it("loads aggregate results separately and does not present pending scores as final", async () => {
    await act(async () => root.render(<TeacherAttemptPanel distribution={{ id: "distribution-1", classroomId: "class-1",
      lifecycleStatus: "active" } as Distribution} />));
    await act(async () => { [...host.querySelectorAll("button")].find(button => button.textContent?.includes("Theo dõi lượt làm"))?.click(); });
    await act(async () => { [...host.querySelectorAll("button")].find(button => button.textContent === "Kết quả & Công bố")?.click(); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)); });
    expect(api.listTeacherResults).toHaveBeenCalledWith("distribution-1", 1, "", "");
    expect(host.textContent).toContain("Học sinh A");
    expect(host.textContent).toContain("Chưa có điểm chính thức");
    expect(host.textContent).toContain("Học sinh B");
    expect(host.textContent).toContain("0.75");
  });

  it("uses the parent results tab without rendering a second tab bar", async () => {
    await act(async () => root.render(<TeacherAttemptPanel distribution={{ id: "distribution-b", classroomId: "class-b",
      lifecycleStatus: "active" } as Distribution} initialOpen activeSection="results" />));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)); });
    expect(api.listTeacherResults).toHaveBeenCalledWith("distribution-b", 1, "", "");
    expect(host.querySelector('nav[aria-label="Khu vực bài đã giao"]')).toBeNull();
    expect(host.textContent).toContain("Học sinh B");
  });
});
