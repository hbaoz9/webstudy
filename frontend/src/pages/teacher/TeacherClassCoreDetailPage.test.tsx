// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeacherClassCoreDetailPage from "./TeacherClassCoreDetailPage";
import TeacherClassesPage from "./TeacherClassesPage";

vi.mock("../../components/teacher/TeacherRosterReadSection", () => ({
  TeacherRosterReadSection: ({ archived }: { archived: boolean }) => <div data-roster-status={archived ? "archived" : "active"} />,
}));
vi.mock("../../components/teacher/TeacherJoinRequestsSection", () => ({
  TeacherJoinRequestsSection: () => <div data-testid="teacher-join-requests" />,
}));

const classroom = {
  id: "class-uuid", name: "10A1 - Kiểm thử", code: "ABC234", academicYear: "2026-2027",
  description: "Mô tả ban đầu", coverImage: null, status: "active", createdAt: "2026-10-28T00:00:00Z", studentCount: 3,
};
const detailUrl = "/api/teacher/classrooms/class-uuid";
const archiveUrl = `${detailUrl}/archive`;
const restoreUrl = `${detailUrl}/restore`;
const regenerateUrl = `${detailUrl}/regenerate-code`;
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { "Content-Type": "application/json" },
});

let root: Root;
let host: HTMLDivElement;

function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === label);
  if (!found) throw new Error(`Button not found: ${label}`);
  return found;
}

function putCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([url, init]) => url === detailUrl && init?.method === "PUT");
}

function archiveCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([url, init]) => url === archiveUrl && init?.method === "POST");
}

function restoreCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([url, init]) => url === restoreUrl && init?.method === "POST");
}

async function openModal() {
  const settings = button("Cài đặt");
  expect(settings.closest("header")).not.toBeNull();
  expect(settings.parentElement).toBe(document.querySelector('button[aria-label^="Sao chép mã lớp"]')?.parentElement);
  expect(document.body.textContent).not.toContain("Quản lý lớp học");
  await act(async () => { settings.click(); });
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
}

async function changeDescription(value: string) {
  const input = document.querySelector<HTMLTextAreaElement>("#settings-description");
  if (!input) throw new Error("Description field not found");
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(input.value).toBe(value);
}

