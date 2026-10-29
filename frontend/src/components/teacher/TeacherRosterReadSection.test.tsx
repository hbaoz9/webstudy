// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { utils, write } from "xlsx";
import { TeacherRosterReadSection } from "./TeacherRosterReadSection";

const rosterPath = "/api/teacher/classrooms/class-uuid/roster";
const importPath = `${rosterPath}/import`;
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { "Content-Type": "application/json" },
});
const entry = (id: string, status: "joined" | "not_joined" | "conflict" = "not_joined") => ({
  id, orderNumber: 1, fullName: id, studentCode: id, linkedUserId: status === "joined" ? 9 : null, status,
});
const roster = (data: ReturnType<typeof entry>[], total = data.length, page = 1, lastPage = 1) => ({
  data, meta: { current_page: page, last_page: lastPage, total },
});
const query = (url: string) => new URL(url, "http://localhost").searchParams;
const rosterGets = (mock: ReturnType<typeof vi.fn>) => mock.mock.calls.filter(([url, init]) => url.startsWith(`${rosterPath}?`) && init?.method === "GET");
const imports = (mock: ReturnType<typeof vi.fn>) => mock.mock.calls.filter(([url, init]) => url === importPath && init?.method === "POST");
const pending = () => {
  let resolve: (response: Response) => void = () => {};
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
};

let root: Root;
let host: HTMLDivElement;

function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === label);
  if (!found) throw new Error(`Button not found: ${label}`);
  return found;
}

async function search(value: string) {
  const input = document.querySelector<HTMLInputElement>('input[type="search"]');
  if (!input) throw new Error("Search input not found");
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function settleDebounce() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });
}

async function filter(status: string) {
  const select = document.querySelector<HTMLSelectElement>("select");
  if (!select) throw new Error("Status select not found");
  await act(async () => {
    select.value = status;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function selectExcel() {
  const book = utils.book_new();
  utils.book_append_sheet(book, utils.aoa_to_sheet([["STT", "Họ và tên", "Mã học sinh"], [1, "Excel Preview", "HS0001"]]), "Roster");
  const buffer = write(book, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const file = { name: "roster.xlsx", size: buffer.byteLength, arrayBuffer: async () => buffer } as File;
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("Excel input not found");
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); });
  for (let i = 0; i < 20 && document.querySelector('[role="dialog"]')?.textContent?.includes("Đang đọc file"); i += 1) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
  }
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Excel Preview");
}

