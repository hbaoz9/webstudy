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
vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ session: { name: "Học sinh API" } }),
}));

const classroom = { id: "class-1", name: "10A1 API", code: "ABC234", academicYear: "2026-2027", description: null, coverImage: null, status: "active", createdAt: "2026-10-30T00:00:00Z" };
const membership = { id: "member-1", classroom, status: "active", joinedAt: "2026-10-30T01:00:00Z", leftAt: null };
const request = (status: "pending" | "approved" | "rejected") => ({ id: "request-1", classroomId: classroom.id, studentId: 1, studentName: "Học sinh API", email: "student@example.test", studentCode: "HS001", declaredClass: "10A1", requestedAt: "2026-10-30T00:00:00Z", verificationStatus: "matched", status });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const page = (data: unknown[]) => ({ data, meta: { current_page: 1, last_page: 1, total: data.length } });

let root: Root;
let host: HTMLDivElement;
async function render(key = "initial") {
  await act(async () => { root.render(<MemoryRouter key={key}><StudentDashboardPage /></MemoryRouter>); });
}

describe("student dashboard classroom membership", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => { root.unmount(); }); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks();
  });

  it("shows an empty classroom state rather than a prototype class", async () => {
    localStorage.setItem("webstudy-geo10-teacher-data-v1", JSON.stringify({ name: "Lớp mẫu" }));
    const fetch = vi.fn((url: string) => {
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
});
