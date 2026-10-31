// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudentDashboardPage from "./StudentDashboardPage";

vi.mock("../../contexts/StudentAccountContext", () => ({
  useStudentAccount: () => ({ student: { id: "student-1", name: "Tên prototype" }, hasStudentProfile: true }),
}));
vi.mock("../../contexts/TeacherAssignmentsContext", () => ({
  useTeacherAssignments: () => ({ assignments: [], submissions: [], submissionStorageStatus: "saved" }),
}));
let userId = "student-1";
let authRole = "student";
let authStatus = "ready";
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ session: userId ? { userId, role: authRole, name: "Học sinh API" } : null, status: authStatus }),
}));

const classroom = { id: "class-1", name: "10A1 API", code: "ABC234", academicYear: "2026-2027", description: null, coverImage: null, status: "active", createdAt: "2026-10-30T00:00:00Z" };
const membership = { id: "member-1", classroom, status: "active", joinedAt: "2026-10-30T01:00:00Z", leftAt: null };
const request = (status: "pending" | "approved" | "rejected") => ({ id: "request-1", classroomId: classroom.id, studentId: 1, studentName: "Học sinh API", email: "student@example.test", studentCode: "HS001", declaredClass: "10A1", requestedAt: "2026-10-30T00:00:00Z", verificationStatus: "matched", status });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const page = (data: unknown[]) => ({ data, meta: { current_page: 1, last_page: 1, total: data.length } });
const lesson = (id: string, number: number, publishedAt: string | null) => ({
  id, number, title: `Bài API ${number}`, chapterId: "chapter-1", chapterNumber: 1,
  chapterTitle: "Chương API", partId: "part-1", partNumber: 1, partTitle: "Phần API", publishedAt,
});
const lessonUrl = "/api/student/lessons";

