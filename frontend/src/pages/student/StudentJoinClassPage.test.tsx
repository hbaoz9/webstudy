// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudentJoinClassPage from "./StudentJoinClassPage";
import { TeacherJoinRequestsSection } from "../../components/teacher/TeacherJoinRequestsSection";

vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ session: { role: "student", userId: "7", name: "Học sinh thật", email: "student@example.test" } }) }));

const classroom = { id: "class-1", name: "10A1", code: "ABC234", academicYear: "2026-2027", description: null, coverImage: null, status: "active", createdAt: "2026-10-30T00:00:00Z" };
const request = { id: "request-1", classroomId: "class-1", studentId: 7, studentName: "Học sinh thật", email: "student@example.test", studentCode: "HS001", declaredClass: "10A1", requestedAt: "2026-10-30T00:00:00Z", verificationStatus: "matched", status: "pending" };
const membership = { id: "member-1", classroom, status: "active", joinedAt: "2026-10-30T01:00:00Z", leftAt: null };
const page = (data: unknown[], lastPage = 1) => ({ data, meta: { current_page: 1, last_page: lastPage, total: data.length } });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const postCalls = (mock: ReturnType<typeof vi.fn>, path: string) => mock.mock.calls.filter(([url, init]) => url === path && init?.method === "POST");

let root: Root;
let host: HTMLDivElement;

function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === label);
  if (!found) throw new Error(`Missing button: ${label}`);
  return found;
}

async function input(label: string, value: string) {
  const field = [...document.querySelectorAll("label")].find((node) => node.textContent?.includes(label))?.querySelector("input");
  if (!field) throw new Error(`Missing input: ${label}`);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => { setter?.call(field, value); field.dispatchEvent(new Event("input", { bubbles: true })); });
}

async function lookup(code = "abc234") {
  await input("Mã lớp do giáo viên", code);
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)); });
}

async function renderStudent() {
  await act(async () => { root.render(<MemoryRouter><StudentJoinClassPage /></MemoryRouter>); });
}

