// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { utils, write } from "xlsx";
import { TeacherRosterReadSection } from "./TeacherRosterReadSection";

const rosterUrl = "/api/teacher/classrooms/class-uuid/roster?page=1";
const importUrl = "/api/teacher/classrooms/class-uuid/roster/import";
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { "Content-Type": "application/json" },
});
const emptyRoster = { data: [], meta: { current_page: 1, last_page: 1, total: 0 } };
const importedRoster = {
  data: [{ id: "entry-1", orderNumber: 1, fullName: "Nguyễn An", studentCode: "HS0001", linkedUserId: null, status: "not_joined" }],
  meta: { current_page: 1, last_page: 1, total: 1 },
};

let root: Root;
let host: HTMLDivElement;

function excelFile(rows: unknown[][]): File {
  const book = utils.book_new();
  utils.book_append_sheet(book, utils.aoa_to_sheet(rows), "Roster");
  const buffer = write(book, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return { name: "roster.xlsx", size: buffer.byteLength, arrayBuffer: async () => buffer } as File;
}

function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === label);
  if (!found) throw new Error(`Button not found: ${label}`);
  return found;
}

function importCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([url, init]) => url === importUrl && init?.method === "POST");
}

async function selectFile(rows: unknown[][]) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("File input not found");
  Object.defineProperty(input, "files", { configurable: true, value: [excelFile(rows)] });
  await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); });
  for (let attempt = 0; attempt < 20 && document.querySelector('[role="dialog"]')?.textContent?.includes("Đang đọc file"); attempt += 1) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
  }
  expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain("Đang đọc file");
}

async function openValidPreview() {
  await act(async () => { button("Nhập danh sách Excel").click(); });
  await selectFile([["STT", "Họ và tên", "Mã học sinh"], [1, "Nguyễn An", "HS0001"]]);
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain("HS0001");
  await act(async () => { button("Kiểm tra và xác nhận 1 học sinh").click(); });
  expect(document.querySelector('[role="dialog"] [role="status"]')).not.toBeNull();
}

describe("backend Excel roster import interaction", () => {
  beforeEach(() => {
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

  async function renderSection(fetchMock: ReturnType<typeof vi.fn>) {
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => { root.render(<TeacherRosterReadSection classroomId="class-uuid" classroomName="10A1" archived={false} />); });
    expect(button("Nhập danh sách Excel")).toBeTruthy();
  }

  it("sends one POST during repeated same-batch confirms and shows one API-confirmed success", async () => {
    let resolveImport: (response: Response) => void = () => {};
    const pendingImport = new Promise<Response>((resolve) => { resolveImport = resolve; });
    let imported = false;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === rosterUrl && init?.method === "GET") return Promise.resolve(json(imported ? importedRoster : emptyRoster));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === importUrl && init?.method === "POST") return pendingImport;
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    await renderSection(fetchMock);
    await openValidPreview();
    const confirm = button("Nhập 1 học sinh");
    await act(async () => { confirm.click(); confirm.click(); confirm.click(); });
    expect(importCalls(fetchMock)).toHaveLength(1);
    expect(JSON.parse(importCalls(fetchMock)[0][1].body)).toEqual({ rows: [{ orderNumber: 1, fullName: "Nguyễn An", studentCode: "HS0001" }] });
    expect(button("Đang nhập…").disabled).toBe(true);
    await act(async () => { button("Đang nhập…").click(); });
    expect(importCalls(fetchMock)).toHaveLength(1);
    expect(document.body.textContent).not.toContain("Đã nhập danh sách: thêm 1");

    imported = true;
    await act(async () => { resolveImport(json({ data: { created: 1, updated: 0 } })); });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.textContent?.match(/Đã nhập danh sách: thêm 1, cập nhật 0\./g)).toHaveLength(1);
    expect(document.body.textContent).toContain("HS0001");
    expect(document.body.textContent).toContain("Chưa liên kết tài khoản");
    expect(importCalls(fetchMock)).toHaveLength(1);
  });

  it("does not show false success on failure and permits one POST per retry", async () => {
    let attempts = 0;
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === rosterUrl && init?.method === "GET") return Promise.resolve(json(emptyRoster));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === importUrl && init?.method === "POST") {
        attempts += 1;
        return Promise.resolve(attempts === 1 ? json({ message: "Import failed" }, 500) : json({ data: { created: 1, updated: 0 } }));
      }
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    await renderSection(fetchMock);
    await openValidPreview();
    await act(async () => { button("Nhập 1 học sinh").click(); });
    expect(importCalls(fetchMock)).toHaveLength(1);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Import failed");
    expect(document.body.textContent).not.toContain("Đã nhập danh sách: thêm 1");
    await act(async () => { const confirm = button("Nhập 1 học sinh"); confirm.click(); confirm.click(); });
    expect(importCalls(fetchMock)).toHaveLength(2);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.textContent?.match(/Đã nhập danh sách: thêm 1, cập nhật 0\./g)).toHaveLength(1);
  });

  it("cancels before confirmation without POST and blocks invalid Excel rows", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url === rosterUrl && init?.method === "GET") return Promise.resolve(json(emptyRoster));
      throw new Error(`Unexpected request: ${init?.method} ${url}`);
    });
    await renderSection(fetchMock);
    await openValidPreview();
    await act(async () => { button("Hủy").click(); });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(importCalls(fetchMock)).toHaveLength(0);

    await act(async () => { button("Nhập danh sách Excel").click(); });
    await selectFile([["Họ và tên", "Mã học sinh"], ["An", ""], ["Bình", "A-01"], ["Chi", "a -01"]]);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Thiếu mã học sinh");
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("bị trùng");
    expect(button("Kiểm tra và xác nhận 3 học sinh").disabled).toBe(true);
    expect(importCalls(fetchMock)).toHaveLength(0);
  });
});