let root: Root;
let host: HTMLDivElement;
async function render(key = "initial") {
  await act(async () => { root.render(<MemoryRouter key={key}><StudentDashboardPage /></MemoryRouter>); });
}
const lessonCards = () => [...document.querySelectorAll<HTMLAnchorElement>('a[href^="/student/lessons?lesson="]')];
function stubLessonApi(loadLessons: () => Promise<Response>) {
  const fetch = vi.fn((url: string) => {
    if (url === lessonUrl) return loadLessons();
    if (url === "/api/student/classrooms?page=1") return Promise.resolve(json(page([membership])));
    throw new Error(`Unexpected ${url}`);
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("student dashboard classroom membership", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    userId = "student-1";
    authRole = "student";
    authStatus = "ready";
    localStorage.clear();
    host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => { root.unmount(); }); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks();
  });

  it("shows an empty classroom state rather than a prototype class", async () => {
    localStorage.setItem("webstudy-geo10-teacher-data-v1", JSON.stringify({ name: "Lớp mẫu" }));
    const fetch = vi.fn((url: string) => {
      if (url === lessonUrl) return Promise.resolve(json({ data: [] }));
      if (url === "/api/student/classrooms?page=1" || url === "/api/student/join-requests?page=1") return Promise.resolve(json(page([])));
      throw new Error(`Unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetch);
    await render();
    expect(document.body.textContent).toContain("Bạn chưa tham gia lớp học nào");
    expect(document.body.textContent).toContain("Chào Học sinh API");
    expect(document.body.textContent).not.toContain("Lớp mẫu");
    expect(document.body.textContent).not.toContain("Tên prototype");
  });

  it("keeps the loading state until membership data arrives", async () => {
    let resolveMemberships: (value: Response) => void = () => {};
    const pendingMemberships = new Promise<Response>((resolve) => { resolveMemberships = resolve; });
    const fetch = vi.fn((url: string) => {
      if (url === lessonUrl) return Promise.resolve(json({ data: [] }));
      if (url === "/api/student/classrooms?page=1") return pendingMemberships;
      if (url === "/api/student/join-requests?page=1") return Promise.resolve(json(page([])));
      throw new Error(`Unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetch);
    await render();
    expect(document.querySelector('[role="status"]')?.textContent).toContain("Đang tải lớp học");
    expect(document.body.textContent).not.toContain("Bạn chưa tham gia lớp học nào");
    await act(async () => { resolveMemberships(json(page([membership]))); });
    expect(document.body.textContent).toContain(classroom.name);
  });

  it.each(["pending", "approved", "rejected"] as const)("keeps %s join history separate from active membership", async (status) => {
    const fetch = vi.fn((url: string) => {
      if (url === lessonUrl) return Promise.resolve(json({ data: [] }));
      if (url === "/api/student/classrooms?page=1") return Promise.resolve(json(page([])));
      if (url === "/api/student/join-requests?page=1") return Promise.resolve(json(page([request(status)])));
      throw new Error(`Unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetch);
    await render();
    expect(document.body.textContent).toContain(status === "pending" ? "Đang chờ tham gia lớp" : "Bạn chưa tham gia lớp học nào");
    expect(document.body.textContent).not.toContain(classroom.name);
    expect(document.querySelector(`a[href="/student/classes/${classroom.id}"]`)).toBeNull();
  });

  it("shows only API active memberships and refetches after returning to the dashboard", async () => {
    let active = true;
    const fetch = vi.fn((url: string) => {
      if (url === lessonUrl) return Promise.resolve(json({ data: [] }));
      if (url === "/api/student/classrooms?page=1") return Promise.resolve(json(page(active ? [membership] : [])));
      if (url === "/api/student/join-requests?page=1") return Promise.resolve(json(page([request("approved")])));
      throw new Error(`Unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetch);
    await render();
    expect(document.querySelector(`a[href="/student/classes/${classroom.id}"]`)?.textContent).toContain(classroom.name);
    expect(document.body.textContent).toContain("Bạn đang tham gia 1 lớp");
    expect(document.body.textContent).not.toContain("Tiến độ nộp bài");
    active = false;
    await render("after-leave");
    expect(document.body.textContent).toContain("Bạn chưa tham gia lớp học nào");
    expect(document.body.textContent).not.toContain(classroom.name);
    expect(fetch.mock.calls.filter(([url]) => url === "/api/student/classrooms?page=1")).toHaveLength(2);
  });

  it("shows an API error without inventing membership and retries successfully", async () => {
    let calls = 0;
    const fetch = vi.fn((url: string) => {
      if (url === lessonUrl) return Promise.resolve(json({ data: [] }));
      if (url === "/api/student/classrooms?page=1") return Promise.resolve(++calls === 1 ? json({ message: "offline" }, 500) : json(page([membership])));
      if (url === "/api/student/join-requests?page=1") return Promise.resolve(json(page([])));
      throw new Error(`Unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetch);
    await render();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("offline");
    expect(document.body.textContent).not.toContain(classroom.name);
    await act(async () => { [...document.querySelectorAll("button")].find((button) => button.textContent === "Thử lại")?.click(); });
    expect(document.body.textContent).toContain(classroom.name);
    expect(calls).toBe(2);
  });

  it("loads only API lessons, orders recent publications stably and limits the widget to three cards", async () => {
    localStorage.setItem("webstudy-v1-geo10-lesson-content", JSON.stringify({ "prototype-lesson": { status: "published", updatedAt: "2099-01-01" } }));
    const storageRead = vi.spyOn(Storage.prototype, "getItem");
    const apiLessons = [
      lesson("old", 4, "2026-10-01T00:00:00Z"),
      lesson("tie-b", 2, "2026-10-30T10:00:00Z"),
      lesson("tie-a", 1, "2026-10-30T10:00:00Z"),
      lesson("missing", 5, null),
    ];
    const fetch = stubLessonApi(() => Promise.resolve(json({ data: apiLessons })));
    await render();
    expect(lessonCards().map((card) => card.getAttribute("href"))).toEqual([
      "/student/lessons?lesson=tie-a", "/student/lessons?lesson=tie-b", "/student/lessons?lesson=old",
    ]);
    expect(document.body.textContent).not.toContain("prototype-lesson");
    expect(storageRead).not.toHaveBeenCalledWith("webstudy-v1-geo10-lesson-content");
    expect(fetch.mock.calls.filter(([url]) => url === lessonUrl)).toHaveLength(1);
    expect(fetch.mock.calls.some(([url]) => url.startsWith(`${lessonUrl}/`) || url.includes("/teacher/lessons"))).toBe(false);
    expect(document.body.textContent).toContain("Bạn đang tham gia 1 lớp");
  });

  it("shows widget loading and then an empty state without local lesson fallback", async () => {
    let resolve: (response: Response) => void = () => {};
    const pending = new Promise<Response>((done) => { resolve = done; });
    stubLessonApi(() => pending);
    await render();
    expect(document.querySelector('[aria-labelledby="student-recent-lessons-heading"] [role="status"]')?.textContent).toContain("Đang tải bài học");
    expect(document.body.textContent).toContain("Bạn đang tham gia 1 lớp");
    await act(async () => { resolve(json({ data: [] })); });
    expect(document.body.textContent).toContain("Chưa có bài học được đăng cho lớp của bạn");
    expect(lessonCards()).toHaveLength(0);
  });

  it("shows a lesson API error without hiding classroom data and retries from Backend", async () => {
    let count = 0;
    const fetch = stubLessonApi(() => Promise.resolve(++count === 1
      ? json({ message: "offline" }, 500)
      : json({ data: [lesson("geo10-kn-b07", 7, "2026-10-30T10:00:00Z")] })));
    await render();
    expect(document.querySelector('[aria-labelledby="student-recent-lessons-heading"] [role="alert"]')?.textContent).toContain("Không thể tải bài học");
    expect(document.body.textContent).not.toContain("Chưa có bài học được đăng");
    expect(document.body.textContent).toContain("Bạn đang tham gia 1 lớp");
    await act(async () => { [...document.querySelectorAll("button")].find((button) => button.textContent === "Thử lại bài học")?.click(); });
    expect(lessonCards()).toHaveLength(1);
    expect(fetch.mock.calls.filter(([url]) => url === lessonUrl)).toHaveLength(2);
  });

  it("encodes a string lesson ID in Dashboard navigation", async () => {
    stubLessonApi(() => Promise.resolve(json({ data: [lesson("geo10/kn-b07", 7, null)] })));
    await render();
    expect(lessonCards()[0]?.getAttribute("href")).toBe("/student/lessons?lesson=geo10%2Fkn-b07");
  });

  it("loads the current publication list again when returning to Dashboard", async () => {
    let latest = "first-visit";
    const fetch = stubLessonApi(() => Promise.resolve(json({ data: [lesson(latest, 7, null)] })));
    await render();
    expect(lessonCards()[0]?.getAttribute("href")).toContain("first-visit");
    latest = "second-visit";
    await render("return-visit");
    expect(lessonCards()[0]?.getAttribute("href")).toContain("second-visit");
    expect(document.body.textContent).not.toContain("first-visit");
    expect(fetch.mock.calls.filter(([url]) => url === lessonUrl)).toHaveLength(2);
  });

  it("hides the previous account's cards immediately and ignores its late response", async () => {
    let resolveOld: (response: Response) => void = () => {};
    let resolveNew: (response: Response) => void = () => {};
    const oldPending = new Promise<Response>((done) => { resolveOld = done; });
    const newPending = new Promise<Response>((done) => { resolveNew = done; });
    let count = 0;
    stubLessonApi(() => ++count === 1 ? oldPending : newPending);
    await render();
    userId = "student-2";
    await render();
    expect(lessonCards()).toHaveLength(0);
    await act(async () => { resolveNew(json({ data: [lesson("new-account", 8, null)] })); });
    expect(lessonCards()[0]?.getAttribute("href")).toContain("new-account");
    await act(async () => { resolveOld(json({ data: [lesson("old-account", 9, null)] })); });
    expect(document.body.textContent).not.toContain("Bài API 9");
    expect(lessonCards()).toHaveLength(1);
  });

  it("hides a loaded lesson during account change and does not show it on API failure", async () => {
    let count = 0;
    stubLessonApi(() => Promise.resolve(++count === 1
      ? json({ data: [lesson("private", 7, null)] }) : json({ message: "failed" }, 500)));
    await render();
    expect(lessonCards()).toHaveLength(1);
    userId = "student-2";
    await render();
    expect(lessonCards()).toHaveLength(0);
    expect(document.querySelector('[aria-labelledby="student-recent-lessons-heading"] [role="alert"]')).not.toBeNull();
  });

  it("does not request lessons without an authenticated student and ignores a response after unmount", async () => {
    const fetch = stubLessonApi(() => Promise.resolve(json({ data: [] })));
    userId = "";
    await render();
    expect(fetch.mock.calls.filter(([url]) => url === lessonUrl)).toHaveLength(0);
    expect(lessonCards()).toHaveLength(0);
    userId = "student-1";
    let resolve: (response: Response) => void = () => {};
    const pending = new Promise<Response>((done) => { resolve = done; });
    vi.stubGlobal("fetch", vi.fn((url: string) => url === lessonUrl ? pending
      : url === "/api/student/classrooms?page=1" ? Promise.resolve(json(page([membership]))) : Promise.resolve(json(page([])))));
    await render();
    await act(async () => { root.unmount(); });
    await act(async () => { resolve(json({ data: [lesson("late", 7, null)] })); });
    expect(host.textContent).toBe("");
    root = createRoot(host);
  });
});
