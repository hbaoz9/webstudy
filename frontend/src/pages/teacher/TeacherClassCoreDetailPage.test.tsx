// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeacherClassCoreDetailPage from "./TeacherClassCoreDetailPage";

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
        <Routes><Route path="/teacher/classes/:classId" element={<TeacherClassCoreDetailPage />} /></Routes>
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

  it("shows archived history without edit, archive, restore, or delete controls", async () => {
    const archived = { ...classroom, status: "archived" };
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === detailUrl && init?.method === "GET") return Promise.resolve(json({ data: archived }));
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    await renderPage(fetchMock, archived);
    expect(document.querySelector("header")?.textContent).toContain("Đã lưu trữ");
    expect(document.querySelector('[data-roster-status="archived"]')).not.toBeNull();
    expect(document.body.textContent).not.toMatch(/Cài đặt|Lưu trữ lớp|Khôi phục lớp|Xóa lớp|Quản lý lớp học/);
    expect(archiveCalls(fetchMock)).toHaveLength(0);
  });
});