describe("teacher roster read interactions", () => {
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

  async function render(mock: ReturnType<typeof vi.fn>, archived = false, classroomId = "class-uuid") {
    vi.stubGlobal("fetch", mock);
    await act(async () => { root.render(<TeacherRosterReadSection classroomId={classroomId} classroomName="10A1" archived={archived} />); });
  }

  it("shows loading then genuine empty state, and keeps archived roster read only", async () => {
    const initial = pending();
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${rosterPath}?page=1` && init?.method === "GET") return initial.promise;
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    vi.stubGlobal("fetch", mock);
    await act(async () => { root.render(<TeacherRosterReadSection classroomId="class-uuid" classroomName="10A1" archived />); });
    expect(document.body.textContent).toContain("Đang tải danh sách học sinh");
    expect(document.body.textContent).not.toContain("Nhập danh sách Excel");
    await act(async () => { initial.resolve(json(roster([]))); });
    expect(document.body.textContent).toContain("Chưa có danh sách đối chiếu");
    expect(document.body.textContent).toContain("Danh sách lịch sử chỉ có thể xem");
    expect(document.body.textContent).not.toContain("Nhập danh sách Excel");
    expect(rosterGets(mock)).toHaveLength(1);
  });

  it("debounces consecutive search edits and requests only the final term", async () => {
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url.startsWith(`${rosterPath}?`) && init?.method === "GET") return Promise.resolve(json(roster([entry("HS0001")], 150, 1, 2)));
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock);
    await search("H");
    await search("HS");
    await search("HS0150");
    expect(rosterGets(mock)).toHaveLength(1);
    expect(document.body.textContent).toContain("Đang tải danh sách học sinh");
    await settleDebounce();
    expect(rosterGets(mock)).toHaveLength(2);
    expect(query(rosterGets(mock)[1][0]).get("search")).toBe("HS0150");
    expect(query(rosterGets(mock)[1][0]).get("page")).toBe("1");
  });

  it("ignores an older search response that finishes after the latest response", async () => {
    const old = pending();
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url.startsWith(`${rosterPath}?`) && init?.method === "GET") {
        const term = query(url).get("search");
        return term === "HS10" ? old.promise : Promise.resolve(json(roster([entry(term === "HS1001" ? "HS1001" : "initial")], 2)));
      }
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock);
    await search("HS10");
    await settleDebounce();
    expect(rosterGets(mock).map(([url]) => query(url).get("search"))).toEqual([null, "HS10"]);
    await search("HS1001");
    await settleDebounce();
    expect(document.querySelector("tbody")?.textContent).toContain("HS1001");
    await act(async () => { old.resolve(json(roster([entry("STALE-HS10")], 2))); });
    expect(document.querySelector("tbody")?.textContent).toContain("HS1001");
    expect(document.querySelector("tbody")?.textContent).not.toContain("STALE-HS10");
  });

  it("ignores pending old filter and classroom responses when search, status, or class changes", async () => {
    const old = pending();
    const oldClassAfterSwitch = pending();
    const otherClass = pending();
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method !== "GET") throw new Error(`Unexpected ${init?.method} ${url}`);
      if (url.startsWith("/api/teacher/classrooms/other-class/roster?")) return otherClass.promise;
      if (url.startsWith(`${rosterPath}?`)) {
        const params = query(url);
        if (params.get("status") === "joined") return old.promise;
        if (params.get("status") === "not_joined") return oldClassAfterSwitch.promise;
        if (params.get("status") === "conflict") return Promise.resolve(json(roster([entry("LATEST", "conflict")], 1)));
        return Promise.resolve(json(roster([entry("INITIAL")], 2)));
      }
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock);
    await filter("joined");
    await search("HS");
    await settleDebounce();
    await filter("conflict");
    expect(query(rosterGets(mock).at(-1)![0]).get("search")).toBe("HS");
    expect(query(rosterGets(mock).at(-1)![0]).get("status")).toBe("conflict");
    expect(document.querySelector("tbody")?.textContent).toContain("LATEST");
    await act(async () => { old.resolve(json(roster([entry("OLD-CLASS-ROW", "joined")], 1))); });
    expect(document.querySelector("tbody")?.textContent).not.toContain("OLD-CLASS-ROW");

    await filter("not_joined");
    await act(async () => { root.render(<TeacherRosterReadSection classroomId="other-class" classroomName="10A2" archived={false} />); });
    expect(document.querySelector("tbody")).toBeNull();
    await act(async () => { otherClass.resolve(json(roster([entry("OTHER-CLASS")], 1))); });
    expect(document.querySelector("tbody")?.textContent).toContain("OTHER-CLASS");
    await act(async () => { oldClassAfterSwitch.resolve(json(roster([entry("FOREIGN-STALE")], 1))); });
    expect(document.querySelector("tbody")?.textContent).not.toContain("FOREIGN-STALE");
    expect(document.querySelector("tbody")?.textContent).not.toContain("LATEST");
  });

  it("uses backend meta.total, retains conditions across pages, and resets page for search and every status", async () => {
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url.startsWith(`${rosterPath}?`) && init?.method === "GET") {
        const params = query(url);
        const page = Number(params.get("page"));
        return Promise.resolve(json(roster([entry(`ROW-${page}`, params.get("status") === "conflict" ? "conflict" : "joined")], 150, page, 2)));
      }
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock);
    expect(document.body.textContent).toContain("Danh sách: 150");
    expect(document.querySelectorAll("tbody tr")).toHaveLength(1);
    await act(async () => { button("Trang sau").click(); });
    expect(query(rosterGets(mock).at(-1)![0]).get("page")).toBe("2");
    expect(document.querySelector("tbody")?.textContent).toContain("ROW-2");
    await search("HS0150");
    await settleDebounce();
    expect([...query(rosterGets(mock).at(-1)![0]).entries()]).toEqual([["page", "1"], ["search", "HS0150"]]);
    expect(document.body.textContent).toContain("Kết quả: 150");
    for (const status of ["joined", "not_joined", "conflict"]) {
      await act(async () => { button("Trang sau").click(); });
      await filter(status);
      expect([...query(rosterGets(mock).at(-1)![0]).entries()]).toEqual([["page", "1"], ["search", "HS0150"], ["status", status]]);
    }
    await act(async () => { button("Trang sau").click(); });
    expect([...query(rosterGets(mock).at(-1)![0]).entries()]).toEqual([["page", "2"], ["search", "HS0150"], ["status", "conflict"]]);
    expect(document.body.textContent).toContain("Xung đột");
    expect(document.body.textContent).not.toContain("Đã tham gia lớp");
  });

  it("distinguishes no search results from an empty roster and clears the filters", async () => {
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url.startsWith(`${rosterPath}?`) && init?.method === "GET") return Promise.resolve(json(query(url).has("search") ? roster([]) : roster([entry("INITIAL")], 1)));
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock);
    await search("missing");
    await settleDebounce();
    expect(document.body.textContent).toContain("Không tìm thấy học sinh");
    expect(document.body.textContent).not.toContain("Chưa có danh sách đối chiếu");
    expect(document.querySelector("tbody")).toBeNull();
    await act(async () => { button("Xóa bộ lọc").click(); });
    expect(query(rosterGets(mock).at(-1)![0]).has("search")).toBe(false);
    expect(document.querySelector("tbody")?.textContent).toContain("INITIAL");
  });

  it.each([401, 403, 404, 500])("shows HTTP %i error and retries GET without prototype fallback", async (status) => {
    let calls = 0;
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url.startsWith(`${rosterPath}?`) && init?.method === "GET") {
        calls += 1;
        return Promise.resolve(calls === 1 ? json({ message: "Request failed" }, status) : json(roster([entry("RETRIED")], 1)));
      }
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock);
    expect(document.querySelector('[role="alert"]')).not.toBeNull();
    expect(document.body.textContent).not.toContain("RETRIED");
    await act(async () => { button("Thử lại").click(); });
    expect(rosterGets(mock)).toHaveLength(2);
    expect(document.querySelector("tbody")?.textContent).toContain("RETRIED");
  });

  it("shows a network error and retries with a fresh GET", async () => {
    let calls = 0;
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url.startsWith(`${rosterPath}?`) && init?.method === "GET") {
        calls += 1;
        return calls === 1 ? Promise.reject(new TypeError("offline")) : Promise.resolve(json(roster([entry("AFTER-RETRY")], 1)));
      }
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Không thể kết nối máy chủ");
    expect(document.querySelector("tbody")).toBeNull();
    await act(async () => { button("Thử lại").click(); });
    expect(rosterGets(mock)).toHaveLength(2);
    expect(document.querySelector("tbody")?.textContent).toContain("AFTER-RETRY");
  });

  it("refetches GET after successful Excel import and never constructs rows or totals from POST counts", async () => {
    let getCount = 0;
    const post = pending();
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${rosterPath}?page=1` && init?.method === "GET") {
        getCount += 1;
        return Promise.resolve(json(getCount === 1 ? roster([entry("BEFORE")], 1) : roster([entry("BEFORE"), entry("FROM-GET")], 42)));
      }
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === importPath && init?.method === "POST") return post.promise;
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock);
    await act(async () => { button("Nhập danh sách Excel").click(); });
    await selectExcel();
    await act(async () => { button("Kiểm tra và xác nhận 1 học sinh").click(); });
    await act(async () => { button("Nhập 1 học sinh").click(); });
    expect(imports(mock)).toHaveLength(1);
    expect(rosterGets(mock)).toHaveLength(1);
    expect(document.querySelector("tbody")?.textContent).not.toContain("Excel Preview");
    await act(async () => { post.resolve(json({ data: { created: 9, updated: 0 } })); });
    expect(rosterGets(mock)).toHaveLength(2);
    expect(document.querySelector("tbody")?.textContent).toContain("FROM-GET");
    expect(document.querySelector("tbody")?.textContent).not.toContain("Excel Preview");
    expect(document.body.textContent).toContain("Danh sách: 42");
    expect(document.body.textContent).toContain("Đã nhập danh sách: thêm 9, cập nhật 0.");
  });

  it("leaves GET roster unchanged after a failed import", async () => {
    const mock = vi.fn((url: string, init?: RequestInit) => {
      if (url === `${rosterPath}?page=1` && init?.method === "GET") return Promise.resolve(json(roster([entry("SERVER-ROW")], 1)));
      if (url === "/sanctum/csrf-cookie") return Promise.resolve(new Response(null, { status: 204 }));
      if (url === importPath && init?.method === "POST") return Promise.resolve(json({ message: "Import failed" }, 500));
      throw new Error(`Unexpected ${init?.method} ${url}`);
    });
    await render(mock);
    await act(async () => { button("Nhập danh sách Excel").click(); });
    await selectExcel();
    await act(async () => { button("Kiểm tra và xác nhận 1 học sinh").click(); });
    await act(async () => { button("Nhập 1 học sinh").click(); });
    expect(imports(mock)).toHaveLength(1);
    expect(rosterGets(mock)).toHaveLength(1);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Import failed");
    expect(document.querySelector("tbody")?.textContent).toContain("SERVER-ROW");
    expect(document.body.textContent).not.toContain("Đã nhập danh sách: thêm");
  });
});