describe("classroom edit modal requests", () => {
  beforeEach(async () => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    document.cookie = "XSRF-TOKEN=test-token";
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    host.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function renderPage(fetchMock: ReturnType<typeof vi.fn>, initialClassroom = classroom) {
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => {
      root.render(<MemoryRouter initialEntries={["/teacher/classes/class-uuid"]}>
        <Routes>
          <Route path="/teacher/classes/:classId" element={<TeacherClassCoreDetailPage />} />
          <Route path="/teacher/classes" element={<TeacherClassesPage />} />
        </Routes>
      </MemoryRouter>);
    });
    expect(document.querySelector("h1")?.textContent).toBe(initialClassroom.name);
  }

  it("sends one PUT while pending, disables resubmission, and shows one confirmed update", async () => {
    let resolvePut: (response: Response) => void = () => {};
    const pendingPut = new Promise<Response>((resolve) => { resolvePut = resolve; });
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === detailUrl && init?.method === "GET") return Promise.resolve(json({ data: classroom }));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === detailUrl && init?.method === "PUT") return pendingPut;
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    await renderPage(fetchMock);
    expect(document.body.textContent).not.toContain("Khôi phục lớp");
    await openModal();
    await changeDescription("Mô tả đã cập nhật");

    const form = document.querySelector<HTMLFormElement>('[role="dialog"] form');
    if (!form) throw new Error("Edit form not found");
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(putCalls(fetchMock)).toHaveLength(1);
    expect(JSON.parse(putCalls(fetchMock)[0][1].body)).toMatchObject({ description: "Mô tả đã cập nhật" });
    expect(button("Đang lưu…").disabled).toBe(true);
    await act(async () => {
      button("Đang lưu…").click();
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(putCalls(fetchMock)).toHaveLength(1);
    expect(document.body.textContent).not.toContain("Đã lưu thông tin lớp học.");

    await act(async () => { resolvePut(json({ data: { ...classroom, description: "Mô tả đã cập nhật" } })); });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector("header")?.textContent).toContain("Mô tả đã cập nhật");
    expect(document.body.textContent?.match(/Đã lưu thông tin lớp học\./g)).toHaveLength(1);
    expect(putCalls(fetchMock)).toHaveLength(1);
  });

  it("shows API failure without success and permits one retry", async () => {
    let resolveRetry: (response: Response) => void = () => {};
    const pendingRetry = new Promise<Response>((resolve) => { resolveRetry = resolve; });
    let putCount = 0;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === detailUrl && init?.method === "GET") return Promise.resolve(json({ data: classroom }));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === detailUrl && init?.method === "PUT") {
        putCount += 1;
        return putCount === 1 ? Promise.resolve(json({ message: "Lưu thất bại" }, 500)) : pendingRetry;
      }
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    await renderPage(fetchMock);
    await openModal();
    await changeDescription("Mô tả thử lại");
    await act(async () => { button("Lưu thay đổi").click(); });
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Lưu thất bại");
    expect(document.body.textContent).not.toContain("Đã lưu thông tin lớp học.");
    expect(putCalls(fetchMock)).toHaveLength(1);

    await act(async () => { button("Lưu thay đổi").click(); });
    expect(putCalls(fetchMock)).toHaveLength(2);
    expect(JSON.parse(putCalls(fetchMock)[1][1].body)).toMatchObject({ description: "Mô tả thử lại" });
    expect(button("Đang lưu…").disabled).toBe(true);
    await act(async () => { resolveRetry(json({ data: { ...classroom, description: "Mô tả thử lại" } })); });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector("header")?.textContent).toContain("Mô tả thử lại");
    expect(document.body.textContent?.match(/Đã lưu thông tin lớp học\./g)).toHaveLength(1);
  });

  it("cancels editing without a PUT", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === detailUrl && init?.method === "GET") return Promise.resolve(json({ data: classroom }));
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    await renderPage(fetchMock);
    await openModal();
    await changeDescription("Không lưu");
    await act(async () => { button("Hủy").click(); });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(putCalls(fetchMock)).toHaveLength(0);
    expect(document.querySelector("header")?.textContent).toContain("Mô tả ban đầu");
  });

  it("shows archive in the active settings modal and cancels confirmation without POST", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === detailUrl && init?.method === "GET") return Promise.resolve(json({ data: classroom }));
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    await renderPage(fetchMock);
    expect(document.body.textContent).not.toContain("Lưu trữ lớp");
    await openModal();
    expect(button("Lưu trữ lớp")).toBeTruthy();
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("yêu cầu tham gia đang chờ sẽ bị từ chối");
    expect(document.querySelector('[role="dialog"]')?.textContent).not.toMatch(/Khôi phục lớp|Xóa lớp|Tạo mã mới/);
    await act(async () => { button("Lưu trữ lớp").click(); });
    expect(archiveCalls(fetchMock)).toHaveLength(0);
    expect(button("Lưu thay đổi").disabled).toBe(true);
    await act(async () => { button("Hủy lưu trữ").click(); });
    expect(archiveCalls(fetchMock)).toHaveLength(0);
    await act(async () => { button("Hủy").click(); });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(archiveCalls(fetchMock)).toHaveLength(0);
  });

  it("posts archive once after confirmation and uses the returned archived state", async () => {
    let resolveArchive: (response: Response) => void = () => {};
    const pendingArchive = new Promise<Response>((resolve) => { resolveArchive = resolve; });
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === detailUrl && init?.method === "GET") return Promise.resolve(json({ data: classroom }));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === archiveUrl && init?.method === "POST") return pendingArchive;
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    await renderPage(fetchMock);
    await openModal();
    await act(async () => { button("Lưu trữ lớp").click(); });
    const confirm = button("Xác nhận lưu trữ");
    await act(async () => { confirm.click(); confirm.click(); });
    expect(archiveCalls(fetchMock)).toHaveLength(1);
    expect(button("Đang lưu trữ…").disabled).toBe(true);
    await act(async () => { button("Đang lưu trữ…").click(); });
    expect(archiveCalls(fetchMock)).toHaveLength(1);
    expect(document.body.textContent).not.toContain("Đã lưu trữ lớp học. Lịch sử lớp vẫn được giữ lại.");
    await act(async () => { resolveArchive(json({ data: { ...classroom, status: "archived", studentCount: 0 } })); });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector("header")?.textContent).toContain("Đã lưu trữ");
    expect(document.querySelector('[data-roster-status="archived"]')).not.toBeNull();
    expect(document.body.textContent?.match(/Đã lưu trữ lớp học\. Lịch sử lớp vẫn được giữ lại\./g)).toHaveLength(1);
    expect(document.querySelector("header button")?.textContent).not.toContain("Cài đặt");
    expect(archiveCalls(fetchMock)).toHaveLength(1);
  });

  it.each([401, 403, 404, 409, 422, 500])("keeps the modal open on archive HTTP %i without false success", async (status) => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === detailUrl && init?.method === "GET") return Promise.resolve(json({ data: classroom }));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === archiveUrl && init?.method === "POST") return Promise.resolve(json({ message: `Archive error ${status}` }, status));
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    await renderPage(fetchMock);
    await openModal();
    await act(async () => { button("Lưu trữ lớp").click(); });
    await act(async () => { button("Xác nhận lưu trữ").click(); });
    expect(archiveCalls(fetchMock)).toHaveLength(1);
    expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain(`Archive error ${status}`);
    expect(document.querySelector("header")?.textContent).not.toContain("Đã lưu trữ");
    expect(document.body.textContent).not.toContain("Đã lưu trữ lớp học. Lịch sử lớp vẫn được giữ lại.");
  });

  it("shows a network failure and allows archive retry", async () => {
    let attempts = 0;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === detailUrl && init?.method === "GET") return Promise.resolve(json({ data: classroom }));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === archiveUrl && init?.method === "POST") {
        attempts += 1;
        return attempts === 1 ? Promise.reject(new TypeError("offline"))
          : Promise.resolve(json({ data: { ...classroom, status: "archived", studentCount: 0 } }));
      }
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    await renderPage(fetchMock);
    await openModal();
    await act(async () => { button("Lưu trữ lớp").click(); });
    await act(async () => { button("Xác nhận lưu trữ").click(); });
    expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain("Không thể kết nối máy chủ");
    expect(document.body.textContent).not.toContain("Đã lưu trữ lớp học. Lịch sử lớp vẫn được giữ lại.");
    await act(async () => { button("Xác nhận lưu trữ").click(); });
    expect(archiveCalls(fetchMock)).toHaveLength(2);
    expect(document.querySelector("header")?.textContent).toContain("Đã lưu trữ");
  });

  it("shows archived history with restore but without edit, archive, or delete controls", async () => {
    const archived = { ...classroom, status: "archived" };
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === detailUrl && init?.method === "GET") return Promise.resolve(json({ data: archived }));
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    await renderPage(fetchMock, archived);
    expect(document.querySelector("header")?.textContent).toContain("Đã lưu trữ");
    expect(document.querySelector('[data-roster-status="archived"]')).not.toBeNull();
    expect(button("Khôi phục lớp").closest("header")).not.toBeNull();
    expect(button("Xóa lớp")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Cài đặt|Lưu trữ lớp|Quản lý lớp học/);
    expect(archiveCalls(fetchMock)).toHaveLength(0);
  });

  it("cancels restore confirmation without a POST", async () => {
    const archived = { ...classroom, status: "archived" };
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === detailUrl && init?.method === "GET") return Promise.resolve(json({ data: archived }));
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    await renderPage(fetchMock, archived);
    await act(async () => { button("Khôi phục lớp").click(); });
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("sẽ không tự động tham gia lại");
    expect(restoreCalls(fetchMock)).toHaveLength(0);
    await act(async () => { button("Hủy").click(); });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(restoreCalls(fetchMock)).toHaveLength(0);
  });

  it("posts restore once, waits for confirmation, then refetches classroom detail", async () => {
    const archived = { ...classroom, status: "archived", studentCount: 0 };
    const active = { ...archived, status: "active" };
    let resolveRestore: (response: Response) => void = () => {};
    const pendingRestore = new Promise<Response>((resolve) => { resolveRestore = resolve; });
    let detailGets = 0;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === detailUrl && init?.method === "GET") return Promise.resolve(json({ data: ++detailGets === 1 ? archived : active }));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === restoreUrl && init?.method === "POST") return pendingRestore;
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    await renderPage(fetchMock, archived);
    await act(async () => { button("Khôi phục lớp").click(); });
    const confirm = button("Xác nhận khôi phục");
    await act(async () => { confirm.click(); confirm.click(); });
    expect(restoreCalls(fetchMock)).toHaveLength(1);
    expect(button("Đang khôi phục…").disabled).toBe(true);
    expect(button("Hủy").disabled).toBe(true);
    expect(document.querySelector("header")?.textContent).toContain("Đã lưu trữ");
    await act(async () => { resolveRestore(json({ data: active })); });
    expect(detailGets).toBe(2);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector("header")?.textContent).not.toContain("Đã lưu trữ");
    expect(button("Cài đặt")).toBeTruthy();
    expect(document.querySelector('[data-roster-status="active"]')).not.toBeNull();
    expect(document.body.textContent?.match(/Đã khôi phục lớp học/g)).toHaveLength(1);
  });

  it("keeps archived state on restore error and permits retry", async () => {
    const archived = { ...classroom, status: "archived", studentCount: 0 };
    const active = { ...archived, status: "active" };
    let attempts = 0;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === detailUrl && init?.method === "GET") return Promise.resolve(json({ data: attempts === 2 ? active : archived }));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === restoreUrl && init?.method === "POST") return Promise.resolve(++attempts === 1 ? json({ message: "Restore failed" }, 409) : json({ data: active }));
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    await renderPage(fetchMock, archived);
    await act(async () => { button("Khôi phục lớp").click(); });
    await act(async () => { button("Xác nhận khôi phục").click(); });
    expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain("Restore failed");
    expect(document.querySelector("header")?.textContent).toContain("Đã lưu trữ");
    expect(document.body.textContent).not.toContain("Đã khôi phục lớp học.");
    await act(async () => { button("Xác nhận khôi phục").click(); });
    expect(restoreCalls(fetchMock)).toHaveLength(2);
    expect(document.querySelector("header")?.textContent).not.toContain("Đã lưu trữ");
  });

  it("shows separate restore and delete controls for archived classes and cancels delete", async () => {
    const archived = { ...classroom, status: "archived", studentCount: 0 };
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === detailUrl && init?.method === "GET") return Promise.resolve(json({ data: archived }));
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    await renderPage(fetchMock, archived);
    expect(button("Khôi phục lớp")).toBeTruthy();
    expect(button("Xóa lớp").className).toContain("red");
    await act(async () => { button("Xóa lớp").click(); });
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Xóa mềm");
    expect(fetchMock.mock.calls.filter(([url, init]) => url === detailUrl && init?.method === "DELETE")).toHaveLength(0);
    await act(async () => { button("Hủy").click(); });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(fetchMock.mock.calls.filter(([url, init]) => url === detailUrl && init?.method === "DELETE")).toHaveLength(0);
  });

  it("sends one delete while pending, then navigates and refetches the class list", async () => {
    const archived = { ...classroom, status: "archived", studentCount: 0 };
    let resolveDelete: (response: Response) => void = () => {};
    const pendingDelete = new Promise<Response>((resolve) => { resolveDelete = resolve; });
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === detailUrl && init?.method === "GET") return Promise.resolve(json({ data: archived }));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === detailUrl && init?.method === "DELETE") return pendingDelete;
      if (url === "/api/teacher/classrooms?page=1") return Promise.resolve(json({ data: [], meta: { last_page: 1 } }));
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    await renderPage(fetchMock, archived);
    await act(async () => { button("Xóa lớp").click(); });
    const confirm = button("Xác nhận xóa lớp");
    await act(async () => { confirm.click(); confirm.click(); });
    expect(fetchMock.mock.calls.filter(([url, init]) => url === detailUrl && init?.method === "DELETE")).toHaveLength(1);
    expect(button("Đang xóa…").disabled).toBe(true);
    expect(button("Hủy").disabled).toBe(true);
    expect(document.querySelector("h1")?.textContent).toBe(classroom.name);
    await act(async () => { resolveDelete(new Response(null, { status: 204 })); });
    expect(document.querySelector("h1")?.textContent).toBe("Danh sách lớp học");
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/teacher/classrooms?page=1")).toHaveLength(1);
  });

  it("keeps the archived class visible on delete error and allows retry", async () => {
    const archived = { ...classroom, status: "archived", studentCount: 0 };
    let attempts = 0;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === detailUrl && init?.method === "GET") return Promise.resolve(json({ data: archived }));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === detailUrl && init?.method === "DELETE") return Promise.resolve(++attempts === 1 ? json({ message: "Delete failed" }, 409) : new Response(null, { status: 204 }));
      if (url === "/api/teacher/classrooms?page=1") return Promise.resolve(json({ data: [], meta: { last_page: 1 } }));
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    await renderPage(fetchMock, archived);
    await act(async () => { button("Xóa lớp").click(); });
    await act(async () => { button("Xác nhận xóa lớp").click(); });
    expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain("Delete failed");
    expect(document.querySelector("h1")?.textContent).toBe(classroom.name);
    await act(async () => { button("Xác nhận xóa lớp").click(); });
    expect(attempts).toBe(2);
    expect(document.querySelector("h1")?.textContent).toBe("Danh sách lớp học");
  });

  it("changes the active class code only after one confirmed POST and copies the new code", async () => {
    const updated = { ...classroom, code: "NEW567" };
    let resolveCode: (response: Response) => void = () => {};
    const pendingCode = new Promise<Response>((resolve) => { resolveCode = resolve; });
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === detailUrl && init?.method === "GET") return Promise.resolve(json({ data: classroom }));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === regenerateUrl && init?.method === "POST") return pendingCode;
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
    await renderPage(fetchMock);
    expect(document.body.textContent).not.toContain("Xóa lớp");
    await openModal();
    await act(async () => { button("Đổi mã lớp").click(); });
    const confirm = button("Xác nhận đổi mã");
    await act(async () => { confirm.click(); confirm.click(); });
    expect(fetchMock.mock.calls.filter(([url, init]) => url === regenerateUrl && init?.method === "POST")).toHaveLength(1);
    expect(button("Đang đổi mã…").disabled).toBe(true);
    expect(document.querySelector("header")?.textContent).toContain("ABC234");
    await act(async () => { resolveCode(json({ data: updated })); });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector("header")?.textContent).toContain("NEW567");
    await act(async () => { document.querySelector<HTMLButtonElement>('button[aria-label="Sao chép mã lớp NEW567"]')?.click(); });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("NEW567");
  });

  it("cancels code regeneration without a POST or changing the class code", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === detailUrl && init?.method === "GET") return Promise.resolve(json({ data: classroom }));
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    await renderPage(fetchMock);
    await openModal();
    await act(async () => { button("Đổi mã lớp").click(); });
    expect(button("Lưu thay đổi").disabled).toBe(true);
    await act(async () => { button("Hủy đổi mã").click(); });
    expect(fetchMock.mock.calls.filter(([url]) => url === regenerateUrl)).toHaveLength(0);
    expect(document.querySelector("header")?.textContent).toContain("ABC234");
    expect(button("Lưu thay đổi").disabled).toBe(false);
  });

  it("keeps the old code on regenerate failure and allows retry", async () => {
    let attempts = 0;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === detailUrl && init?.method === "GET") return Promise.resolve(json({ data: classroom }));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === regenerateUrl && init?.method === "POST") return Promise.resolve(++attempts === 1 ? json({ message: "Code failed" }, 422) : json({ data: { ...classroom, code: "NEW567" } }));
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    await renderPage(fetchMock);
    await openModal();
    await act(async () => { button("Đổi mã lớp").click(); });
    await act(async () => { button("Xác nhận đổi mã").click(); });
    expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain("Code failed");
    expect(document.querySelector("header")?.textContent).toContain("ABC234");
    await act(async () => { button("Xác nhận đổi mã").click(); });
    expect(attempts).toBe(2);
    expect(document.querySelector("header")?.textContent).toContain("NEW567");
  });
});
