// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeacherCreateQuestionPage from "./TeacherCreateQuestionPage";
import { ApiError } from "../../service/api/client";
import { compressCoverImage } from "../../utils/imageCompression";

const getQuestion = vi.fn();
const addQuestion = vi.fn();
const updateQuestion = vi.fn();
const essay = { id: "uuid-1", version: 3, type: "essay_text", lessonId: "geo10-kn-b07", chapterId: "geo10-kn-c03", difficulty: "recognition", content: "Explain a river", rubricText: "Criteria", showInLesson: false, createdAt: "2026-11-05T00:00:00Z", updatedAt: "2026-11-05T00:00:00Z" };
vi.mock("../../contexts/TeacherQuestionsContext", () => ({ useTeacherQuestions: () => ({ getQuestion, addQuestion, updateQuestion }) }));
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ session: { userId: "teacher-a", role: "teacher" } }) }));
vi.mock("../../utils/imageCompression", () => ({ compressCoverImage: vi.fn().mockResolvedValue("data:image/png;base64,AAAA") }));

let root: Root;
let host: HTMLDivElement;
async function render(path: string) {
  await act(async () => { root.render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/teacher/questions/new" element={<TeacherCreateQuestionPage />} /><Route path="/teacher/questions/:questionId/edit" element={<TeacherCreateQuestionPage />} /><Route path="/teacher/questions" element={<p>Bank list</p>} /></Routes></MemoryRouter>); });
}
function change(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.dispatchEvent(new Event("input", { bubbles: true }));
}
async function submit() {
  await act(async () => {
    host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
}
async function prepare(type: string, content = "Question content") {
  await render("/teacher/questions/new");
  const selects = [...host.querySelectorAll("select")];
  await act(async () => { change(selects[0], type); change(selects[1], "geo10-kn-b07"); if (content) change(host.querySelector("textarea")!, content); });
}

describe("Teacher Question editor API integration", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

  it("loads a direct edit URL from backend and displays private essay rubric", async () => {
    getQuestion.mockResolvedValue(essay);
    await render("/teacher/questions/uuid-1/edit");
    expect(getQuestion).toHaveBeenCalledWith("uuid-1");
    expect((host.querySelector('textarea[value]') as HTMLTextAreaElement | null)?.value ?? host.textContent).toBeTruthy();
    expect(host.textContent).toContain("Tiêu chí chấm");
    expect([...host.querySelectorAll("textarea")].some((item) => item.value === "Criteria")).toBe(true);
  });

  it("offers essay text without sending a grading score", async () => {
    addQuestion.mockResolvedValue({ id: "uuid-new", version: 1 });
    await render("/teacher/questions/new");
    const selects = [...host.querySelectorAll("select")];
    await act(async () => { change(selects[0], "essay_text"); change(selects[1], "geo10-kn-b07"); });
    const content = host.querySelector("textarea")!;
    await act(async () => { change(content, "Describe the climate"); });
    await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(addQuestion).toHaveBeenCalledWith(expect.objectContaining({ type: "essay_text", lessonId: "geo10-kn-b07", content: "Describe the climate" }));
    expect(JSON.stringify(addQuestion.mock.calls[0][0])).not.toMatch(/maxPoints|score/);
  });

  it.each([4999, 5000, 5001])("validates %i trimmed Unicode characters before saving", async (length) => {
    addQuestion.mockResolvedValue({ id: "uuid-new", version: 1 });
    const content = `  ${"🌍".repeat(length)}  `;
    await prepare("essay_text", content);
    await submit();
    if (length <= 5000) {
      expect(addQuestion).toHaveBeenCalledWith(expect.objectContaining({ content: "🌍".repeat(length) }));
    } else {
      expect(addQuestion).not.toHaveBeenCalled();
      expect(host.textContent).toContain("Nội dung câu hỏi tối đa 5.000 ký tự.");
      expect(host.querySelector<HTMLTextAreaElement>('textarea[data-validation-field="content"]')?.value).toBe(content);
    }
  });

  it("saves and continues with the same lesson and type but a cleared question", async () => {
    addQuestion.mockResolvedValue({ id: "uuid-new", version: 1 });
    await prepare("essay_text", "First essay question");
    const continueButton = host.querySelector<HTMLButtonElement>('button[value="continue"]')!;
    await act(async () => { continueButton.click(); });
    expect(addQuestion).toHaveBeenCalledTimes(1);
    expect(addQuestion).toHaveBeenCalledWith(expect.objectContaining({ type: "essay_text", lessonId: "geo10-kn-b07", content: "First essay question" }));
    expect(host.querySelector<HTMLSelectElement>("select")?.value).toBe("essay_text");
    expect([...host.querySelectorAll("select")][1].value).toBe("geo10-kn-b07");
    expect(host.querySelector<HTMLTextAreaElement>('textarea[data-validation-field="content"]')?.value).toBe("");
  });

  it("uses the loaded version and preserves the form on a 409 conflict", async () => {
    getQuestion.mockResolvedValue(essay);
    updateQuestion.mockRejectedValue(new ApiError("Conflict", 409));
    await render("/teacher/questions/uuid-1/edit");
    await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(updateQuestion).toHaveBeenCalledWith("uuid-1", expect.objectContaining({ type: "essay_text", content: "Explain a river" }), 3);
    expect(host.textContent).toContain("Sao chép nội dung đang soạn");
    expect(host.textContent).not.toContain("Bank list");
  });

  it("keeps the draft and shows a safe message when the create API fails", async () => {
    addQuestion.mockRejectedValue(new ApiError("Không thể lưu câu hỏi. Vui lòng thử lại.", 500));
    await render("/teacher/questions/new");
    const selects = [...host.querySelectorAll("select")];
    await act(async () => { change(selects[0], "essay_text"); change(selects[1], "geo10-kn-b07"); });
    await act(async () => { change(host.querySelector("textarea")!, "My draft answer prompt"); });
    await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(addQuestion).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain("Không thể lưu câu hỏi. Vui lòng thử lại.");
    expect([...host.querySelectorAll("textarea")].some((item) => item.value === "My draft answer prompt")).toBe(true);
    expect(host.textContent).not.toMatch(/SQLSTATE|Connection:|select \*/);
  });

  it("focuses missing question content only on save and keeps the selected lesson", async () => {
    await prepare("essay_text", "");
    expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
    await submit();
    const content = host.querySelector<HTMLTextAreaElement>('[data-validation-field="content"]')!;
    expect(document.activeElement).toBe(content);
    expect(content.getAttribute("aria-invalid")).toBe("true");
    expect(host.textContent).toContain("Vui lòng nhập nội dung câu hỏi.");
    expect(host.querySelector<HTMLSelectElement>('[data-validation-field="lesson"]')?.value).toBe("geo10-kn-b07");
    expect(addQuestion).not.toHaveBeenCalled();
  });

  it("focuses the first empty option, then clears its error when corrected", async () => {
    await prepare("single_choice");
    const options = [...host.querySelectorAll<HTMLInputElement>('input[aria-label^="Nội dung phương án"]')];
    await act(async () => { change(options[0], "A"); change(options[1], "B"); change(options[3], "D"); });
    await submit();
    expect(document.activeElement).toBe(options[2]);
    expect(options[2].getAttribute("aria-invalid")).toBe("true");
    expect(host.textContent).toContain("Phương án C chưa có nội dung.");
    expect(addQuestion).not.toHaveBeenCalled();
    const scrollCount = vi.mocked(HTMLElement.prototype.scrollIntoView).mock.calls.length;
    await act(async () => { change(options[2], "C"); });
    expect(options[2].getAttribute("aria-invalid")).toBe("false");
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledTimes(scrollCount);
    expect(options[0].value).toBe("A");
  });

  it("focuses answer selection after all options have content", async () => {
    await prepare("single_choice");
    await act(async () => { [...host.querySelectorAll<HTMLInputElement>('input[aria-label^="Nội dung phương án"]')].forEach((option, index) => change(option, String.fromCharCode(65 + index))); });
    await submit();
    expect(document.activeElement).toBe(host.querySelector('[data-validation-field="correct"]'));
    expect(host.textContent).toContain("Vui lòng chọn đáp án đúng.");
    expect(addQuestion).not.toHaveBeenCalled();
  });

  it("focuses invalid numeric answer and the specific empty statement", async () => {
    await prepare("short_answer");
    const numeric = host.querySelector<HTMLInputElement>('[data-validation-field="numeric"]')!;
    await act(async () => { change(numeric, "12 kg"); });
    await submit();
    expect(document.activeElement).toBe(numeric);
    expect(host.textContent).toContain("Nhập đáp án là một số");
    await act(async () => { change(host.querySelector("select")!, "true_false_group"); });
    const statements = [...host.querySelectorAll<HTMLTextAreaElement>('textarea[data-validation-field^="statement:"]')];
    await act(async () => { change(statements[0], "Ý đầu tiên"); });
    await submit();
    expect(document.activeElement).toBe(statements[1]);
    expect(host.textContent).toContain("Ý 2 chưa có nội dung.");
    expect(addQuestion).not.toHaveBeenCalled();
  });

  it("collapses optional media by default and preserves URL when toggled", async () => {
    await prepare("essay_text");
    const toggle = host.querySelector<HTMLButtonElement>('button[aria-controls="question-media"]')!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await act(async () => { toggle.click(); });
    const url = host.querySelector<HTMLInputElement>('input[aria-label="Liên kết ảnh câu hỏi"]')!;
    await act(async () => { change(url, "https://example.org/map.png"); });
    await act(async () => { toggle.click(); });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(host.textContent).toContain("Đã đính kèm ảnh");
    await act(async () => { toggle.click(); });
    expect(host.querySelector<HTMLInputElement>('input[aria-label="Liên kết ảnh câu hỏi"]')?.value).toBe("https://example.org/map.png");
  });

  it("opens media and focuses the image URL when its value is invalid", async () => {
    await prepare("essay_text");
    const toggle = host.querySelector<HTMLButtonElement>('button[aria-controls="question-media"]')!;
    await act(async () => { toggle.click(); });
    await act(async () => { change(host.querySelector<HTMLInputElement>('input[aria-label="Liên kết ảnh câu hỏi"]')!, "bad-url"); toggle.click(); });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await submit();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(host.querySelector('input[aria-label="Liên kết ảnh câu hỏi"]'));
    expect(host.textContent).toContain("Chọn ảnh hợp lệ");
    expect(addQuestion).not.toHaveBeenCalled();
  });

  it("retains the existing upload and paste controls inside expanded media", async () => {
    await prepare("essay_text");
    const toggle = host.querySelector<HTMLButtonElement>('button[aria-controls="question-media"]')!;
    await act(async () => { toggle.click(); });
    const upload = host.querySelector<HTMLInputElement>('input[aria-label="Tải ảnh tư liệu câu hỏi"]')!;
    expect(upload).toBeTruthy();
    expect(host.textContent).toContain("Ctrl+V");
    const file = new File(["image bytes"], "map.png", { type: "image/png" });
    Object.defineProperty(upload, "files", { configurable: true, value: [file] });
    await act(async () => { upload.dispatchEvent(new Event("change", { bubbles: true })); await Promise.resolve(); });
    expect(compressCoverImage).toHaveBeenCalledWith(file, expect.any(Object));
    expect(host.textContent).toContain("Đã đính kèm ảnh");
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", { value: { files: [file] } });
    await act(async () => { host.querySelector("form")!.dispatchEvent(paste); await Promise.resolve(); });
    expect(compressCoverImage).toHaveBeenCalledTimes(2);
  });

  it("opens an existing image and maps a server 422 field error without clearing the draft", async () => {
    getQuestion.mockResolvedValue({ ...essay, image: { url: "https://example.org/map.png" } });
    updateQuestion.mockRejectedValue(new ApiError("Invalid", 422, { content: ["Nội dung quá dài."] }));
    await render("/teacher/questions/uuid-1/edit");
    expect(host.querySelector('button[aria-controls="question-media"]')?.getAttribute("aria-expanded")).toBe("true");
    expect(host.querySelector<HTMLInputElement>('input[aria-label="Liên kết ảnh câu hỏi"]')?.value).toBe("https://example.org/map.png");
    await submit();
    expect(host.textContent).toContain("Nội dung quá dài.");
    await vi.waitFor(() => expect(document.activeElement).toBe(host.querySelector('[data-validation-field="content"]')));
    expect(host.querySelector<HTMLTextAreaElement>('[data-validation-field="content"]')?.value).toBe("Explain a river");
  });
});
