// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import QuestionWordImportDialog from "./QuestionWordImportDialog";
import { parseWordQuestions, readQuestionWord } from "../../utils/wordQuestionImport";
import { geo10Lessons } from "../../data/geo10Curriculum";

const importQuestions = vi.fn();
vi.mock("../../contexts/TeacherQuestionsContext", () => ({ useTeacherQuestions: () => ({ importQuestions }) }));
vi.mock("../../utils/wordQuestionImport", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../utils/wordQuestionImport")>(),
  readQuestionWord: vi.fn(), downloadQuestionWordTemplate: vi.fn(),
}));

const read = vi.mocked(readQuestionWord);
const lines = (count: number) => Array.from({ length: count }, (_, index) => [
  `Câu ${index + 1}: Question ${index + 1}`, "Loại: Chọn 1 đáp án", "Bài: 7",
  "A. First", "B. Second", "Đáp án: A",
].map((text) => ({ text, unsupported: false }))).flat();
let root: Root;
let host: HTMLDivElement;
const onImported = vi.fn();
const onClose = vi.fn();

async function prepare(count: number) {
  read.mockResolvedValue(lines(count));
  await act(async () => { root.render(<QuestionWordImportDialog onClose={onClose} onImported={onImported} />); });
  const fileInput = host.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(fileInput, "files", { configurable: true, value: [new File(["word"], "questions.docx")] });
  await act(async () => { fileInput.dispatchEvent(new Event("change", { bubbles: true })); });
  expect(host.textContent).toContain(`${count} câu nhận diện`);
}
async function confirm() {
  const button = [...host.querySelectorAll<HTMLButtonElement>("footer button")].at(-1)!;
  await act(async () => { button.click(); });
}

