// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudentClassesPage from "./StudentClassesPage";
import StudentClassDetailPage from "./StudentClassDetailPage";

const classroom = { id: "class-1", name: "10A1 API", code: "ABC234", academicYear: "2026-2027", description: "Lớp thật", coverImage: null, status: "active", createdAt: "2026-10-30T00:00:00Z" };
const membership = { id: "member-1", classroom, status: "active", joinedAt: "2026-10-30T01:00:00Z", leftAt: null };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const page = (data: unknown[], current = 1, last = 1, total = data.length) => ({ data, meta: { current_page: current, last_page: last, total } });
let root: Root;
let host: HTMLDivElement;
const button = (label: string) => {
  const found = [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === label);
  if (!found) throw new Error(`Missing button: ${label}`);
  return found;
};

async function render(path = "/student/classes") {
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/student/classes" element={<StudentClassesPage />} />
        <Route path="/student/classes/:classId" element={<StudentClassDetailPage />} />
      </Routes>
    </MemoryRouter>);
  });
}

describe("student classes with Laravel API mock", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    document.cookie = "XSRF-TOKEN=test-token";
    host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => { root.unmount(); }); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks();
  });

  it("shows only active memberships from the API and backend total, then paginates", async () => {
    const mock = vi.fn((url: string) => {
      if (url === "/api/student/classrooms?page=1") return Promise.resolve(json(page([membership], 1, 2, 21)));
      if (url === "/api/student/classrooms?page=2") return Promise.resolve(json(page([{ ...membership, id: "member-2", classroom: { ...classroom, id: "class-2", name: "10A2 API" } }], 2, 2, 21)));
      throw new Error(`Unexpected ${url}`);
    });
    vi.stubGlobal("fetch", mock);
    await render();
    expect(document.body.textContent).toContain("10A1 API");
    expect(document.body.textContent).toContain("21");
    expect(document.body.textContent).not.toContain("Đang xử lý");
    const card = [...document.querySelectorAll("article")].find((item) => item.textContent?.includes("10A1 API"))!;
    const view = [...card.querySelectorAll("a")].find((item) => item.textContent?.includes("Xem lớp học"))!;
    const leave = [...card.querySelectorAll("button")].find((item) => item.textContent?.includes("Rời lớp"))!;
    const badge = [...card.querySelectorAll("span")].find((item) => item.textContent === "Đã tham gia")!;
    expect(view.parentElement).toBe(leave.parentElement);
    expect(badge.parentElement).not.toBe(view.parentElement);
    expect(leave.className).toContain("border-red-200");
    expect(card.querySelector(".h-20")).not.toBeNull();
    await act(async () => { [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === "Trang sau")?.click(); });
    expect(document.body.textContent).toContain("10A2 API");
    expect(document.body.textContent).not.toContain("10A1 API");
    expect(mock.mock.calls.some(([url]) => url === "/api/student/classrooms?page=2")).toBe(true);
  });

  it("refetches on refresh and does not show prototype membership on empty response", async () => {
    let active = true;
    const mock = vi.fn((url: string) => {
      if (url === "/api/student/classrooms?page=1") return Promise.resolve(json(page(active ? [membership] : [])));
      throw new Error(`Unexpected ${url}`);
    });
    vi.stubGlobal("fetch", mock);
    await render();
    expect(document.body.textContent).toContain("10A1 API");
    active = false;
    await act(async () => { root.render(<MemoryRouter key="refresh" initialEntries={["/student/classes"]}><Routes><Route path="/student/classes" element={<StudentClassesPage />} /></Routes></MemoryRouter>); });
    expect(document.body.textContent).toContain("Bạn chưa tham gia lớp học nào");
    expect(document.body.textContent).not.toContain("10A1 API");
    expect(mock.mock.calls.filter(([url]) => url === "/api/student/classrooms?page=1")).toHaveLength(2);
  });

  it("shows API error with retry and never fabricates a membership", async () => {
    let calls = 0;
    const mock = vi.fn((url: string) => {
      if (url === "/api/student/classrooms?page=1") return Promise.resolve(++calls === 1 ? json({ message: "offline" }, 500) : json(page([membership])));
      throw new Error(`Unexpected ${url}`);
    });
    vi.stubGlobal("fetch", mock);
    await render();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("offline");
    expect(document.body.textContent).not.toContain("10A1 API");
    await act(async () => { [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === "Thử lại")?.click(); });
    expect(document.body.textContent).toContain("10A1 API");
    expect(calls).toBe(2);
  });

  it("loads class detail through member-only API without prototype lessons or progress", async () => {
    const mock = vi.fn((url: string) => {
      if (url === "/api/student/classrooms/class-1") return Promise.resolve(json({ data: classroom }));
      throw new Error(`Unexpected ${url}`);
    });
    vi.stubGlobal("fetch", mock);
    await render("/student/classes/class-1");
    expect(document.querySelector("h1")?.textContent).toBe("10A1 API");
    expect(document.body.textContent).toContain("Năm học 2026-2027");
    expect(document.body.textContent).not.toContain("Bài tập của lớp");
  });

  it("does not show class detail when member-only API denies access after leave", async () => {
    const mock = vi.fn((url: string) => {
      if (url === "/api/student/classrooms/class-1") return Promise.resolve(json({ message: "Forbidden" }, 403));
      throw new Error(`Unexpected ${url}`);
    });
    vi.stubGlobal("fetch", mock);
    await render("/student/classes/class-1");
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Forbidden");
    expect(document.querySelector("h1")).toBeNull();
  });

  it("requires confirmation, locks duplicate leave POST, then refetches active memberships", async () => {
    let active = true;
    let resolvePost: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => { resolvePost = resolve; });
    const leaveUrl = "/api/student/memberships/member-1/leave";
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/student/classrooms?page=1") return Promise.resolve(json(page(active ? [membership] : [])));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === leaveUrl && init?.method === "POST") return pending;
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    vi.stubGlobal("fetch", mock);
    await render();
    await act(async () => { button("Rời lớp").click(); });
    expect(mock.mock.calls.filter(([url]) => url === leaveUrl)).toHaveLength(0);
    await act(async () => { button("Hủy").click(); });
    expect(mock.mock.calls.filter(([url]) => url === leaveUrl)).toHaveLength(0);
    await act(async () => { button("Rời lớp").click(); });
    await act(async () => { const confirm = button("Xác nhận rời lớp"); confirm.click(); confirm.click(); });
    expect(mock.mock.calls.filter(([url]) => url === leaveUrl)).toHaveLength(1);
    expect(button("Đang xử lý…").disabled).toBe(true);
    expect(button("Hủy").disabled).toBe(true);
    expect(document.body.textContent).toContain("10A1 API");
    active = false;
    await act(async () => { resolvePost(json({ data: { ...membership, status: "left" } })); });
    expect(document.body.textContent).toContain("Bạn chưa tham gia lớp học nào");
    expect(document.body.textContent).not.toContain("Xem lớp học");
    await act(async () => { root.render(<MemoryRouter key="refresh" initialEntries={["/student/classes"]}><Routes><Route path="/student/classes" element={<StudentClassesPage />} /></Routes></MemoryRouter>); });
    expect(document.body.textContent).toContain("Bạn chưa tham gia lớp học nào");
    expect(mock.mock.calls.filter(([url]) => url === leaveUrl)).toHaveLength(1);
  });

  it("keeps active membership visible on leave error and allows retry", async () => {
    let attempts = 0;
    const leaveUrl = "/api/student/memberships/member-1/leave";
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/student/classrooms?page=1") return Promise.resolve(json(page([membership])));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === leaveUrl && init?.method === "POST") return Promise.resolve(json({ message: `Leave failed ${++attempts}` }, 422));
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    vi.stubGlobal("fetch", mock);
    await render();
    await act(async () => { button("Rời lớp").click(); });
    await act(async () => { button("Xác nhận rời lớp").click(); });
    expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain("Leave failed 1");
    expect(document.body.textContent).toContain("10A1 API");
    expect(document.body.textContent).not.toContain("Đã rời lớp 10A1 API.");
    await act(async () => { button("Xác nhận rời lớp").click(); });
    expect(attempts).toBe(2);
  });
});
