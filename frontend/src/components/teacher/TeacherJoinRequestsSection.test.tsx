// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TeacherJoinRequestsSection } from "./TeacherJoinRequestsSection";

const path = "/api/teacher/classrooms/class-1/join-requests";
const request = { id: "request-1", classroomId: "class-1", studentId: 7, studentName: "Học sinh", email: "student@example.test", studentCode: "HS001", declaredClass: "10A1", requestedAt: "2026-10-30T00:00:00Z", verificationStatus: "matched", status: "pending" };
const page = (data: unknown[], current = 1, last = 1, total = data.length, pending = total, processed = 0) => ({
  data, meta: { current_page: current, last_page: last, total },
  links: { first: null, last: null, prev: null, next: null },
  statusCounts: { pending, approved: processed, rejected: 0, processed, total: pending + processed },
});
const previewEntry = (id: string) => ({ requestId: id, studentName: `Tài khoản ${id}`, studentEmail: `${id}@example.test`, submittedStudentCode: `HS-${id}`, rosterEntryId: `roster-${id}`, rosterStudentName: `Học sinh ${id}`, rosterStudentCode: `HS-${id}` });
const bulkPreview = (data: unknown[], current = 1, last = 1, eligibleTotal = data.length) => ({
  data, summary: { eligibleTotal, requiresIndividualReviewTotal: 2, pendingTotal: eligibleTotal + 2 },
  meta: { currentPage: current, lastPage: last, perPage: 100, hasMore: current < last },
});
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
  async function render(mock: ReturnType<typeof vi.fn>, archived = false, onMembershipChange = vi.fn(async () => {}), onRosterChange?: () => void) {
    vi.stubGlobal("fetch", mock);
    await act(async () => { root.render(<TeacherJoinRequestsSection classroomId="class-1" archived={archived} onMembershipChange={onMembershipChange} onRosterChange={onRosterChange} />); });
  }

  it("loads only this classroom, shows backend total, and paginates 20-row API pages", async () => {
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${path}?page=1&status=pending` && init?.method === "GET") return Promise.resolve(json(page([request], 1, 2, 21, 21, 9)));
      if (url === `${path}?page=2&status=pending` && init?.method === "GET") return Promise.resolve(json(page([{ ...request, id: "request-21", studentName: "Trang hai" }], 2, 2, 21, 21, 9)));
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock);
    expect(document.body.textContent).toContain("21 yêu cầu");
    expect(button("Chờ xử lý (21)").getAttribute("aria-selected")).toBe("true");
    expect(button("Đã xử lý (9)").getAttribute("aria-selected")).toBe("false");
    expect(document.body.textContent).toContain("Học sinh");
    expect(document.body.textContent).toContain("30/10/2026");
    expect(document.body.textContent).not.toContain("2026-10-30T00:00:00Z");
    await act(async () => { button("Trang sau").click(); });
    expect(document.body.textContent).toContain("Trang hai");
    expect(document.body.textContent).not.toContain("Học sinhHS001");
    expect(mock.mock.calls.filter(([url]) => url === `${path}?page=2&status=pending`)).toHaveLength(1);
  });

  it("switches to the compact processed queue and keeps server counts independent of page total", async () => {
    const processed = [
      { ...request, id: "approved", status: "approved", studentName: "Học sinh A", declaredClass: "10A1" },
      { ...request, id: "rejected", status: "rejected", studentName: "Học sinh B", studentCode: null, declaredClass: null },
    ];
    const mock = vi.fn((url: string) => {
      if (url === `${path}?page=1&status=pending`) return Promise.resolve(json(page([request], 1, 1, 1, 1, 42)));
      if (url === `${path}?page=1&status=processed`) return Promise.resolve(json(page(processed, 1, 3, 42, 1, 42)));
      if (url === `${path}?page=2&status=processed`) return Promise.resolve(json(page([{ ...processed[1], id: "older", studentName: "Trang hai" }], 2, 3, 42, 1, 42)));
      throw new Error(`Unexpected ${url}`);
    });
    await render(mock);
    expect(button("Đã xử lý (42)")).toBeTruthy();
    await act(async () => { button("Đã xử lý (42)").click(); });
    expect(document.body.textContent).toContain("42 yêu cầu đã xử lý");
    expect(document.querySelectorAll("li details")).toHaveLength(2);
    expect(document.body.textContent).not.toContain("Xác minh thủ công");
    expect([...document.querySelectorAll("button")].some((node) => node.textContent?.trim() === "Duyệt")).toBe(false);
    expect((document.querySelector("li details") as HTMLDetailsElement).open).toBe(false);
    await act(async () => { (document.querySelector("li summary") as HTMLElement).click(); });
    expect((document.querySelector("li details") as HTMLDetailsElement).open).toBe(true);
    expect(document.querySelector("li details")?.textContent).toContain("Lớp khai báo: 10A1");
    expect(document.querySelectorAll("li details")[1].textContent).not.toContain("Lớp khai báo:");
    await act(async () => { button("Trang sau").click(); });
    expect(document.body.textContent).toContain("Trang hai");
    expect(mock.mock.calls.some(([url]) => url === `${path}?page=2&status=processed`)).toBe(true);
    await act(async () => { button("Chờ xử lý (1)").click(); });
    expect(button("Chờ xử lý (1)").getAttribute("aria-selected")).toBe("true");
    expect(mock.mock.calls.filter(([url]) => url === `${path}?page=1&status=pending`)).toHaveLength(2);
  });

  it("shows nullable student data neutrally in the pending card", async () => {
    const mock = vi.fn((url: string) => {
      if (url === `${path}?page=1&status=pending`) return Promise.resolve(json(page([{ ...request, studentCode: null, declaredClass: null, verificationStatus: "unverified" }])));
      throw new Error(`Unexpected ${url}`);
    });
    await render(mock);
    expect(document.body.textContent).toContain("Chưa cung cấp mã học sinh");
    expect(document.body.textContent).not.toContain("Lớp khai báo:");
    expect(button("Duyệt").disabled).toBe(true);
  });

  it("prevents repeated icon refresh requests while the queue is loading", async () => {
    let calls = 0;
    let resolveRefresh: (response: Response) => void = () => {};
    const mock = vi.fn((url: string) => {
      if (url === `${path}?page=1&status=pending`) {
        calls += 1;
        return calls === 1 ? Promise.resolve(json(page([request]))) : new Promise<Response>((resolve) => { resolveRefresh = resolve; });
      }
      throw new Error(`Unexpected ${url}`);
    });
    await render(mock);
    const refresh = document.querySelector('button[aria-label="Làm mới yêu cầu"]') as HTMLButtonElement;
    expect(refresh.title).toBe("Làm mới yêu cầu");
    await act(async () => { refresh.click(); refresh.click(); });
    expect(calls).toBe(2);
    const busy = document.querySelector('button[aria-label="Đang làm mới yêu cầu"]') as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    expect(busy.title).toBe("Đang làm mới yêu cầu");
    await act(async () => { resolveRefresh(json(page([request]))); });
    expect((document.querySelector('button[aria-label="Làm mới yêu cầu"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it("returns to the last valid pending page after processing its only request", async () => {
    let rejected = false;
    const lastRequest = { ...request, id: "request-last", studentName: "Trang cuối" };
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${path}?page=1&status=pending`) return Promise.resolve(json(page([request], 1, rejected ? 1 : 2, rejected ? 20 : 21, rejected ? 20 : 21, rejected ? 1 : 0)));
      if (url === `${path}?page=2&status=pending`) return Promise.resolve(json(page(rejected ? [] : [lastRequest], 2, rejected ? 1 : 2, rejected ? 20 : 21, rejected ? 20 : 21, rejected ? 1 : 0)));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === `${path}/request-last/reject` && init?.method === "POST") { rejected = true; return Promise.resolve(json({ data: { ...lastRequest, status: "rejected" } })); }
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock);
    await act(async () => { button("Trang sau").click(); });
    expect(document.body.textContent).toContain("Trang cuối");
    await act(async () => { button("Từ chối").click(); });
    await act(async () => { button("Xác nhận").click(); });
    expect(mock.mock.calls.filter(([url]) => url === `${path}/request-last/reject`)).toHaveLength(1);
    expect(mock.mock.calls.some(([url]) => url === `${path}?page=1&status=pending`)).toBe(true);
    expect(document.querySelector('nav[aria-label="Phân trang yêu cầu tham gia"]')).toBeNull();
    expect(document.body.textContent).not.toContain("Trang cuối");
    expect(button("Đã xử lý (1)")).toBeTruthy();
  });

  it("requires confirmation and sends one approve POST, then refetches requests and membership count", async () => {
    let resolveApprove: (response: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => { resolveApprove = resolve; });
    let approved = false;
    const refreshCount = vi.fn(async () => {});
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${path}?page=1&status=pending` && init?.method === "GET") return Promise.resolve(json(page(approved ? [] : [request], 1, 1, approved ? 0 : 1, approved ? 0 : 1, approved ? 1 : 0)));
      if (url === `${path}?page=1&status=processed` && init?.method === "GET") return Promise.resolve(json(page([{ ...request, status: "approved" }], 1, 1, 1, 0, 1)));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === `${path}/request-1/approve` && init?.method === "POST") return pending;
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock, false, refreshCount);
    expect(document.body.textContent).toContain("Mã khớp danh sách lớp");
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
    expect(document.body.textContent).toContain("Không có yêu cầu chờ xử lý");
    expect(button("Chờ xử lý (0)")).toBeTruthy();
    expect(button("Đã xử lý (1)")).toBeTruthy();
    await act(async () => { button("Đã xử lý (1)").click(); });
    expect(document.querySelector("details")?.textContent).toContain("Đã duyệt");
    expect(document.body.textContent).not.toContain("Xác minh thủ công");
    expect(posts(mock, "approve")).toHaveLength(1);
  });

  it("rejects only after confirmation and never refetches membership count for reject", async () => {
    let rejected = false;
    const refreshCount = vi.fn(async () => {});
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${path}?page=1&status=pending` && init?.method === "GET") return Promise.resolve(json(page(rejected ? [] : [request], 1, 1, rejected ? 0 : 1, rejected ? 0 : 1, rejected ? 1 : 0)));
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
    expect(document.body.textContent).toContain("Không có yêu cầu chờ xử lý");
    expect(button("Đã xử lý (1)")).toBeTruthy();
  });

  it.each(["unverified", "mismatch", "conflict"])("does not directly approve %s but offers manual verification", async (verificationStatus) => {
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${path}?page=1&status=pending` && init?.method === "GET") return Promise.resolve(json(page([{ ...request, verificationStatus }])));
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock);
    expect(button("Duyệt").disabled).toBe(true);
    expect(document.body.textContent).toContain("Xác minh thủ công");
    expect(posts(mock, "approve")).toHaveLength(0);
  });

  it("shows archived request history without review actions", async () => {
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${path}?page=1&status=pending` && init?.method === "GET") return Promise.resolve(json(page([{ ...request, status: "rejected" }])));
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
      if (url === `${path}?page=1&status=pending` && init?.method === "GET") {
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
      if (url === `${path}?page=1&status=pending` && init?.method === "GET") return Promise.resolve(json(page([request])));
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
      if (url === `${path}?page=1&status=pending`) return Promise.resolve(json(page(approved ? [] : [{ ...request, verificationStatus: "unverified" }], 1, 1, approved ? 0 : 1, approved ? 0 : 1, approved ? 1 : 0)));
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
    expect(document.body.textContent).toContain("Không có yêu cầu chờ xử lý");
    expect(button("Đã xử lý (1)")).toBeTruthy();
    expect(document.querySelector("#manual-verification-title")).toBeNull();
  });

  it("keeps manual modal open on API failure and permits retry without a false success", async () => {
    const roster = { id: "roster-1", orderNumber: 1, fullName: "Học sinh", studentCode: "HS001", linkedUserId: null, status: "not_joined" };
    let attempts = 0;
    const manualUrl = `${path}/request-1/manual-verify`;
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${path}?page=1&status=pending`) return Promise.resolve(json(page([{ ...request, verificationStatus: "mismatch" }])));
      if (url === "/api/teacher/classrooms/class-1/roster?page=1") return Promise.resolve(json(page([roster])));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === manualUrl && init?.method === "POST") return Promise.resolve(json({ message: `Denied ${++attempts}` }, 422));
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock);
    await act(async () => { button("Xác minh thủ công").click(); });
    const reason = document.querySelector<HTMLSelectElement>("#verification-reason")!;
    const note = document.querySelector<HTMLTextAreaElement>("#verification-note")!;
    expect([...reason.options].map((option) => option.value)).toContain("wrong_declared_class");
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

  it("offers the backend reason for a missing code and refetches only after manual approval", async () => {
    const roster = { id: "roster-1", orderNumber: 1, fullName: "Học sinh trong danh sách", studentCode: "HS999", linkedUserId: null, status: "not_joined" };
    const missingCode = { ...request, studentCode: null, declaredClass: null, verificationStatus: "unverified" };
    let approved = false;
    const refreshCount = vi.fn(async () => {});
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${path}?page=1&status=pending`) return Promise.resolve(json(page(approved ? [] : [missingCode], 1, 1, approved ? 0 : 1, approved ? 0 : 1, approved ? 1 : 0)));
      if (url === "/api/teacher/classrooms/class-1/roster?page=1") return Promise.resolve(json(page([roster])));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === `${path}/request-1/manual-verify` && init?.method === "POST") { approved = true; return Promise.resolve(json({ data: { id: "membership-1", status: "active" } }, 201)); }
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock, false, refreshCount);
    expect(document.body.textContent).toContain("Học sinh chưa cung cấp mã học sinh");
    expect(document.body.textContent).not.toContain("Mã học sinh chưa tìm thấy trong danh sách lớp");
    await act(async () => { button("Xác minh thủ công").click(); });
    const reason = document.querySelector<HTMLSelectElement>("#verification-reason")!;
    expect([...reason.options].map((option) => option.value)).toEqual(["", "student_code_unknown"]);
    expect(button("Xác nhận và duyệt").disabled).toBe(true);
    const rosterSelect = document.querySelector<HTMLSelectElement>("#roster-entry")!;
    const note = document.querySelector<HTMLTextAreaElement>("#verification-note")!;
    await act(async () => {
      rosterSelect.value = "roster-1"; rosterSelect.dispatchEvent(new Event("change", { bubbles: true }));
      reason.value = "student_code_unknown"; reason.dispatchEvent(new Event("change", { bubbles: true }));
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setter?.call(note, "Đã kiểm tra trực tiếp"); note.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { button("Xác nhận và duyệt").click(); });
    expect(posts(mock, "manual-verify")).toHaveLength(0);
    await act(async () => { button("Đồng ý xác minh và duyệt").click(); });
    expect(posts(mock, "manual-verify")).toHaveLength(1);
    expect(JSON.parse(String(posts(mock, "manual-verify")[0][1]?.body))).toEqual({ roster_entry_id: "roster-1", reason: "student_code_unknown", note: "Đã kiểm tra trực tiếp" });
    expect(refreshCount).toHaveBeenCalledTimes(1);
    expect(button("Chờ xử lý (0)")).toBeTruthy();
    expect(button("Đã xử lý (1)")).toBeTruthy();
  });

  it("shows a missing roster code separately from a missing student code and filters legacy reasons", async () => {
    const roster = { id: "roster-1", orderNumber: 1, fullName: "Học sinh", studentCode: "HS999", linkedUserId: null, status: "not_joined" };
    const mock = vi.fn((url: string) => {
      if (url === `${path}?page=1&status=pending`) return Promise.resolve(json(page([{ ...request, declaredClass: null, verificationStatus: "unverified" }])));
      if (url === "/api/teacher/classrooms/class-1/roster?page=1") return Promise.resolve(json(page([roster])));
      throw new Error(`Unexpected ${url}`);
    });
    await render(mock);
    expect(document.body.textContent).toContain("Mã học sinh chưa tìm thấy trong danh sách lớp");
    await act(async () => { button("Xác minh thủ công").click(); });
    const reasons = [...document.querySelector<HTMLSelectElement>("#verification-reason")!.options].map((option) => option.value);
    expect(reasons).toContain("wrong_student_code");
    expect(reasons).not.toContain("student_code_unknown");
    expect(reasons).not.toContain("wrong_declared_class");
  });

  it("does not offer an already linked roster entry or approval without a roster", async () => {
    const claimed = { id: "roster-1", orderNumber: 1, fullName: "Học sinh khác", studentCode: "HS001", linkedUserId: 999, status: "joined" };
    let rosterEntries: unknown[] = [claimed];
    const mock = vi.fn((url: string) => {
      if (url === `${path}?page=1&status=pending`) return Promise.resolve(json(page([{ ...request, verificationStatus: "conflict" }])));
      if (url === "/api/teacher/classrooms/class-1/roster?page=1") return Promise.resolve(json(page(rosterEntries)));
      throw new Error(`Unexpected ${url}`);
    });
    await render(mock);
    await act(async () => { button("Xác minh thủ công").click(); });
    expect(document.querySelector<HTMLOptionElement>('option[value="roster-1"]')?.disabled).toBe(true);
    expect(button("Xác nhận và duyệt").disabled).toBe(true);
    expect(document.body.textContent).toContain("Mã này đã liên kết với tài khoản khác");
    await act(async () => { button("Hủy").click(); });
    rosterEntries = [];
    await act(async () => { button("Xác minh thủ công").click(); });
    expect(document.body.textContent).toContain("Hãy nhập danh sách Excel");
    expect(button("Xác nhận và duyệt").disabled).toBe(true);
    expect(posts(mock, "manual-verify")).toHaveLength(0);
  });

  it("retries roster loading before manual verification", async () => {
    let rosterCalls = 0;
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${path}?page=1&status=pending`) return Promise.resolve(json(page([{ ...request, verificationStatus: "unverified" }])));
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

  it("previews every eligible page and keeps selection limited to the current 100 IDs", async () => {
    const entries = Array.from({ length: 100 }, (_, index) => ({
      requestId: `id-${index + 1}`, studentName: `Tài khoản ${index + 1}`, studentEmail: `student${index + 1}@example.test`,
      submittedStudentCode: `HS${index + 1}`, rosterEntryId: `roster-${index + 1}`,
      rosterStudentName: `Danh sách ${index + 1}`, rosterStudentCode: `HS${index + 1}`,
    }));
    const previewUrl = `${path}/bulk-approve/preview`;
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${path}?page=1&status=pending`) return Promise.resolve(json(page([request])));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === previewUrl && init?.method === "POST") {
        const previewPage = JSON.parse(String(init.body)).page;
        return Promise.resolve(json({
          data: previewPage === 1 ? entries : [entries[0]],
          summary: { eligibleTotal: 101, requiresIndividualReviewTotal: 7, pendingTotal: 108 },
          meta: { currentPage: previewPage, lastPage: 2, perPage: 100, hasMore: previewPage === 1 },
        }));
      }
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock);
    await act(async () => { button("Kiểm tra và duyệt hàng loạt").click(); });
    const dialog = document.querySelector('[role="dialog"][aria-labelledby="bulk-preview-title"]')!;
    expect(dialog.textContent).toContain("Duyệt hàng loạt");
    expect(dialog.textContent).toContain("Đối chiếu học sinh trước khi duyệt.");
    expect(dialog.textContent).toContain("Đủ điều kiện: 101");
    expect(dialog.textContent).toContain("Cần xác minh: 7");
    expect(dialog.textContent).toContain("Mã khớp chưa đảm bảo đúng người.");
    expect(dialog.textContent).toContain("Tài khoản 100");
    expect(dialog.textContent).toContain("Danh sách 100");
    expect(dialog.textContent).toContain("Đổi trang sẽ bỏ chọn");
    expect(dialog.textContent).toContain("Mã roster: HS100");
    const checkboxes = [...dialog.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    expect(checkboxes).toHaveLength(101);
    expect(checkboxes.every((input) => !input.checked)).toBe(true);
    await act(async () => { checkboxes[1].click(); });
    expect(dialog.textContent).toContain("Đã chọn: 1/100");
    await act(async () => { checkboxes[1].click(); });
    expect(dialog.textContent).toContain("Đã chọn: 0/100");
    await act(async () => { checkboxes[0].click(); });
    expect(dialog.textContent).toContain("Đã chọn: 100/100");
    await act(async () => { checkboxes[1].click(); });
    expect(dialog.textContent).toContain("Đã chọn: 99/100");
    const pagination = dialog.querySelector('nav[aria-label="Phân trang xem trước duyệt hàng loạt"]')!;
    await act(async () => { (pagination.querySelectorAll("button")[1] as HTMLButtonElement).click(); });
    expect(dialog.textContent).toContain("Trang 2 / 2");
    expect(dialog.textContent).toContain("Đã chọn: 0/1");
    expect(dialog.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
    expect(mock.mock.calls.filter(([url, init]) => url === previewUrl && init?.method === "POST")).toHaveLength(2);
    expect(mock.mock.calls.some(([url]) => url === `${path}/bulk-approve`)).toBe(false);
    await act(async () => { button("Đóng").click(); });
    expect(document.querySelector('#bulk-preview-title')).toBeNull();
  });

  it("shows preview loading and error, then retries without executing approval", async () => {
    const previewUrl = `${path}/bulk-approve/preview`;
    let resolvePreview: (response: Response) => void = () => {};
    let attempts = 0;
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${path}?page=1&status=pending`) return Promise.resolve(json(page([request])));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === previewUrl && init?.method === "POST") {
        attempts += 1;
        return attempts === 1 ? new Promise<Response>((resolve) => { resolvePreview = resolve; })
          : Promise.resolve(json({ data: [], summary: { eligibleTotal: 0, requiresIndividualReviewTotal: 1, pendingTotal: 1 }, meta: { currentPage: 1, lastPage: 1, perPage: 100, hasMore: false } }));
      }
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock);
    await act(async () => { button("Kiểm tra và duyệt hàng loạt").click(); });
    expect(document.querySelector('#bulk-preview-title')).not.toBeNull();
    expect(document.querySelector('[role="dialog"] [role="status"]')?.textContent).toContain("Đang tải danh sách xem trước");
    await act(async () => { resolvePreview(json({ message: "Preview unavailable" }, 500)); });
    expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain("Preview unavailable");
    await act(async () => { button("Thử lại").click(); });
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Không có yêu cầu đủ điều kiện trên trang này.");
    expect(attempts).toBe(2);
    expect(mock.mock.calls.some(([url]) => url === `${path}/bulk-approve`)).toBe(false);
  });

  it("does not offer bulk preview for an archived classroom", async () => {
    const mock = vi.fn((url: string) => url === `${path}?page=1&status=pending`
      ? Promise.resolve(json(page([]))) : Promise.reject(new Error(`Unexpected ${url}`)));
    await render(mock, true);
    expect(document.body.textContent).not.toContain("Kiểm tra và duyệt hàng loạt");
  });

  it("ignores a pending preview response after closing the dialog", async () => {
    let resolvePreview: (response: Response) => void = () => {};
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${path}?page=1&status=pending`) return Promise.resolve(json(page([request])));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === `${path}/bulk-approve/preview` && init?.method === "POST") return new Promise<Response>((resolve) => { resolvePreview = resolve; });
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock);
    await act(async () => { button("Kiểm tra và duyệt hàng loạt").click(); });
    await act(async () => { button("Đóng").click(); });
    await act(async () => { resolvePreview(json({ data: [], summary: { eligibleTotal: 0, requiresIndividualReviewTotal: 0, pendingTotal: 0 }, meta: { currentPage: 1, lastPage: 1, perPage: 100, hasMore: false } })); });
    expect(document.querySelector('#bulk-preview-title')).toBeNull();
    expect(mock.mock.calls.some(([url]) => url === `${path}/bulk-approve`)).toBe(false);
  });

  it("requires selection and final confirmation, then sends only selected IDs once", async () => {
    let processed = false;
    let resolveExecution: (response: Response) => void = () => {};
    const pendingExecution = new Promise<Response>((resolve) => { resolveExecution = resolve; });
    const membershipRefresh = vi.fn(async () => {});
    const rosterRefresh = vi.fn();
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${path}?page=1&status=pending`) return Promise.resolve(json(page(processed ? [] : [request], 1, 1, processed ? 0 : 1, processed ? 0 : 1, processed ? 1 : 0)));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === `${path}/bulk-approve/preview` && init?.method === "POST") return Promise.resolve(json(bulkPreview([previewEntry("selected"), previewEntry("unselected")])));
      if (url === `${path}/bulk-approve` && init?.method === "POST") return pendingExecution;
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock, false, membershipRefresh, rosterRefresh);
    await act(async () => { button("Kiểm tra và duyệt hàng loạt").click(); });
    expect(button("Tiếp tục").disabled).toBe(true);
    expect(mock.mock.calls.filter(([url]) => url === `${path}/bulk-approve`)).toHaveLength(0);
    const dialog = document.querySelector('[aria-labelledby="bulk-preview-title"]')!;
    await act(async () => { dialog.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1].click(); });
    await act(async () => { button("Tiếp tục").click(); });
    expect(dialog.textContent).toContain("Duyệt 1 học sinh?");
    expect(dialog.textContent).toContain("Backend sẽ kiểm tra lại điều kiện");
    await act(async () => { button("Quay lại").click(); });
    expect(mock.mock.calls.filter(([url]) => url === `${path}/bulk-approve`)).toHaveLength(0);
    await act(async () => { button("Tiếp tục").click(); });
    await act(async () => { button("Duyệt 1 học sinh").click(); button("Duyệt 1 học sinh").click(); });
    const executions = mock.mock.calls.filter(([url, init]) => url === `${path}/bulk-approve` && init?.method === "POST");
    expect(executions).toHaveLength(1);
    expect(JSON.parse(String(executions[0][1]?.body))).toEqual({ request_ids: ["selected"] });
    expect((dialog.querySelector('button[aria-label="Đóng xem trước duyệt hàng loạt"]') as HTMLButtonElement).disabled).toBe(true);
    expect(dialog.textContent).toContain("Đang duyệt yêu cầu");
    processed = true;
    await act(async () => { resolveExecution(json({ approvedCount: 1, skippedCount: 0, results: [{ requestId: "selected", status: "approved" }], statusCounts: { pending: 0, approved: 1, rejected: 0, processed: 1, total: 1 } })); });
    expect(dialog.textContent).toContain("Đã duyệt: 1 · Bỏ qua: 0");
    expect(button("Chờ xử lý (0)")).toBeTruthy();
    expect(button("Đã xử lý (1)")).toBeTruthy();
    expect(membershipRefresh).toHaveBeenCalledTimes(1);
    expect(rosterRefresh).toHaveBeenCalledTimes(1);
  });

  it("never carries selected IDs from a previous preview page into execution", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => previewEntry(`first-${index}`));
    const secondPage = [previewEntry("second-101")];
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${path}?page=1&status=pending`) return Promise.resolve(json(page([request])));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === `${path}/bulk-approve/preview` && init?.method === "POST") {
        const current = JSON.parse(String(init.body)).page as number;
        return Promise.resolve(json(bulkPreview(current === 1 ? firstPage : secondPage, current, 2, 101)));
      }
      if (url === `${path}/bulk-approve` && init?.method === "POST") return Promise.resolve(json({ approvedCount: 1, skippedCount: 0, results: [{ requestId: "second-101", status: "approved" }], statusCounts: { pending: 0, approved: 1, rejected: 0, processed: 1, total: 1 } }));
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock);
    await act(async () => { button("Kiểm tra và duyệt hàng loạt").click(); });
    const dialog = document.querySelector('[aria-labelledby="bulk-preview-title"]')!;
    await act(async () => { dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click(); });
    expect(dialog.textContent).toContain("Đã chọn: 100/100");
    const pagination = dialog.querySelector('nav[aria-label="Phân trang xem trước duyệt hàng loạt"]')!;
    await act(async () => { (pagination.querySelectorAll("button")[1] as HTMLButtonElement).click(); });
    expect(button("Tiếp tục").disabled).toBe(true);
    await act(async () => { dialog.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1].click(); });
    await act(async () => { button("Tiếp tục").click(); });
    await act(async () => { button("Duyệt 1 học sinh").click(); });
    const execution = mock.mock.calls.find(([url]) => url === `${path}/bulk-approve`)!;
    expect(JSON.parse(String(execution[1]?.body))).toEqual({ request_ids: ["second-101"] });
  });

  it("shows partial success and translates skipped reasons without claiming all succeeded", async () => {
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${path}?page=1&status=pending`) return Promise.resolve(json(page([request])));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === `${path}/bulk-approve/preview` && init?.method === "POST") return Promise.resolve(json(bulkPreview([previewEntry("a"), previewEntry("b")])));
      if (url === `${path}/bulk-approve` && init?.method === "POST") return Promise.resolve(json({ approvedCount: 1, skippedCount: 1, results: [
        { requestId: "a", status: "approved" }, { requestId: "b", status: "skipped", reason: "not_matched" },
      ], statusCounts: { pending: 1, approved: 1, rejected: 0, processed: 1, total: 2 } }));
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock);
    await act(async () => { button("Kiểm tra và duyệt hàng loạt").click(); });
    const dialog = document.querySelector('[aria-labelledby="bulk-preview-title"]')!;
    await act(async () => { dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click(); });
    await act(async () => { button("Tiếp tục").click(); });
    await act(async () => { button("Duyệt 2 học sinh").click(); });
    expect(dialog.textContent).toContain("Đã duyệt: 1 · Bỏ qua: 1");
    expect(dialog.textContent).toContain("Tài khoản b");
    expect(dialog.textContent).toContain("Thông tin không còn khớp danh sách lớp.");
    expect(dialog.textContent).not.toContain("Duyệt tất cả thành công");
  });

  it("does not retry a failed batch until the teacher rechecks preview and confirms again", async () => {
    let previews = 0;
    let executions = 0;
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${path}?page=1&status=pending`) return Promise.resolve(json(page([request])));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === `${path}/bulk-approve/preview` && init?.method === "POST") { previews += 1; return Promise.resolve(json(bulkPreview([previewEntry("a")]))); }
      if (url === `${path}/bulk-approve` && init?.method === "POST") {
        executions += 1;
        return Promise.resolve(executions === 1 ? json({ message: "Approval failed" }, 500)
          : json({ approvedCount: 1, skippedCount: 0, results: [{ requestId: "a", status: "approved" }], statusCounts: { pending: 0, approved: 1, rejected: 0, processed: 1, total: 1 } }));
      }
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock);
    await act(async () => { button("Kiểm tra và duyệt hàng loạt").click(); });
    const dialog = document.querySelector('[aria-labelledby="bulk-preview-title"]')!;
    await act(async () => { dialog.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1].click(); });
    await act(async () => { button("Tiếp tục").click(); });
    await act(async () => { button("Duyệt 1 học sinh").click(); });
    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain("Approval failed");
    expect(dialog.textContent).not.toContain("Đã duyệt: 1");
    expect(executions).toBe(1);
    await act(async () => { button("Kiểm tra lại").click(); });
    expect(previews).toBe(2);
    expect(dialog.textContent).toContain("Đã chọn: 0/1");
    expect(executions).toBe(1);
    await act(async () => { dialog.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1].click(); });
    await act(async () => { button("Tiếp tục").click(); });
    await act(async () => { button("Duyệt 1 học sinh").click(); });
    expect(executions).toBe(2);
    expect(dialog.textContent).toContain("Đã duyệt: 1 · Bỏ qua: 0");
  });
});