describe("Question Word import confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    HTMLDialogElement.prototype.showModal = vi.fn(); HTMLDialogElement.prototype.close = vi.fn();
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

  it("keeps one Close button in a fixed header and the Import action in a separate footer", async () => {
    await prepare(10);
    const dialog = host.querySelector<HTMLDialogElement>("dialog")!;
    expect(dialog.className).toContain("flex-col");
    expect(dialog.className).toContain("overflow-hidden");
    expect(dialog.querySelectorAll('button[aria-label="Đóng hộp thoại"]')).toHaveLength(1);
    expect(dialog.querySelector("header button")?.getAttribute("aria-label")).toBe("Đóng hộp thoại");
    expect(dialog.querySelector("header")?.className).toContain("shrink-0");
    expect(dialog.querySelector("[data-dialog-body]")?.className).toContain("overflow-y-auto");
    expect(dialog.querySelector("[data-dialog-body]")?.className).toContain("min-h-0");
    expect(dialog.querySelector("[data-dialog-footer]")?.className).toContain("shrink-0");
    expect(dialog.querySelectorAll("[data-dialog-footer] button")).toHaveLength(1);
  });

  it("keeps header and footer outside the long preview scroll body at 100 and 500 rows", async () => {
    await prepare(100);
    await prepare(500);
    const dialog = host.querySelector<HTMLDialogElement>("dialog")!;
    const body = dialog.querySelector("[data-dialog-body]")!;
    const more = [...body.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Xem thêm 10 câu")!;
    await act(async () => { for (let index = 0; index < 39; index++) more.click(); });
    const details = body.querySelectorAll("details");
    expect(details).toHaveLength(400);
    expect(details[399].textContent).toContain("Question 400");
    expect(dialog.children[0].tagName).toBe("HEADER");
    expect(dialog.children[1]).toBe(body);
    expect(dialog.children[2].tagName).toBe("FOOTER");
  });

  it("closes immediately when no file or preview is present", async () => {
    await act(async () => { root.render(<QuestionWordImportDialog onClose={onClose} onImported={onImported} />); });
    await act(async () => { host.querySelector<HTMLButtonElement>('button[aria-label="Đóng hộp thoại"]')!.click(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it("confirms before discarding a parsed preview, and Continue keeps it without POST", async () => {
    await prepare(3);
    const close = host.querySelector<HTMLButtonElement>('button[aria-label="Đóng hộp thoại"]')!;
    await act(async () => { close.click(); });
    const confirmation = host.querySelector<HTMLDialogElement>('[role="alertdialog"]')!;
    expect(confirmation.textContent).toContain("Bản xem trước và tiến độ nhập sẽ mất");
    expect(confirmation.textContent).toContain("Các câu chưa gửi sẽ không được tự động nhập");
    expect(document.activeElement?.textContent).toBe("Tiếp tục nhập");
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => { [...confirmation.querySelectorAll("button")][0].click(); });
    expect(host.querySelector('[role="alertdialog"]')).toBeNull();
    expect(host.textContent).toContain("3 câu nhận diện");
    await vi.waitFor(() => expect(document.activeElement).toBe(close));
    expect(importQuestions).not.toHaveBeenCalled();
    await act(async () => { close.click(); });
    await act(async () => { [...host.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')][1].click(); });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(importQuestions).not.toHaveBeenCalled();
  });

  it("does not let Escape or backdrop click bypass the close confirmation", async () => {
    await prepare(3);
    await act(async () => { host.querySelector<HTMLDialogElement>("dialog")!.dispatchEvent(new Event("cancel", { bubbles: true, cancelable: true })); });
    const confirmation = host.querySelector<HTMLDialogElement>('[role="alertdialog"]')!;
    await act(async () => { confirmation.dispatchEvent(new Event("cancel", { bubbles: true, cancelable: true })); });
    expect(onClose).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alertdialog"]')).toBeNull();
    await act(async () => { host.querySelector<HTMLDialogElement>("dialog")!.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(onClose).not.toHaveBeenCalled();
    expect(host.textContent).toContain("3 câu nhận diện");
  });

  it("explains missing lesson readiness and applies the default only to questions without a Word lesson", async () => {
    const source = lines(2);
    source.splice(2, 1);
    read.mockResolvedValue(source);
    await act(async () => { root.render(<QuestionWordImportDialog onClose={onClose} onImported={onImported} />); });
    const fileInput = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(fileInput, "files", { configurable: true, value: [new File(["word"], "mixed-lessons.docx")] });
    await act(async () => { fileInput.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(host.textContent).toContain("2 đúng định dạng");
    expect(host.textContent).toContain("Chưa sẵn sàng nhập: 1 câu đúng định dạng chưa có Bài học");
    expect(host.querySelector<HTMLButtonElement>("[data-dialog-footer] button")?.disabled).toBe(true);
    const lesson = host.querySelector<HTMLSelectElement>('select[aria-label="Bài học mặc định khi nhập Word"]')!;
    await act(async () => { lesson.value = geo10Lessons[0].id; lesson.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(read).toHaveBeenCalledTimes(1);
    expect(host.textContent).not.toContain("Chưa sẵn sàng nhập");
    expect(host.querySelector<HTMLButtonElement>("[data-dialog-footer] button")?.disabled).toBe(false);
    importQuestions.mockResolvedValue({ imported: ["first", "second"], failedAt: null });
    await confirm();
    expect(importQuestions.mock.calls[0][0].map((input: { lessonId: string }) => input.lessonId)).toEqual([geo10Lessons[0].id, "geo10-kn-b07"]);
  });

  it("does not require a default lesson when every Word question already names one", async () => {
    await prepare(3);
    expect(host.querySelector<HTMLSelectElement>('select[aria-label="Bài học mặc định khi nhập Word"]')?.value).toBe("");
    expect(host.querySelector<HTMLButtonElement>("[data-dialog-footer] button")?.disabled).toBe(false);
  });

  it("blocks closing while an import request is still in flight", async () => {
    let finish!: (result: { imported: string[]; failedAt: null }) => void;
    importQuestions.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await prepare(3);
    const submit = host.querySelector<HTMLButtonElement>("[data-dialog-footer] button")!;
    await act(async () => { submit.click(); });
    await act(async () => { host.querySelector<HTMLButtonElement>('button[aria-label="Đóng hộp thoại"]')!.click(); });
    await act(async () => { host.querySelector<HTMLDialogElement>("dialog")!.dispatchEvent(new Event("cancel", { bubbles: true, cancelable: true })); });
    expect(host.querySelector('[role="alertdialog"]')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(importQuestions).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ imported: ["one", "two", "three"], failedAt: null }); });
    expect(onImported).toHaveBeenCalledWith(3);
  });

  it("warns about an uncertain POST before closing without retrying it", async () => {
    importQuestions.mockResolvedValue({ imported: ["one"], failedAt: 1, uncertain: true });
    await prepare(3);
    await confirm();
    await act(async () => { host.querySelector<HTMLButtonElement>('button[aria-label="Đóng hộp thoại"]')!.click(); });
    const confirmation = host.querySelector<HTMLDialogElement>('[role="alertdialog"]')!;
    expect(confirmation.textContent).toContain("chưa xác định đã lưu hay chưa");
    expect(confirmation.textContent).toContain("kiểm tra Ngân hàng câu hỏi");
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => { [...confirmation.querySelectorAll<HTMLButtonElement>("button")][0].click(); });
    expect(host.textContent).toContain("1 câu đã được xác nhận lưu thành công");
    expect(importQuestions).toHaveBeenCalledTimes(1);
  });

  it.each([4999, 5000, 5001])("validates %i trimmed question characters against the backend limit", (length) => {
    const source = lines(1);
    source[0] = { text: `Câu 1:   ${"A".repeat(length)}   `, unsupported: false };
    const [preview] = parseWordQuestions(source, { lessonId: "", difficulty: "recognition" });
    expect(preview.content).toHaveLength(length);
    expect(Boolean(preview.input)).toBe(length <= 5000);
    expect(preview.errors).toEqual(length <= 5000 ? [] : ["Nội dung câu hỏi tối đa 5.000 ký tự."]);
  });

  it("counts Unicode characters as the backend does, without truncating the parsed Word text", () => {
    const source = lines(1);
    source[0] = { text: `Câu 1: ${"🌍".repeat(5000)}`, unsupported: false };
    const [preview] = parseWordQuestions(source, { lessonId: "", difficulty: "recognition" });
    expect(preview.input?.content).toBe("🌍".repeat(5000));
    expect(preview.errors).toEqual([]);
  });

  it("keeps an overlong parsed row visible but never submits it", async () => {
    const source = lines(1);
    source[0] = { text: `Câu 1: ${"A".repeat(5001)}`, unsupported: false };
    read.mockResolvedValue(source);
    await act(async () => { root.render(<QuestionWordImportDialog onClose={vi.fn()} onImported={onImported} />); });
    const fileInput = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(fileInput, "files", { configurable: true, value: [new File(["word"], "overlong.docx")] });
    await act(async () => { fileInput.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(host.textContent).toContain("0 đúng định dạng");
    expect(host.textContent).toContain("Cần sửa");
    expect(host.textContent).toContain("Nội dung câu hỏi tối đa 5.000 ký tự.");
    await confirm();
    expect(importQuestions).not.toHaveBeenCalled();
  });

  it("imports every valid row once and reports the actual saved count", async () => {
    importQuestions.mockResolvedValue({ imported: ["one", "two", "three"], failedAt: null });
    await prepare(3);
    await confirm();
    expect(importQuestions).toHaveBeenCalledTimes(1);
    expect(importQuestions.mock.calls[0][0]).toHaveLength(3);
    expect(onImported).toHaveBeenCalledWith(3);
  });

  it("reports partial HTTP failure and retries only rows not confirmed saved", async () => {
    importQuestions.mockResolvedValueOnce({ imported: ["one"], failedAt: 1, error: "HTTP 422", uncertain: false })
      .mockResolvedValueOnce({ imported: ["two", "three"], failedAt: null });
    await prepare(3);
    await confirm();
    expect(onImported).not.toHaveBeenCalled();
    expect(host.textContent).toContain("1 câu đã lưu trên máy chủ");
    expect(importQuestions).toHaveBeenCalledTimes(1);
    await confirm();
    expect(importQuestions.mock.calls[1][0]).toHaveLength(2);
    expect(onImported).toHaveBeenCalledWith(3);
  });

  it("shows confirmed, uncertain and unsent counts after HTTP 500 without allowing retry", async () => {
    importQuestions.mockResolvedValue({ imported: ["one"], failedAt: 1, error: "SQLSTATE private detail", uncertain: true });
    await prepare(3);
    await confirm();
    expect(onImported).not.toHaveBeenCalled();
    expect(host.textContent).toContain("1 câu đã được xác nhận lưu thành công");
    expect(host.textContent).toContain("Câu 2 chưa xác định đã lưu hay chưa");
    expect(host.textContent).toContain("1 câu còn lại chưa được gửi");
    expect(host.textContent).toContain("kiểm tra Ngân hàng câu hỏi");
    expect(host.textContent).toContain("bản xem trước sẽ mất");
    expect(host.textContent).toContain("3 câu nhận diện");
    expect(host.textContent).not.toContain("SQLSTATE");
    expect([...host.querySelectorAll("footer button")].at(-1)?.hasAttribute("disabled")).toBe(true);
    expect(host.querySelector<HTMLInputElement>('input[type="file"]')?.disabled).toBe(true);
    await confirm();
    expect(importQuestions).toHaveBeenCalledTimes(1);
  });

  it("keeps the full preview when five of ten rows are confirmed and row six is uncertain", async () => {
    importQuestions.mockResolvedValue({ imported: ["one", "two", "three", "four", "five"], failedAt: 5, uncertain: true });
    await prepare(10);
    await confirm();
    expect(host.textContent).toContain("5 câu đã được xác nhận lưu thành công");
    expect(host.textContent).toContain("Câu 6 chưa xác định đã lưu hay chưa");
    expect(host.textContent).toContain("4 câu còn lại chưa được gửi");
    expect(host.querySelectorAll('section[aria-label="Xem trước nhập Word"] details')).toHaveLength(10);
    expect(onImported).not.toHaveBeenCalled();
  });

  it("does not POST Word questions that fail preview validation", async () => {
    read.mockResolvedValue([{ text: "Câu 1: Invalid", unsupported: false }, { text: "Loại: Chọn 1 đáp án", unsupported: false },
      { text: "Bài: 7", unsupported: false }, { text: "A. First", unsupported: false }, { text: "B. Second", unsupported: false },
      { text: "Đáp án: C", unsupported: false }]);
    await act(async () => { root.render(<QuestionWordImportDialog onClose={vi.fn()} onImported={onImported} />); });
    const fileInput = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(fileInput, "files", { configurable: true, value: [new File(["word"], "invalid.docx")] });
    await act(async () => { fileInput.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(host.textContent).toContain("0 đúng định dạng");
    expect([...host.querySelectorAll("footer button")].at(-1)?.hasAttribute("disabled")).toBe(true);
    await confirm();
    expect(importQuestions).not.toHaveBeenCalled();
  });

  it("blocks retry after an uncertain network outcome to avoid duplicate POSTs", async () => {
    importQuestions.mockResolvedValue({ imported: ["one"], failedAt: 1, error: "Network timeout", uncertain: true });
    await prepare(3);
    await confirm();
    expect(host.textContent).toContain("1 câu đã được xác nhận lưu thành công");
    expect([...host.querySelectorAll("footer button")].at(-1)?.hasAttribute("disabled")).toBe(true);
    await confirm();
    expect(importQuestions).toHaveBeenCalledTimes(1);
    expect(onImported).not.toHaveBeenCalled();
  });
});
