// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TeacherJoinRequestsSection } from "./TeacherJoinRequestsSection";

const path = "/api/teacher/classrooms/class-1/join-requests";
const request = { id: "request-1", classroomId: "class-1", studentId: 7, studentName: "Học sinh", email: "student@example.test", studentCode: "HS001", declaredClass: "10A1", requestedAt: "2026-10-30T00:00:00Z", verificationStatus: "matched", status: "pending" };
const page = (data: unknown[], current = 1, last = 1, total = data.length) => ({ data, meta: { current_page: current, last_page: last, total } });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const posts = (mock: ReturnType<typeof vi.fn>, suffix: string) => mock.mock.calls.filter(([url, init]) => url === `${path}/request-1/${suffix}` && init?.method === "POST");

let root: Root;
let host: HTMLDivElement;

function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === label);
  if (!found) throw new Error(`Missing button: ${label}`);
  return found;
}

describe("teacher join request management", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    document.cookie = "XSRF-TOKEN=test-token";
    host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => { root.unmount(); }); host.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks();
  });
  async function render(mock: ReturnType<typeof vi.fn>, archived = false, onMembershipChange = vi.fn(async () => {})) {
    vi.stubGlobal("fetch", mock);
    await act(async () => { root.render(<TeacherJoinRequestsSection classroomId="class-1" archived={archived} onMembershipChange={onMembershipChange} />); });
  }

  it("loads only this classroom, shows backend total, and paginates 20-row API pages", async () => {
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${path}?page=1` && init?.method === "GET") return Promise.resolve(json(page([request], 1, 2, 21)));
      if (url === `${path}?page=2` && init?.method === "GET") return Promise.resolve(json(page([{ ...request, id: "request-21", studentName: "Trang hai", status: "rejected" }], 2, 2, 21)));
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock);
    expect(document.body.textContent).toContain("21 yêu cầu");
    expect(document.body.textContent).toContain("Học sinh");
    expect(document.body.textContent).toContain("30/10/2026");
    expect(document.body.textContent).not.toContain("2026-10-30T00:00:00Z");
    await act(async () => { button("Trang sau").click(); });
    expect(document.body.textContent).toContain("Trang hai");
    expect(document.body.textContent).not.toContain("Học sinhHS001");
    expect(mock.mock.calls.filter(([url]) => url === `${path}?page=2`)).toHaveLength(1);
  });

  it("requires confirmation and sends one approve POST, then refetches requests and membership count", async () => {
    let resolveApprove: (response: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => { resolveApprove = resolve; });
    let approved = false;
    const refreshCount = vi.fn(async () => {});
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${path}?page=1` && init?.method === "GET") return Promise.resolve(json(page([{ ...request, status: approved ? "approved" : "pending" }])));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === `${path}/request-1/approve` && init?.method === "POST") return pending;
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock, false, refreshCount);
    await act(async () => { button("Duyệt").click(); });
    expect(posts(mock, "approve")).toHaveLength(0);
    await act(async () => { button("Hủy").click(); });
    expect(posts(mock, "approve")).toHaveLength(0);
    await act(async () => { button("Duyệt").click(); });
    await act(async () => { const confirm = button("Xác nhận"); confirm.click(); confirm.click(); });
    expect(posts(mock, "approve")).toHaveLength(1);
    expect(button("Đang xử lý…").disabled).toBe(true);
    expect(refreshCount).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("Đã duyệt yêu cầu tham gia.");
    approved = true;
    await act(async () => { resolveApprove(json({ data: { id: "member-1", status: "active" } }, 201)); });
    expect(refreshCount).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("Đã duyệt yêu cầu tham gia.");
    expect(document.body.textContent).toContain("Đã duyệt");
    expect(posts(mock, "approve")).toHaveLength(1);
  });

  it("rejects only after confirmation and never refetches membership count for reject", async () => {
    let rejected = false;
    const refreshCount = vi.fn(async () => {});
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${path}?page=1` && init?.method === "GET") return Promise.resolve(json(page([{ ...request, status: rejected ? "rejected" : "pending" }])));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === `${path}/request-1/reject` && init?.method === "POST") { rejected = true; return Promise.resolve(json({ data: { ...request, status: "rejected" } })); }
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock, false, refreshCount);
    await act(async () => { button("Từ chối").click(); });
    expect(posts(mock, "reject")).toHaveLength(0);
    await act(async () => { button("Xác nhận").click(); });
    expect(posts(mock, "reject")).toHaveLength(1);
    expect(refreshCount).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Đã từ chối yêu cầu tham gia.");
    expect(document.body.textContent).toContain("Đã từ chối");
  });

  it.each(["unverified", "mismatch", "conflict"])("does not directly approve %s but offers manual verification", async (verificationStatus) => {
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${path}?page=1` && init?.method === "GET") return Promise.resolve(json(page([{ ...request, verificationStatus }])));
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock);
    expect(button("Duyệt").disabled).toBe(true);
    expect(document.body.textContent).toContain("Xác minh thủ công");
    expect(posts(mock, "approve")).toHaveLength(0);
  });

  it("shows archived request history without review actions", async () => {
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${path}?page=1` && init?.method === "GET") return Promise.resolve(json(page([{ ...request, status: "rejected" }])));
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock, true);
    expect(document.body.textContent).toContain("chỉ có thể xem");
    expect([...document.querySelectorAll("button")].some((node) => node.textContent?.trim() === "Duyệt")).toBe(false);
    expect(document.body.textContent).not.toContain("Xác minh thủ công");
  });

  it.each([401, 403, 404, 500, "network"])("shows GET %s error and retries", async (failure) => {
    let calls = 0;
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${path}?page=1` && init?.method === "GET") {
        calls += 1;
        return calls === 1 ? failure === "network" ? Promise.reject(new TypeError("offline")) : Promise.resolve(json({ message: "Read failed" }, failure as number)) : Promise.resolve(json(page([request])));
      }
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock);
    expect(document.querySelector('[role="alert"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain("Học sinhHS001");
    await act(async () => { button("Thử lại").click(); });
    expect(document.body.textContent).toContain("Học sinh");
    expect(calls).toBe(2);
  });

  it("keeps request pending when approve fails and allows retry", async () => {
    let attempts = 0;
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${path}?page=1` && init?.method === "GET") return Promise.resolve(json(page([request])));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === `${path}/request-1/approve` && init?.method === "POST") return Promise.resolve(json({ message: `Approve failed ${++attempts}` }, 422));
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock);
    await act(async () => { button("Duyệt").click(); });
    await act(async () => { button("Xác nhận").click(); });
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Approve failed 1");
    expect(document.body.textContent).not.toContain("Đã duyệt yêu cầu tham gia.");
    await act(async () => { button("Xác nhận").click(); });
    expect(posts(mock, "approve")).toHaveLength(2);
  });

  it("loads the full classroom roster, validates fields, confirms explicitly, and sends one manual POST", async () => {
    const roster = { id: "roster-1", orderNumber: 1, fullName: "Học sinh đúng", studentCode: "HS999", linkedUserId: null, status: "not_joined" };
    let resolvePost: (value: Response) => void = () => {};
    const pendingPost = new Promise<Response>((resolve) => { resolvePost = resolve; });
    let approved = false;
    const refreshCount = vi.fn(async () => {});
    const refreshRoster = vi.fn();
    const manualUrl = `${path}/request-1/manual-verify`;
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${path}?page=1`) return Promise.resolve(json(page([{ ...request, status: approved ? "approved" : "pending", verificationStatus: "unverified" }])));
      if (url === "/api/teacher/classrooms/class-1/roster?page=1") return Promise.resolve(json(page([], 1, 2, 101)));
      if (url === "/api/teacher/classrooms/class-1/roster?page=2") return Promise.resolve(json(page([roster], 2, 2, 101)));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === manualUrl && init?.method === "POST") return pendingPost;
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    vi.stubGlobal("fetch", mock);
    await act(async () => { root.render(<TeacherJoinRequestsSection classroomId="class-1" archived={false} onMembershipChange={refreshCount} onRosterChange={refreshRoster} />); });
    await act(async () => { button("Xác minh thủ công").click(); });
    expect(mock.mock.calls.some(([url]) => url === "/api/teacher/classrooms/class-1/roster?page=2")).toBe(true);
    expect(button("Xác nhận và duyệt").disabled).toBe(true);
    await act(async () => { button("Hủy").click(); });
    expect(mock.mock.calls.filter(([url]) => url === manualUrl)).toHaveLength(0);
    await act(async () => { button("Xác minh thủ công").click(); });
    const select = document.querySelector<HTMLSelectElement>("#roster-entry")!;
    const reason = document.querySelector<HTMLSelectElement>("#verification-reason")!;
    const note = document.querySelector<HTMLTextAreaElement>("#verification-note")!;
    await act(async () => {
      select.value = "roster-1"; select.dispatchEvent(new Event("change", { bubbles: true }));
      reason.value = "wrong_student_code"; reason.dispatchEvent(new Event("change", { bubbles: true }));
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setter?.call(note, "Đã đối chiếu trực tiếp"); note.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(button("Xác nhận và duyệt").disabled).toBe(false);
    await act(async () => { button("Xác nhận và duyệt").click(); });
    expect(mock.mock.calls.filter(([url]) => url === manualUrl)).toHaveLength(0);
    await act(async () => { const confirm = button("Đồng ý xác minh và duyệt"); confirm.click(); confirm.click(); });
    expect(mock.mock.calls.filter(([url]) => url === manualUrl)).toHaveLength(1);
    const body = JSON.parse(String(mock.mock.calls.find(([url]) => url === manualUrl)?.[1]?.body));
    expect(body).toEqual({ roster_entry_id: "roster-1", reason: "wrong_student_code", note: "Đã đối chiếu trực tiếp" });
    expect(button("Đang xử lý…").disabled).toBe(true);
    expect(refreshCount).not.toHaveBeenCalled();
    approved = true;
    await act(async () => { resolvePost(json({ data: { id: "membership-1", status: "active" } }, 201)); });
    expect(refreshCount).toHaveBeenCalledTimes(1);
    expect(refreshRoster).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("Đã xác minh và duyệt yêu cầu tham gia.");
    expect(document.querySelector("#manual-verification-title")).toBeNull();
  });

  it("keeps manual modal open on API failure and permits retry without a false success", async () => {
    const roster = { id: "roster-1", orderNumber: 1, fullName: "Học sinh", studentCode: "HS001", linkedUserId: null, status: "not_joined" };
    let attempts = 0;
    const manualUrl = `${path}/request-1/manual-verify`;
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${path}?page=1`) return Promise.resolve(json(page([{ ...request, verificationStatus: "mismatch" }])));
      if (url === "/api/teacher/classrooms/class-1/roster?page=1") return Promise.resolve(json(page([roster])));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === manualUrl && init?.method === "POST") return Promise.resolve(json({ message: `Denied ${++attempts}` }, 422));
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock);
    await act(async () => { button("Xác minh thủ công").click(); });
    const reason = document.querySelector<HTMLSelectElement>("#verification-reason")!;
    const note = document.querySelector<HTMLTextAreaElement>("#verification-note")!;
    await act(async () => {
      reason.value = "wrong_declared_class"; reason.dispatchEvent(new Event("change", { bubbles: true }));
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setter?.call(note, "Đã kiểm tra"); note.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { button("Xác nhận và duyệt").click(); });
    await act(async () => { button("Đồng ý xác minh và duyệt").click(); });
    expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain("Denied 1");
    expect(document.body.textContent).not.toContain("Đã xác minh và duyệt yêu cầu tham gia.");
    await act(async () => { button("Đồng ý xác minh và duyệt").click(); });
    expect(attempts).toBe(2);
  });

  it("retries roster loading before manual verification", async () => {
    let rosterCalls = 0;
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${path}?page=1`) return Promise.resolve(json(page([{ ...request, verificationStatus: "unverified" }])));
      if (url === "/api/teacher/classrooms/class-1/roster?page=1") {
        rosterCalls += 1;
        return Promise.resolve(rosterCalls === 1 ? json({ message: "Roster unavailable" }, 500) : json(page([])));
      }
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock);
    await act(async () => { button("Xác minh thủ công").click(); });
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Roster unavailable");
    await act(async () => { button("Thử lại").click(); });
    expect(rosterCalls).toBe(2);
    expect(document.querySelector("#manual-verification-title")).not.toBeNull();
    expect(button("Xác nhận và duyệt").disabled).toBe(true);
  });
});
