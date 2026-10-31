// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudentLessonsPage from "./StudentLessonsPage";
import type { StudentLessonDetail, StudentLessonSummary } from "../../service/api/lessons";

let userId = "student-1";
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ session: { userId, role: "student" }, status: "ready" }) }));
vi.mock("../../contexts/StudentAccountContext", () => ({ useStudentAccount: () => ({ student: { id: "student-1" }, hasStudentProfile: true }) }));
vi.mock("../../contexts/TeacherAssignmentsContext", () => ({ useTeacherAssignments: () => ({ assignments: [], submissions: [], submissionStorageStatus: "saved" }) }));
vi.mock("../../contexts/TeacherQuestionsContext", () => ({ useTeacherQuestions: () => ({ questions: [] }) }));
vi.mock("../../hooks/useStudentClassMemberships", () => ({ useStudentClassMemberships: () => ({ memberships: [] }) }));

const first: StudentLessonSummary = {
  id: "geo10-kn-b07", number: 7, title: "Động đất", chapterId: "geo10-kn-c03", chapterNumber: 3,
  chapterTitle: "Thạch quyển", partId: "geo10-kn-p02", partNumber: 2, partTitle: "Địa lí tự nhiên",
  publishedAt: "2026-10-31T08:00:00Z",
};
const second: StudentLessonSummary = {
  id: "geo10-kn-b12", number: 12, title: "Khí hậu", chapterId: "geo10-kn-c04", chapterNumber: 4,
  chapterTitle: "Khí quyển", partId: "geo10-kn-p02", partNumber: 2, partTitle: "Địa lí tự nhiên",
  publishedAt: "2026-10-31T09:00:00Z",
};
const third: StudentLessonSummary = {
  id: "geo10-kn-b25", number: 25, title: "Dân số", chapterId: "geo10-kn-c08", chapterNumber: 8,
  chapterTitle: "Địa lí dân cư", partId: "geo10-kn-p03", partNumber: 3, partTitle: "Địa lí kinh tế",
  publishedAt: "2026-10-31T10:00:00Z",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const detail = (lesson: StudentLessonSummary, explanation = "Nội dung từ Backend"): StudentLessonDetail => ({
  ...lesson,
  content: { lessonId: lesson.id, objectives: [], keyPoints: [], explanation,
    explanationFormat: "markdown", sections: [], status: "published", updatedAt: "2026-10-31T08:00:00Z" },
});

let root: Root;
let host: HTMLDivElement;
const listUrl = "/api/student/lessons";
const detailUrl = (id: string) => `${listUrl}/${id}`;
const calls = (fetchMock: ReturnType<typeof vi.fn>) => fetchMock.mock.calls.map(([url]) => url);
const button = (label: string) => [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === label)!;

async function renderPage(url = "/student/lessons") {
  await act(async () => { root.render(<MemoryRouter initialEntries={[url]}><StudentLessonsPage /></MemoryRouter>); });
}

describe("Student Lessons list with Laravel API mock", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    userId = "student-1";
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
  });
  afterEach(async () => {
    await act(async () => { root.unmount(); });
    host.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows loading, then only API lessons grouped by server part and chapter", async () => {
    let resolve: (response: Response) => void = () => {};
    const pending = new Promise<Response>((done) => { resolve = done; });
    const fetchMock = vi.fn((url: string) => url === listUrl ? pending : Promise.resolve(json({ data: detail(first) })));
    vi.stubGlobal("fetch", fetchMock);
    await renderPage();
    expect(document.body.textContent).toContain("Đang tải danh sách bài học");
    expect(document.body.textContent).not.toContain("Bài 7. Động đất");
    await act(async () => { resolve(json({ data: [first, second, third] })); });
    expect(calls(fetchMock)).toEqual([listUrl, detailUrl(first.id)]);
    expect(document.body.textContent).toContain("Phần 2. Địa lí tự nhiên");
    expect(document.body.textContent).toContain("Phần 3. Địa lí kinh tế");
    expect(document.body.textContent).toContain("Chương 3. Thạch quyển");
    expect(document.body.textContent).toContain("Chương 4. Khí quyển");
    expect(document.querySelectorAll('button[aria-current="page"]')).toHaveLength(1);
    expect(document.body.textContent).not.toContain("Bài 1.");
    expect(document.body.textContent).toContain("Nội dung từ Backend");
  });

  it("uses API search and a string curriculum ID without reading local lesson content", async () => {
    localStorage.setItem("webstudy-v1-geo10-lesson-content", JSON.stringify({ [first.id]: { explanation: "Private prototype content", status: "published" } }));
    const storageRead = vi.spyOn(Storage.prototype, "getItem");
    const fetchMock = vi.fn((url: string) => Promise.resolve(json(url === listUrl ? { data: [first, second] } : { data: detail(first) })));
    vi.stubGlobal("fetch", fetchMock);
    await renderPage();
    const field = document.querySelector<HTMLInputElement>('input[type="search"]')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => { setter?.call(field, "Khí hậu"); field.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(document.body.textContent).toContain("1 bài phù hợp");
    expect(document.body.textContent).toContain("Bài 12. Khí hậu");
    expect(document.body.textContent).not.toContain("Private prototype content");
    expect(storageRead).not.toHaveBeenCalled();
    expect(calls(fetchMock)).toEqual([listUrl, detailUrl(first.id)]);
    localStorage.removeItem("webstudy-v1-geo10-lesson-content");
  });

  it("shows empty API data without a prototype fallback", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(json({ data: [] })));
    vi.stubGlobal("fetch", fetchMock);
    await renderPage();
    expect(document.body.textContent).toContain("Chưa có bài học nào được phân phối");
    expect(calls(fetchMock)).toEqual([listUrl]);
  });

  it("shows an API error separately and retries without local fallback", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("offline"))
      .mockImplementation((url: string) => Promise.resolve(json(url === listUrl ? { data: [first] } : { data: detail(first) })));
    vi.stubGlobal("fetch", fetchMock);
    await renderPage();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Không thể tải danh sách bài học");
    expect(document.body.textContent).not.toContain("Chưa có bài học nào được phân phối");
    const retry = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Thử lại")!;
    await act(async () => { retry.click(); });
    expect(calls(fetchMock)).toEqual([listUrl, listUrl, detailUrl(first.id)]);
    expect(document.body.textContent).toContain("Bài 7. Động đất");
  });

  it("does not select an unauthorized lesson from the URL or request detail", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(json({ data: [first] })));
    vi.stubGlobal("fetch", fetchMock);
    await renderPage("/student/lessons?lesson=geo10-kn-b40");
    expect(document.body.textContent).toContain("Bài học này không khả dụng");
    expect(document.querySelector('[aria-current="page"]')).toBeNull();
    expect(calls(fetchMock)).toEqual([listUrl]);
  });

  it("hides previous account data and ignores its late response", async () => {
    let resolveOld: (response: Response) => void = () => {};
    let resolveNew: (response: Response) => void = () => {};
    const oldPending = new Promise<Response>((done) => { resolveOld = done; });
    const newPending = new Promise<Response>((done) => { resolveNew = done; });
    const fetchMock = vi.fn().mockImplementationOnce(() => oldPending).mockImplementationOnce(() => newPending)
      .mockImplementation(() => Promise.resolve(json({ data: detail(second) })));
    vi.stubGlobal("fetch", fetchMock);
    await renderPage();
    userId = "student-2";
    await act(async () => { root.render(<MemoryRouter><StudentLessonsPage /></MemoryRouter>); });
    expect(document.body.textContent).toContain("Đang tải danh sách bài học");
    await act(async () => { resolveNew(json({ data: [second] })); });
    expect(document.body.textContent).toContain("Bài 12. Khí hậu");
    await act(async () => { resolveOld(json({ data: [first] })); });
    expect(document.body.textContent).not.toContain("Bài 7. Động đất");
    expect(calls(fetchMock)).toEqual([listUrl, listUrl, detailUrl(second.id)]);
  });

  it("loads the selected string ID and renders the published Markdown and sections in order", async () => {
    const snapshot = detail(first, "**Bản đã công bố**\n\n![Bản đồ](https://example.com/map.png)");
    snapshot.content.sections = [
      { id: "s1", title: "Khái niệm", content: "Nội dung mục một", keyPoints: ["Ý chính một"] },
      { id: "s2", title: "Ví dụ", content: "Nội dung mục hai", keyPoints: [], imageUrl: "https://example.com/earth.png", imageCaption: "Trái Đất" },
    ];
    const fetchMock = vi.fn((url: string) => Promise.resolve(json(url === listUrl ? { data: [first, second] } : { data: snapshot })));
    vi.stubGlobal("fetch", fetchMock);
    await renderPage(`/student/lessons?lesson=${first.id}`);
    expect(calls(fetchMock)).toEqual([listUrl, detailUrl(first.id)]);
    expect(document.querySelector("strong")?.textContent).toBe("Bản đã công bố");
    const text = document.body.textContent ?? "";
    expect(text.indexOf("Mục 1. Khái niệm")).toBeLessThan(text.indexOf("Mục 2. Ví dụ"));
    expect(text).toContain("Ý chính một");
    expect(document.querySelector('img[src="https://example.com/map.png"]')).not.toBeNull();
    expect(document.querySelector('img[src="https://example.com/earth.png"]')).not.toBeNull();
    expect(document.querySelector('a[href^="/student/assignments"]')).toBeNull();
    expect(document.querySelector('a[href^="/student/videos"]')).toBeNull();
    expect(calls(fetchMock).some((url: string) => url.includes("/teacher/lessons"))).toBe(false);
  });

  it("shows detail loading, then a 404 without switching lessons or reading prototype storage", async () => {
    let resolve: (response: Response) => void = () => {};
    const pending = new Promise<Response>((done) => { resolve = done; });
    const storageRead = vi.spyOn(Storage.prototype, "getItem");
    const fetchMock = vi.fn((url: string) => url === listUrl ? Promise.resolve(json({ data: [first, second] })) : pending);
    vi.stubGlobal("fetch", fetchMock);
    await renderPage();
    expect(document.body.textContent).toContain("Đang tải nội dung bài học");
    expect(document.body.textContent).not.toContain("Nội dung từ Backend");
    await act(async () => { resolve(json({ message: "Not found" }, 404)); });
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("không còn khả dụng");
    expect(document.querySelector('button[aria-current="page"]')?.textContent).toContain("Bài 7");
    expect(calls(fetchMock)).toEqual([listUrl, detailUrl(first.id)]);
    expect(storageRead).not.toHaveBeenCalled();
  });

  it("retries a network failure for the same lesson and accepts an empty snapshot", async () => {
    const empty = detail(first, "");
    const fetchMock = vi.fn().mockImplementationOnce(() => Promise.resolve(json({ data: [first] })))
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockImplementation(() => Promise.resolve(json({ data: empty })));
    vi.stubGlobal("fetch", fetchMock);
    await renderPage();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Không thể tải nội dung bài học");
    await act(async () => { button("Thử lại").click(); });
    expect(calls(fetchMock)).toEqual([listUrl, detailUrl(first.id), detailUrl(first.id)]);
    expect(document.body.textContent).toContain("chưa có nội dung để hiển thị");
    expect(document.body.textContent).not.toContain("Nội dung từ Backend");
  });

  it("ignores an older lesson response after selecting another lesson", async () => {
    let resolveOld: (response: Response) => void = () => {};
    const oldPending = new Promise<Response>((done) => { resolveOld = done; });
    const fetchMock = vi.fn((url: string) => url === listUrl ? Promise.resolve(json({ data: [first, second] }))
      : url === detailUrl(first.id) ? oldPending : Promise.resolve(json({ data: detail(second, "Snapshot B") })));
    vi.stubGlobal("fetch", fetchMock);
    await renderPage();
    const chapter = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("Chương 4. Khí quyển"))!;
    await act(async () => { chapter.click(); });
    await act(async () => { button("Bài 12. Khí hậu").click(); });
    expect(document.body.textContent).toContain("Snapshot B");
    await act(async () => { resolveOld(json({ data: detail(first, "Stale A") })); });
    expect(document.body.textContent).not.toContain("Stale A");
    expect(calls(fetchMock)).toEqual([listUrl, detailUrl(first.id), detailUrl(second.id)]);
  });

  it("removes a previous snapshot when the newly selected lesson returns 404", async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(url === listUrl ? json({ data: [first, second] })
      : url === detailUrl(first.id) ? json({ data: detail(first, "Old snapshot") })
        : json({ message: "Not found" }, 404)));
    vi.stubGlobal("fetch", fetchMock);
    await renderPage();
    expect(document.body.textContent).toContain("Old snapshot");
    const chapter = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("Chương 4. Khí quyển"))!;
    await act(async () => { chapter.click(); });
    await act(async () => { button("Bài 12. Khí hậu").click(); });
    expect(document.body.textContent).not.toContain("Old snapshot");
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("không còn khả dụng");
    expect(calls(fetchMock)).toEqual([listUrl, detailUrl(first.id), detailUrl(second.id)]);
  });

  it("hides an old account snapshot immediately and does not reuse it after a new list omits the lesson", async () => {
    let resolveNewList: (response: Response) => void = () => {};
    const newListPending = new Promise<Response>((done) => { resolveNewList = done; });
    const fetchMock = vi.fn().mockImplementationOnce(() => Promise.resolve(json({ data: [first] })))
      .mockImplementationOnce(() => Promise.resolve(json({ data: detail(first, "Private A") })))
      .mockImplementationOnce(() => newListPending);
    vi.stubGlobal("fetch", fetchMock);
    await renderPage(`/student/lessons?lesson=${first.id}`);
    expect(document.body.textContent).toContain("Private A");
    userId = "student-2";
    await act(async () => { root.render(<MemoryRouter initialEntries={[`/student/lessons?lesson=${first.id}`]}><StudentLessonsPage /></MemoryRouter>); });
    expect(document.body.textContent).not.toContain("Private A");
    expect(document.body.textContent).toContain("Đang tải danh sách bài học");
    await act(async () => { resolveNewList(json({ data: [second] })); });
    expect(document.body.textContent).toContain("Bài học này không khả dụng");
    expect(calls(fetchMock)).toEqual([listUrl, detailUrl(first.id), listUrl]);
  });

  it("ignores an old account detail response even when the new account can open the same lesson ID", async () => {
    let resolveOld: (response: Response) => void = () => {};
    const oldPending = new Promise<Response>((done) => { resolveOld = done; });
    const fetchMock = vi.fn().mockImplementationOnce(() => Promise.resolve(json({ data: [first] })))
      .mockImplementationOnce(() => oldPending)
      .mockImplementationOnce(() => Promise.resolve(json({ data: [first] })))
      .mockImplementationOnce(() => Promise.resolve(json({ data: detail(first, "New account snapshot") })));
    vi.stubGlobal("fetch", fetchMock);
    await renderPage();
    expect(document.body.textContent).toContain("Đang tải nội dung bài học");
    userId = "student-2";
    await act(async () => { root.render(<MemoryRouter><StudentLessonsPage /></MemoryRouter>); });
    expect(document.body.textContent).toContain("New account snapshot");
    await act(async () => { resolveOld(json({ data: detail(first, "Private old snapshot") })); });
    expect(document.body.textContent).not.toContain("Private old snapshot");
    expect(calls(fetchMock)).toEqual([listUrl, detailUrl(first.id), listUrl, detailUrl(first.id)]);
  });

  it.each([
    [401, "Phiên đăng nhập đã hết hạn"],
    [403, "không có quyền xem bài học"],
  ])("shows a distinct %i detail error without losing the loaded list", async (status, message) => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(url === listUrl
      ? json({ data: [first] }) : json({ message: "Denied" }, status)));
    vi.stubGlobal("fetch", fetchMock);
    await renderPage();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(message);
    expect(document.body.textContent).toContain("Danh sách bài học");
    expect(document.body.textContent).toContain("Bài 7. Động đất");
    expect(calls(fetchMock)).toEqual([listUrl, detailUrl(first.id)]);
  });

  it("retries only the newly selected lesson after an older detail failed", async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(url === listUrl ? json({ data: [first, second] })
      : url === detailUrl(first.id) ? json({ message: "Not found" }, 404)
        : json({ data: detail(second, "Current B") })));
    vi.stubGlobal("fetch", fetchMock);
    await renderPage();
    expect(document.querySelector('[role="alert"]')).not.toBeNull();
    const chapter = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("Chương 4. Khí quyển"))!;
    await act(async () => { chapter.click(); });
    await act(async () => { button("Bài 12. Khí hậu").click(); });
    expect(document.body.textContent).toContain("Current B");
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(calls(fetchMock)).toEqual([listUrl, detailUrl(first.id), detailUrl(second.id)]);
  });

  it("ignores a detail response after unmount", async () => {
    let resolve: (response: Response) => void = () => {};
    const pending = new Promise<Response>((done) => { resolve = done; });
    const fetchMock = vi.fn((url: string) => url === listUrl ? Promise.resolve(json({ data: [first] })) : pending);
    vi.stubGlobal("fetch", fetchMock);
    await renderPage();
    await act(async () => { root.unmount(); });
    await act(async () => { resolve(json({ data: detail(first, "Late snapshot") })); });
    expect(host.textContent).toBe("");
    root = createRoot(host);
  });
});