describe("Student join with Laravel API mock", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    document.cookie = "XSRF-TOKEN=test-token";
    host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => { root.unmount(); }); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks();
  });

  it("looks up safely, submits once while pending, and restores pending state after remount", async () => {
    let joinResolve: (response: Response) => void = () => {};
    const pendingJoin = new Promise<Response>((resolve) => { joinResolve = resolve; });
    let requests: typeof request[] = [];
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/student/join-requests?page=1") return Promise.resolve(json(page(requests)));
      if (url === "/api/student/classrooms?page=1") return Promise.resolve(json(page([])));
      if (url === "/api/student/classrooms/lookup/ABC234") return Promise.resolve(json({ data: classroom }));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === "/api/student/join-requests" && init?.method === "POST") return pendingJoin;
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    vi.stubGlobal("fetch", mock);
    await renderStudent();
    await lookup();
    expect(document.body.textContent).toContain("LỚP HỌC ĐƯỢC TÌM THẤY");
    expect(document.body.textContent).not.toContain("học sinh đang tham gia");
    await input("Mã học sinh trong danh sách lớp", "HS001");
    await input("Lớp đang học", "10A1");
    const form = document.querySelector("form")!;
    await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(postCalls(mock, "/api/student/join-requests")).toHaveLength(1);
    expect(JSON.parse(postCalls(mock, "/api/student/join-requests")[0][1].body)).toEqual({ class_code: "ABC234", student_code: "HS001", declared_class: "10A1" });
    expect(button("Đang gửi…").disabled).toBe(true);
    expect(document.body.textContent).not.toContain("Đã tham gia lớp");
    requests = [request];
    await act(async () => { joinResolve(json({ data: request }, 201)); });
    expect(document.body.textContent).toContain("Đang chờ giáo viên duyệt");
    expect(document.body.textContent).not.toContain("Đã tham gia lớp");
    await act(async () => { root.render(<MemoryRouter key="refresh"><StudentJoinClassPage /></MemoryRouter>); });
    expect(document.body.textContent).toContain("Chờ giáo viên duyệt");
    expect(postCalls(mock, "/api/student/join-requests")).toHaveLength(1);
  });

  it("handles missing class and status loading failure with retry", async () => {
    let statusCalls = 0;
    const mock = vi.fn((url: string) => {
      if (url === "/api/student/join-requests?page=1") return Promise.resolve(json(++statusCalls === 1 ? { message: "offline" } : page([]), statusCalls === 1 ? 500 : 200));
      if (url === "/api/student/classrooms?page=1") return Promise.resolve(json(page([])));
      if (url.startsWith("/api/student/classrooms/lookup/")) return Promise.resolve(json({ message: "Missing" }, 404));
      throw new Error(`Unexpected ${url}`);
    });
    vi.stubGlobal("fetch", mock);
    await renderStudent();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("offline");
    await act(async () => { button("Thử lại").click(); });
    await lookup("BADCODE");
    expect(document.body.textContent).toContain("Không tìm thấy lớp đang hoạt động");
    expect(button("Gửi yêu cầu tham gia").disabled).toBe(true);
  });

  it("shows approved request without active membership distinctly and permits rejected resubmission", async () => {
    let latest = { ...request, status: "approved" };
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/student/join-requests?page=1") return Promise.resolve(json(page([latest])));
      if (url === "/api/student/classrooms?page=1") return Promise.resolve(json(page([])));
      if (url === "/api/student/classrooms/lookup/ABC234") return Promise.resolve(json({ data: classroom }));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === "/api/student/join-requests" && init?.method === "POST") { latest = { ...request, id: "request-2" }; return Promise.resolve(json({ data: latest }, 201)); }
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    vi.stubGlobal("fetch", mock);
    await renderStudent(); await lookup();
    expect(document.body.textContent).toContain("không có membership đang hoạt động");
    expect(document.body.textContent).not.toContain("Bạn đã là thành viên của lớp học này.");
    latest = { ...request, status: "rejected" };
    await act(async () => { button("Làm mới trạng thái").click(); });
    expect(document.body.textContent).toContain("Yêu cầu trước đó đã bị từ chối");
    await input("Mã học sinh trong danh sách lớp", "HS001"); await input("Lớp đang học", "10A1");
    await act(async () => { document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(postCalls(mock, "/api/student/join-requests")).toHaveLength(1);
    expect(document.body.textContent).toContain("Đang chờ giáo viên duyệt");
  });

  it("loads later own-request and membership pages before deciding join state", async () => {
    const mock = vi.fn((url: string) => {
      if (url === "/api/student/join-requests?page=1") return Promise.resolve(json(page([], 2)));
      if (url === "/api/student/join-requests?page=2") return Promise.resolve(json(page([{ ...request, status: "approved" }])));
      if (url === "/api/student/classrooms?page=1") return Promise.resolve(json(page([], 2)));
      if (url === "/api/student/classrooms?page=2") return Promise.resolve(json(page([membership])));
      if (url === "/api/student/classrooms/lookup/ABC234") return Promise.resolve(json({ data: classroom }));
      throw new Error(`Unexpected ${url}`);
    });
    vi.stubGlobal("fetch", mock);
    await renderStudent();
    expect(mock.mock.calls.some(([url]) => url === "/api/student/join-requests?page=2")).toBe(true);
    expect(mock.mock.calls.some(([url]) => url === "/api/student/classrooms?page=2")).toBe(true);
    expect(document.body.textContent).toContain("Lớp đang tham gia");
    expect(document.querySelector("form")).toBeNull();
  });

  it.each([401, 403, 422, 500, "network"])("shows POST %s failure without false success", async (failure) => {
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/student/join-requests?page=1" || url === "/api/student/classrooms?page=1") return Promise.resolve(json(page([])));
      if (url === "/api/student/classrooms/lookup/ABC234") return Promise.resolve(json({ data: classroom }));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === "/api/student/join-requests" && init?.method === "POST") return failure === "network" ? Promise.reject(new TypeError("offline")) : Promise.resolve(json({ message: "Join failed", errors: failure === 422 ? { student_code: ["Invalid code"] } : {} }, failure as number));
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    vi.stubGlobal("fetch", mock);
    await renderStudent(); await lookup();
    await input("Mã học sinh trong danh sách lớp", "HS001"); await input("Lớp đang học", "10A1");
    await act(async () => { document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(postCalls(mock, "/api/student/join-requests")).toHaveLength(1);
    expect(document.body.textContent).not.toContain("Đã gửi yêu cầu tham gia 10A1");
    expect(document.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("completes Student → Teacher approve → Student refresh using server responses only", async () => {
    let join: typeof request | null = null;
    let active = false;
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/student/join-requests?page=1") return Promise.resolve(json(page(join ? [join] : [])));
      if (url === "/api/student/classrooms?page=1") return Promise.resolve(json(page(active ? [membership] : [])));
      if (url === "/api/student/classrooms/lookup/ABC234") return Promise.resolve(json({ data: classroom }));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === "/api/student/join-requests" && init?.method === "POST") { join = request; return Promise.resolve(json({ data: join }, 201)); }
      if (url === "/api/teacher/classrooms/class-1/join-requests?page=1") return Promise.resolve(json(page(join ? [join] : [])));
      if (url === "/api/teacher/classrooms/class-1/join-requests/request-1/approve" && init?.method === "POST") { active = true; join = { ...request, status: "approved" }; return Promise.resolve(json({ data: membership }, 201)); }
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    vi.stubGlobal("fetch", mock);
    await renderStudent(); await lookup();
    await input("Mã học sinh trong danh sách lớp", "HS001"); await input("Lớp đang học", "10A1");
    await act(async () => { document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(document.body.textContent).toContain("Chờ giáo viên duyệt");
    expect(active).toBe(false);
    await act(async () => { root.render(<TeacherJoinRequestsSection classroomId="class-1" archived={false} onMembershipChange={async () => {}} />); });
    await act(async () => { button("Duyệt").click(); });
    await act(async () => { button("Xác nhận").click(); });
    expect(postCalls(mock, "/api/teacher/classrooms/class-1/join-requests/request-1/approve")).toHaveLength(1);
    expect(active).toBe(true);
    await act(async () => { root.render(<MemoryRouter><StudentJoinClassPage /></MemoryRouter>); });
    expect(document.body.textContent).toContain("Lớp đang tham gia");
    expect(document.querySelector("form")).toBeNull();
  });

  it("keeps rejected and approved request history distinct from active membership, newest first", async () => {
    const older = { ...request, id: "request-old", status: "rejected", requestedAt: "2026-10-28T00:00:00Z" };
    const newer = { ...request, id: "request-new", status: "approved", requestedAt: "2026-10-30T01:00:00Z" };
    const mock = vi.fn((url: string) => {
      if (url === "/api/student/join-requests?page=1") return Promise.resolve(json(page([older, newer])));
      if (url === "/api/student/classrooms?page=1") return Promise.resolve(json(page([membership])));
      throw new Error(`Unexpected ${url}`);
    });
    vi.stubGlobal("fetch", mock);
    await renderStudent();
    expect(document.body.textContent).toContain("Lớp đang tham gia");
    const history = [...document.querySelectorAll("section[aria-labelledby='join-history-title'] li")];
    expect(history).toHaveLength(2);
    expect(history[0].textContent).toContain("Đã duyệt");
    expect(history[1].textContent).toContain("Bị từ chối");
    expect(history[0].textContent).toContain("30/10/2026");
    expect(document.querySelector("form")).toBeNull();
  });

  it("keeps approved and rejected request history after membership is left", async () => {
    const older = { ...request, id: "request-old", status: "rejected", requestedAt: "2026-10-28T00:00:00Z" };
    const newer = { ...request, id: "request-new", status: "approved", requestedAt: "2026-10-30T01:00:00Z" };
    const mock = vi.fn((url: string) => {
      if (url === "/api/student/join-requests?page=1") return Promise.resolve(json(page([newer, older])));
      if (url === "/api/student/classrooms?page=1") return Promise.resolve(json(page([])));
      throw new Error(`Unexpected ${url}`);
    });
    vi.stubGlobal("fetch", mock);
    await renderStudent();
    const history = [...document.querySelectorAll("section[aria-labelledby='join-history-title'] li")];
    expect(history[0].textContent).toContain("Đã duyệt");
    expect(history[1].textContent).toContain("Bị từ chối");
    expect(document.body.textContent).not.toContain("Lớp đang tham gia");
  });
});
