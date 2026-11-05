import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileUp, LoaderCircle } from "lucide-react";
import Dialog from "../common/Dialog";
import { useTeacherQuestions } from "../../contexts/TeacherQuestionsContext";
import { geo10Chapters, geo10Lessons } from "../../data/geo10Curriculum";
import type { QuestionDifficulty, QuestionInputV2 } from "../../types/question";
import {
  downloadQuestionWordTemplate, parseWordQuestions, readQuestionWord,
  WORD_DIFFICULTIES, WORD_TYPES, type WordQuestionLine,
} from "../../utils/wordQuestionImport";

function ImportedAnswer({ input }: { input: QuestionInputV2 }) {
  return <div className="space-y-2 text-sm leading-6">
    {input.type === "short_answer" ? <p className="font-bold text-emerald-800">Đáp án: {input.correctAnswer}</p> : input.type === "single_choice" || input.type === "multiple_choice"
      ? input.options.map((option, index) => {
        const correct = input.type === "single_choice" ? option.id === input.correctOptionId : input.correctOptionIds.includes(option.id);
        return <p key={option.id} className={`whitespace-pre-wrap rounded-lg border p-2 ${correct ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-line"}`}><strong>{String.fromCharCode(65 + index)}. </strong>{option.text}</p>;
      }) : input.type === "true_false"
        ? <p className="font-bold text-emerald-800">{input.correctAnswer ? "Đúng" : "Sai"}</p>
        : input.statements.map((statement, index) => <div key={statement.id} className="rounded-lg border border-line p-2"><p className="whitespace-pre-wrap"><strong>Ý {index + 1}. </strong>{statement.content}</p><p className="font-bold text-emerald-800">{statement.correctAnswer ? "Đúng" : "Sai"}</p></div>)}
    {input.explanation && <p className="whitespace-pre-wrap pt-2 text-secondary"><strong>Giải thích: </strong>{input.explanation}</p>}
  </div>;
}

