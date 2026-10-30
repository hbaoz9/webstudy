// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeacherLessonsPage from "./TeacherLessonsPage";

const mocks = vi.hoisted(() => ({
  getLessons: vi.fn(), save: vi.fn(), publish: vi.fn(), withdraw: vi.fn(), classrooms: vi.fn(),
}));
vi.mock("../../service/api/lessons", () => ({
  getTeacherLessons: mocks.getLessons, saveTeacherLessonDraft: mocks.save,
  publishTeacherLesson: mocks.publish, withdrawTeacherLesson: mocks.withdraw,
}));
vi.mock("../../service/api/classrooms", () => ({ listTeacherClassrooms: mocks.classrooms }));
vi.mock("../../components/common/LessonBodyEditor", () => ({
  LessonBodyEditor: ({ value, onChange }: { value: string; onChange: (value: string, format: "markdown") => void }) =>
    <textarea aria-label="Bài soạn" value={value} onChange={event => onChange(event.target.value, "markdown")} />,
}));
vi.mock("../../components/common/LessonBody", () => ({ LessonBody: ({ value }: { value: string }) => <p>{value}</p> }));

const content = (body: string, status: "draft" | "published" = "draft") => ({
  lessonId: "geo10-kn-b07", objectives: [], keyPoints: [], explanation: body, sections: [], status, updatedAt: "2026-10-30T00:00:00Z",
});
const row = (draft: ReturnType<typeof content> | null, published: ReturnType<typeof content> | null = null, classroomIds: string[] = []) => ({
  id: "geo10-kn-b07", chapterId: "geo10-kn-c03", chapterNumber: 3, chapterTitle: "Trái Đất", partId: "geo10-kn-p02", partNumber: 2, partTitle: "Địa lí tự nhiên",
  number: 7, title: "Nội lực và ngoại lực", status: published ? "published" : draft ? "draft" : "uncreated",
  draftContent: draft, publishedContent: published, publishedAt: published ? "2026-10-30T00:00:00Z" : null, classroomIds,
});
const classes = [{ id: "class-1", name: "10A1", academicYear: "2026-2027", status: "active" }];
let host: HTMLDivElement;
let root: Root;

function button(label: string) {
  const result = [...document.querySelectorAll("button")].find(item => item.getAttribute("aria-label") === label || item.textContent?.trim() === label || item.textContent?.trim().endsWith(label));
  if (!result) throw new Error(`Missing button: ${label}`);
  return result as HTMLButtonElement;
}

async function renderPage() {
  const router = createMemoryRouter([{ path: "/teacher/lessons", element: <TeacherLessonsPage /> }], { initialEntries: ["/teacher/lessons?lesson=geo10-kn-b07"] });
  await act(async () => { root.render(<RouterProvider router={router} />); });
}

describe("Teacher Lessons server integration", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
    localStorage.clear();
    host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
    mocks.getLessons.mockResolvedValue([row(content("Original"))]);
    mocks.classrooms.mockResolvedValue(classes);
    mocks.save.mockImplementation(async (_id: string, value: ReturnType<typeof content>) => row(value));
    mocks.publish.mockResolvedValue(row(null, content("Changed", "published"), ["class-1"]));
    mocks.withdraw.mockResolvedValue(row(content("Changed")));
  });
  afterEach(async () => {
    await act(async () => { root.unmount(); }); host.remove(); localStorage.clear(); vi.clearAllMocks();
  });

  it("loads server content, saves a draft, publishes to a selected classroom and withdraws", async () => {
    await renderPage();
    const editor = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Bài soạn"]')!;
    expect(editor.value).toBe("Original");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(editor, "Changed");
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { button("Lưu nháp").click(); });
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.save.mock.calls[0][1].explanation).toBe("Changed");
    await act(async () => { button("Đăng cho học sinh").click(); });
    const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    await act(async () => { checkbox.click(); });
    await act(async () => { button("Xác nhận đăng").click(); });
    expect(mocks.publish).toHaveBeenCalledWith("geo10-kn-b07", ["class-1"]);
    await act(async () => { document.querySelector<HTMLElement>('summary[aria-label="Thêm thao tác bài học"]')?.click(); });
    await act(async () => { button("Gỡ đăng").click(); });
    await act(async () => { button("Xác nhận gỡ đăng").click(); });
    expect(mocks.withdraw).toHaveBeenCalledTimes(1);
  });

  it("never reads old local content as a server lesson when API fails", async () => {
    localStorage.setItem("webstudy-v1-geo10-lesson-content", JSON.stringify({ "geo10-kn-b07": content("Local only") }));
    mocks.getLessons.mockRejectedValueOnce(new Error("Server offline"));
    await renderPage();
    expect(document.body.textContent).toContain("Server offline");
    expect(document.body.textContent).not.toContain("Local only");
    expect(localStorage.getItem("webstudy-v1-geo10-lesson-content")).toContain("Local only");
    await act(async () => { button("Thử lại").click(); });
    expect(mocks.getLessons).toHaveBeenCalledTimes(2);
    expect(document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Bài soạn"]')?.value).toBe("Original");
  });

  it("locks duplicate draft submissions and allows retry after an API error", async () => {
    let rejectSave: (reason: Error) => void = () => {};
    mocks.save.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectSave = reject; }));
    await renderPage();
    const editor = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Bài soạn"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(editor, "Changed");
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => { button("Lưu nháp").click(); button("Lưu nháp").click(); });
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(button("Lưu nháp").disabled).toBe(true);
    await act(async () => { rejectSave(new Error("Lưu thất bại")); });
    expect(document.body.textContent).toContain("Lưu thất bại");
    expect(button("Lưu nháp").disabled).toBe(false);
    await act(async () => { button("Lưu nháp").click(); });
    expect(mocks.save).toHaveBeenCalledTimes(2);
  });

  it("keeps the published snapshot while editing a draft and locks duplicate publish requests", async () => {
    mocks.getLessons.mockResolvedValueOnce([row(content("Draft text"), content("Published text", "published"), ["class-1"])]);
    let rejectPublish: (reason: Error) => void = () => {};
    mocks.publish.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectPublish = reject; }));
    await renderPage();
    expect(document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Bài soạn"]')?.value).toBe("Draft text");
    await act(async () => { button("Cập nhật bài đăng").click(); });
    expect(document.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true);
    act(() => { button("Xác nhận cập nhật").click(); button("Xác nhận cập nhật").click(); });
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    expect(button("Xác nhận cập nhật").disabled).toBe(true);
    await act(async () => { rejectPublish(new Error("Không thể đăng")); });
    expect(document.body.textContent).toContain("Không thể đăng");
    expect(document.body.textContent).not.toContain("Đã đăng bài học.");
    await act(async () => { button("Xác nhận cập nhật").click(); });
    expect(mocks.publish).toHaveBeenCalledTimes(2);
  });
});