export default function QuestionWordImportDialog({ onClose, onImported }: {
  onClose: () => void; onImported: (count: number) => void;
}) {
  const { importQuestions } = useTeacherQuestions();
  const [lines, setLines] = useState<WordQuestionLine[]>([]);
  const [fileName, setFileName] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>("recognition");
  const [reading, setReading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [importedCount, setImportedCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const readAttempt = useRef(0);
  const imported = useRef(false);
  const confirmationRef = useRef<HTMLDialogElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => () => { readAttempt.current++; }, []);
  useEffect(() => {
    if (!confirmClose) return;
    const dialog = confirmationRef.current;
    dialog?.showModal();
    continueRef.current?.focus();
    return () => { if (dialog?.open) dialog.close(); };
  }, [confirmClose]);
  const preview = useMemo(() => {
    if (!lines.length) return { rows: [], error: "" };
    try {
      const rows = parseWordQuestions(lines, { lessonId, difficulty });
      return { rows, error: rows.length ? "" : "Không nhận diện được câu hỏi. Mỗi câu cần bắt đầu bằng Câu 1:, Câu 2:, ... như file mẫu." };
    } catch (cause) { return { rows: [], error: cause instanceof Error ? cause.message : "Không đọc được nội dung câu hỏi." }; }
  }, [lines, lessonId, difficulty]);
  const validInputs = preview.rows.flatMap((row) => row.input ? [row.input] : []);
  const invalidCount = preview.rows.length - validInputs.length;
  const missingLessonCount = validInputs.filter((input) => !input.lessonId).length;

  function requestClose() {
    if (importing || imported.current || confirmClose) return;
    if (!fileName && !lines.length && !uncertain && !importedCount) { onClose(); return; }
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setConfirmClose(true);
  }
  function keepImporting() {
    setConfirmClose(false);
    window.setTimeout(() => returnFocus.current?.focus(), 0);
  }

  async function chooseFile(file: File | undefined) {
    if (!file || uncertain) return;
    const attempt = ++readAttempt.current;
    setReading(true); setError(""); setLines([]); setFileName(file.name); setVisibleCount(10); setImportedCount(0); setUncertain(false);
    try {
      const result = await readQuestionWord(file);
      if (attempt !== readAttempt.current) return;
      if (!result.length) setError("File Word chưa có nội dung. Hãy điền câu hỏi theo file mẫu.");
      setLines(result);
    } catch (cause) {
      if (attempt === readAttempt.current) setError(cause instanceof Error ? cause.message : "Không đọc được file Word.");
    } finally { if (attempt === readAttempt.current) setReading(false); }
  }
  async function downloadTemplate() {
    setDownloading(true); setError("");
    try { await downloadQuestionWordTemplate(); }
    catch { setError("Chưa tải được file mẫu. Hãy thử lại."); }
    finally { setDownloading(false); }
  }
  async function confirmImport() {
    if (reading || !validInputs.length || !validInputs.every((input) => !!input.lessonId) || imported.current || uncertain) return;
    imported.current = true;
    setImporting(true); setError("");
    const result = await importQuestions(validInputs.slice(importedCount));
    const saved = importedCount + result.imported.length;
    setImportedCount(saved);
    setImporting(false); imported.current = false;
    if (result.failedAt !== null) {
      setUncertain(!!result.uncertain);
      const unsent = Math.max(0, validInputs.length - saved - 1);
      setError(result.uncertain
        ? `${saved} câu đã được xác nhận lưu thành công. Câu ${saved + 1} chưa xác định đã lưu hay chưa. ${unsent} câu còn lại chưa được gửi. Vui lòng kiểm tra Ngân hàng câu hỏi trước khi chủ động nhập lại để tránh trùng câu. Nếu đóng cửa sổ, bản xem trước sẽ mất; các câu đã lưu vẫn còn trên máy chủ.`
        : `${saved} câu đã lưu trên máy chủ. Câu tiếp theo chưa được xác nhận: ${result.error ?? "Lỗi không xác định"}. Chỉ thử lại phần còn lại; không nhập lại các câu đã lưu. Nếu đóng cửa sổ, bản xem trước sẽ mất; các câu đã lưu vẫn còn trên máy chủ.`);
      return;
    }
    onImported(saved);
  }
  return <><Dialog title="Nhập câu hỏi từ Word" onClose={requestClose} footer={<button type="button" disabled={reading || importing || uncertain || !validInputs.length || importedCount >= validInputs.length || missingLessonCount > 0} onClick={() => { void confirmImport(); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><FileUp aria-hidden="true" className="size-4" />{importing ? "Đang lưu…" : `Nhập ${validInputs.length - importedCount} câu còn lại`}</button>}>
    <div className="min-w-0 space-y-5 [overflow-wrap:anywhere]">
      <p className="text-sm leading-6 text-secondary">Tải mẫu và xem trước trước khi nhập. Mỗi câu được lưu riêng trên máy chủ; nếu dừng giữa chừng, các câu đã lưu vẫn còn.</p>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-canvas p-3">
        <p className="text-sm font-bold">1. Chuẩn bị file theo mẫu</p>
        <button type="button" disabled={downloading} onClick={downloadTemplate} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-bold disabled:opacity-50"><Download aria-hidden="true" className="size-4" />{downloading ? "Đang tạo mẫu…" : "Tải mẫu Word"}</button>
      </div>
      <div className="space-y-2">
        <label className="block rounded-xl text-sm font-bold focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-emerald-700">2. Chọn file Word (.docx)
          <input type="file" accept=".docx" disabled={reading || importing || uncertain} onChange={(event) => { void chooseFile(event.target.files?.[0]); event.target.value = ""; }} className="sr-only" />
          <span className={`mt-2 flex min-h-14 items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-canvas px-3 py-3 font-semibold ${reading ? "opacity-50" : "cursor-pointer hover:bg-slate-100"}`}><FileUp aria-hidden="true" className="size-5" />{reading ? "Đang đọc file…" : fileName ? "Chọn lại file .docx" : "Chọn file .docx"}</span>
        </label>
        <p className="text-sm leading-6 text-secondary">Tối đa 5 MB và 500 câu/lần. Hỗ trợ 5 loại câu hỏi hiện có. Chưa nhập ảnh, bảng hoặc công thức trong Word; các câu có nội dung này sẽ báo lỗi để bạn xử lý.</p>
        {fileName && <p className="text-sm text-secondary">File: {fileName}</p>}
      </div>
      <fieldset className="space-y-3 rounded-xl border border-line p-3">
        <legend className="px-1 text-sm font-bold">Thông tin mặc định cho câu hỏi</legend>
        <p className="text-sm text-secondary">Các lựa chọn này chỉ áp dụng cho câu chưa ghi Bài hoặc Mức độ trong file Word.</p>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="min-w-0 text-sm">Bài học<select aria-label="Bài học mặc định khi nhập Word" value={lessonId} disabled={importing || importedCount > 0} onChange={(event) => setLessonId(event.target.value)} className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-2">
            <option value="">Chưa gắn bài học</option>{geo10Chapters.map((chapter) => <optgroup key={chapter.id} label={`Chương ${chapter.number}. ${chapter.title}`}>{geo10Lessons.filter((lesson) => lesson.chapterId === chapter.id).map((lesson) => <option key={lesson.id} value={lesson.id}>Bài {lesson.number}. {lesson.title}</option>)}</optgroup>)}
          </select></label>
          <label className="text-sm">Mức độ<select aria-label="Mức độ mặc định khi nhập Word" value={difficulty} disabled={importing || importedCount > 0} onChange={(event) => { const value = event.target.value; if (Object.prototype.hasOwnProperty.call(WORD_DIFFICULTIES, value)) setDifficulty(value as QuestionDifficulty); }} className="mt-2 min-h-11 w-full rounded-xl border border-line bg-white px-2">{Object.entries(WORD_DIFFICULTIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
      </fieldset>
      {reading && <p role="status" className="flex items-center gap-2 text-sm"><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />Đang đọc file Word…</p>}
      {(error || preview.error) && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800">{error || preview.error}</p>}
      {missingLessonCount > 0 && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">Chưa sẵn sàng nhập: {missingLessonCount} câu đúng định dạng chưa có Bài học. Vui lòng chọn Bài học mặc định hoặc bổ sung Bài trong file Word.</p>}
      {preview.rows.length > 0 && <section aria-label="Xem trước nhập Word" className="space-y-3">
        <h3 className="font-bold">3. Kiểm tra trước khi nhập</h3>
        <p role="status" className="rounded-xl bg-canvas p-3 text-sm"><strong>{preview.rows.length} câu nhận diện</strong> · {validInputs.length} đúng định dạng · {invalidCount} lỗi định dạng</p>
        {!!invalidCount && <p className="text-sm leading-6 text-red-800">{invalidCount} câu lỗi sẽ không được nhập. Mở từng câu để xem lý do, sửa trong Word rồi chọn lại file nếu cần.</p>}
        <div className="space-y-2">{preview.rows.slice(0, visibleCount).map((row, index) => <details key={index} className="rounded-xl border border-line">
          <summary className="cursor-pointer p-3 text-sm leading-6"><strong>Câu {row.number}: </strong>{row.content || "Chưa có nội dung"}<span className={`ml-2 inline-block rounded-lg px-2 font-semibold ${row.input ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{row.input ? "Hợp lệ" : "Cần sửa"}</span></summary>
          <div className="space-y-3 border-t border-line p-3">
            {row.input ? <><p className="text-sm text-secondary">{WORD_TYPES[row.input.type]} · {WORD_DIFFICULTIES[row.input.difficulty]} · {geo10Lessons.find((lesson) => lesson.id === row.input?.lessonId) ? `Bài ${geo10Lessons.find((lesson) => lesson.id === row.input?.lessonId)?.number}` : "Chưa gắn bài học"}</p><ImportedAnswer input={row.input} /></> : <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-red-800">{row.errors.map((message) => <li key={message}>{message}</li>)}</ul>}
          </div>
        </details>)}</div>
        {visibleCount < preview.rows.length && <button type="button" onClick={() => setVisibleCount((count) => count + 10)} className="min-h-11 rounded-xl border border-line px-3 text-sm font-bold">Xem thêm 10 câu</button>}
      </section>}
    </div>
  </Dialog>{confirmClose && <dialog ref={confirmationRef} role="alertdialog" aria-labelledby="word-import-close-title" aria-describedby="word-import-close-description" onCancel={(event) => { event.preventDefault(); event.stopPropagation(); keepImporting(); }} className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-white p-5 text-ink shadow-xl backdrop:bg-ink/50 sm:p-6">
    <h2 id="word-import-close-title" className="text-lg font-extrabold">Đóng cửa sổ nhập Word?</h2>
    <p id="word-import-close-description" className="mt-3 text-sm leading-6 text-secondary">{uncertain ? "Có câu hỏi chưa xác định đã lưu hay chưa. Hãy kiểm tra Ngân hàng câu hỏi trước khi nhập lại để tránh trùng câu. " : ""}Bản xem trước và tiến độ nhập sẽ mất khi đóng. Các câu chưa gửi sẽ không được tự động nhập. Những câu đã xác nhận lưu vẫn còn trên máy chủ.</p>
    <div className="mt-5 flex flex-wrap justify-end gap-2"><button ref={continueRef} type="button" onClick={keepImporting} className="min-h-11 rounded-xl border border-line px-4 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">Tiếp tục nhập</button><button type="button" onClick={() => { setConfirmClose(false); onClose(); }} className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700">Đóng và bỏ bản xem trước</button></div>
  </dialog>}</>;
}
