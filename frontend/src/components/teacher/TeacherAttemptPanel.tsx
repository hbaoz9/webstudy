import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { IconAction } from "../common/IconAction";
import { ApiError } from "../../service/api/client";
import { getTeacherClassroomRoster, type TeacherRosterEntry } from "../../service/api/classrooms";
import {
  extendAttempt, getTeacherAttempt, gradeEssay, grantAdditionalAttempts, invalidateRevisionQuestion,
  listStudentExceptions, listTeacherAttempts, listTeacherResults, publishAttemptAnswers, publishAttemptScores,
  revokeAttempt, setStudentException,
  type Answer, type PublicQuestion, type StudentException, type TeacherAttempt, type TeacherAttemptSummary, type TeacherResult,
} from "../../service/api/attempts";
import type { Distribution } from "../../service/api/distributions";

const secondary = "min-h-11 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50";
const destructive = "min-h-11 rounded-xl border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50";
const attemptLabel: Record<string, string> = { NOT_STARTED: "Chưa bắt đầu", IN_PROGRESS: "Đang làm", SUBMITTED: "Đã nộp", TIMED_OUT: "Hết giờ",
  REVOKED: "Đã thu hồi", CANCELLED: "Đã hủy" };
const gradingLabel: Record<string, string> = { NOT_GRADED: "Chưa chấm", PENDING_ESSAY: "Chờ chấm tự luận",
  PENDING_GRADING: "Chờ chấm", GRADED: "Đã chấm", PENDING_REGRADE: "Đang chấm lại" };
const resultLabel: Record<string, string> = { PENDING_GRADING: "Chờ chấm", PROVISIONAL: "Điểm tạm thời",
  FINAL: "Điểm hoàn tất", PENDING_REGRADE: "Đang chấm lại", VOID: "Kết quả đã hủy" };

function decimalUnits(value: string): bigint | null {
  const match = /^(\d{1,6})(?:[.,](\d{1,6}))?$/.exec(value.trim());
  return match ? BigInt(match[1]) * 1000000n + BigInt((match[2] ?? "").padEnd(6, "0")) : null;
}

function normalizedPoints(value: string, maximum: string): string | null {
  const units = decimalUnits(value);
  const max = decimalUnits(maximum);
  return units !== null && max !== null && units <= max
    ? `${units / 1000000n}.${String(units % 1000000n).padStart(6, "0")}` : null;
}

function pointsLabel(value: string | null | undefined): string {
  return value === null || value === undefined ? "—" : String(Number(value));
}

function maximumTotal(questions: PublicQuestion[] | undefined): string {
  const units = (questions ?? []).reduce((sum, question) => sum + (decimalUnits(question.maxPoints) ?? 0n), 0n);
  return pointsLabel(`${units / 1000000n}.${String(units % 1000000n).padStart(6, "0")}`);
}

function readableAnswer(question: PublicQuestion, answer: Answer): string {
  if (!answer) return "Chưa trả lời";
  const option = (id: string) => question.content.options?.find(item => item.id === id)?.text ?? "Phương án không còn khả dụng";
  if ("optionId" in answer) return option(answer.optionId);
  if ("optionIds" in answer) return answer.optionIds.map(option).join("; ") || "Chưa chọn phương án";
  if ("answersByStatementId" in answer) return (question.content.statements ?? []).map(item =>
    `${item.content}: ${answer.answersByStatementId[item.id] === undefined ? "Chưa trả lời" : answer.answersByStatementId[item.id] ? "Đúng" : "Sai"}`).join("\n");
  if ("value" in answer) return typeof answer.value === "boolean" ? answer.value ? "Đúng" : "Sai" : answer.value;
  return answer.text || "Chưa trả lời";
}

export function TeacherAttemptPanel({ distribution, initialOpen = false, activeSection }: {
  distribution: Distribution; initialOpen?: boolean; activeSection?: "grading" | "results" | "settings" }) {
  const [open, setOpen] = useState(initialOpen);
  const [items, setItems] = useState<TeacherAttemptSummary[]>([]);
  const [exceptions, setExceptions] = useState<StudentException[]>([]);
  const [detail, setDetail] = useState<TeacherAttempt | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [summary, setSummary] = useState<{ pendingGrading: number; inProgress: number; graded: number; scoresPublished: boolean; answersPublished: boolean } | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [section, setSection] = useState<"grading" | "results" | "settings">("grading");
  const currentSection = activeSection ?? section;
  const [results, setResults] = useState<TeacherResult[]>([]);
  const [resultsPage, setResultsPage] = useState(1);
  const [resultsLastPage, setResultsLastPage] = useState(1);
  const [resultsQuery, setResultsQuery] = useState("");
  const [resultsStatus, setResultsStatus] = useState("");
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState("");
  const [busy, setBusy] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [studentId, setStudentId] = useState("");
  const [rosterQuery, setRosterQuery] = useState("");
  const [roster, setRoster] = useState<TeacherRosterEntry[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [points, setPoints] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [pendingKeys] = useState(() => new Map<string, string>());
  const listGeneration = useRef(0);
  const detailGeneration = useRef(0);
  const resultsGeneration = useRef(0);
  const selectedAttemptId = useRef<string | null>(null);
  const commandRunning = useRef(false);
  const refreshRunning = useRef(false);
  const resultsRefreshRunning = useRef(false);
  const openedOnce = useRef(false);

  useEffect(() => () => { listGeneration.current++; detailGeneration.current++; resultsGeneration.current++; }, []);

  const loadResults = useCallback(async (nextPage: number, q: string, status: string) => {
    const generation = ++resultsGeneration.current;
    setResultsLoading(true); setResultsError("");
    try {
      const response = await listTeacherResults(distribution.id, nextPage, q, status);
      if (generation !== resultsGeneration.current) return;
      setResults(response.data); setResultsPage(nextPage);
      setResultsLastPage(response.meta.lastPage ?? Math.max(1, Math.ceil(response.meta.total / 20)));
    } catch {
      if (generation === resultsGeneration.current) {
        setResults([]); setResultsError("Không thể tải kết quả. Vui lòng thử lại.");
      }
    } finally { if (generation === resultsGeneration.current) setResultsLoading(false); }
  }, [distribution.id]);

  useEffect(() => {
    if (!open || currentSection !== "results") return;
    const timer = setTimeout(() => void loadResults(1, resultsQuery, resultsStatus), 250);
    return () => { clearTimeout(timer); resultsGeneration.current++; };
  }, [open, currentSection, resultsQuery, resultsStatus, loadResults]);

  useEffect(() => {
    if (!open) return;
    if (!openedOnce.current) { openedOnce.current = true; return; }
    let current = true;
    const timer = setTimeout(() => {
      setRosterLoading(true);
      void getTeacherClassroomRoster(distribution.classroomId, 1, rosterQuery, "joined")
        .then(page => { if (current) setRoster(page.data.filter(item => item.linkedUserId !== null)); })
        .catch(() => { if (current) setRoster([]); })
        .finally(() => { if (current) setRosterLoading(false); });
    }, 250);
    return () => { current = false; clearTimeout(timer); };
  }, [distribution.classroomId, open, rosterQuery]);

  const load = useCallback(async (nextPage = page) => {
    const generation = ++listGeneration.current;
    setBusy(true); setError("");
    try {
      const [attempts, studentExceptions] = await Promise.all([
        listTeacherAttempts(distribution.id, nextPage, query, statusFilter), listStudentExceptions(distribution.id),
      ]);
      if (generation !== listGeneration.current) return;
      setItems(attempts.data); setLastPage(attempts.meta.lastPage ?? Math.max(1, Math.ceil(attempts.meta.total / 20)));
      setSummary({ pendingGrading: attempts.meta.pendingGrading ?? 0, inProgress: attempts.meta.inProgress ?? 0,
        graded: attempts.meta.graded ?? 0, scoresPublished: attempts.meta.scoresPublished ?? false,
        answersPublished: attempts.meta.answersPublished ?? false });
      setExceptions(studentExceptions.data); setPage(nextPage);
    } catch { if (generation === listGeneration.current) { setItems([]); setError("Không thể tải lượt làm. Vui lòng thử lại."); } }
    finally { if (generation === listGeneration.current) setBusy(false); }
  }, [distribution.id, page, query, statusFilter]);

  async function refreshAttempts() {
    if (refreshRunning.current || busy) return;
    refreshRunning.current = true;
    try { await load(page); }
    finally { refreshRunning.current = false; }
  }

  async function refreshResults() {
    if (resultsRefreshRunning.current || resultsLoading) return;
    resultsRefreshRunning.current = true;
    try { await loadResults(resultsPage, resultsQuery, resultsStatus); }
    finally { resultsRefreshRunning.current = false; }
  }

  useEffect(() => { if (initialOpen) void load(1); }, [distribution.id, initialOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => { void load(1); }, 250);
    return () => { clearTimeout(timer); listGeneration.current++; };
  }, [open, query, statusFilter, distribution.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function showAttempt(id: string) {
    const generation = ++detailGeneration.current;
    selectedAttemptId.current = id;
    setDetail(null); setPoints({}); setFeedback({}); setDetailLoading(true); setError(""); setNotice("");
    try {
      const next = await getTeacherAttempt(id);
      if (generation !== detailGeneration.current) return;
      setDetail(next);
      setPoints(Object.fromEntries((next.gradeItems ?? []).filter(item => item.source === "MANUAL")
        .map(item => [item.questionId, pointsLabel(item.points)])));
      setFeedback(Object.fromEntries((next.gradeItems ?? []).filter(item => item.source === "MANUAL")
        .map(item => [item.questionId, item.feedback ?? ""])));
    } catch { if (generation === detailGeneration.current) setError("Không thể tải chi tiết lượt làm. Vui lòng thử lại."); }
    finally { if (generation === detailGeneration.current) setDetailLoading(false); }
  }

  async function command(label: string, action: (key: string) => Promise<unknown>, refreshDetail = true): Promise<boolean> {
    if (commandRunning.current) return false;
    commandRunning.current = true;
    const key = pendingKeys.get(label) ?? crypto.randomUUID();
    const selectedAtStart = selectedAttemptId.current;
    pendingKeys.set(label, key);
    setBusy(true); setError(""); setNotice("");
    try {
      await action(key);
    } catch (cause) {
      if (cause instanceof ApiError && [403, 404, 409, 422, 423].includes(cause.status ?? 0)) pendingKeys.delete(label);
      setError(cause instanceof ApiError && cause.status === 423 ? "Chức năng lượt làm chưa được mở."
        : cause instanceof ApiError && cause.status === 409 ? label === "publish-scores"
          ? "Còn bài chờ chấm hoặc chấm lại. Hoàn tất chấm trước khi công bố điểm."
          : label === "publish-answers"
            ? "Chưa thể công bố đáp án khi còn học sinh có thể làm bài. Kiểm tra hạn và lượt làm đang mở."
            : "Dữ liệu đã thay đổi. Tải lại trước khi thao tác tiếp."
          : cause instanceof ApiError && cause.status === 422 ? (cause.errors.points?.[0] ?? cause.errors.expectedVersion?.[0] ?? "Điểm hoặc dữ liệu chấm chưa hợp lệ. Kiểm tra điểm tối đa và thử lại.")
          : cause instanceof ApiError && cause.status === 404 ? "Bài làm hoặc câu trả lời này không còn khả dụng. Tải lại trước khi tiếp tục."
          : "Chưa xác nhận được thao tác. Kiểm tra lại dữ liệu máy chủ; nếu thử lại sẽ dùng cùng mã yêu cầu.");
      setBusy(false);
      commandRunning.current = false;
      return false;
    }
    pendingKeys.delete(label);
    setNotice("Máy chủ đã xác nhận thao tác.");
    try {
      const attempts = await listTeacherAttempts(distribution.id, page, query, statusFilter);
      setItems(attempts.data);
      setSummary({ pendingGrading: attempts.meta.pendingGrading ?? 0, inProgress: attempts.meta.inProgress ?? 0,
        graded: attempts.meta.graded ?? 0, scoresPublished: attempts.meta.scoresPublished ?? false,
        answersPublished: attempts.meta.answersPublished ?? false });
      if (currentSection === "results") void loadResults(resultsPage, resultsQuery, resultsStatus);
      if (refreshDetail && detail && selectedAttemptId.current === selectedAtStart) {
        const generation = ++detailGeneration.current;
        const updated = await getTeacherAttempt(detail.id);
        if (generation === detailGeneration.current && selectedAttemptId.current === selectedAtStart) setDetail(updated);
      }
    } catch {
      setError("Thao tác đã được lưu, nhưng chưa tải lại được dữ liệu. Hãy bấm Tải lại; không cần gửi lại thao tác.");
    } finally { setBusy(false); commandRunning.current = false; }
    return true;
  }

  async function saveGrade(question: PublicQuestion, next = false) {
    if (!detail || detail.version === undefined) return;
    const value = normalizedPoints(points[question.id] ?? "", question.maxPoints);
    if (value === null) {
      setError(`Điểm câu ${question.position} phải từ 0 đến ${pointsLabel(question.maxPoints)}, tối đa 6 chữ số thập phân.`);
      return;
    }
    const currentId = detail.id;
    const saved = await command(`grade:${currentId}:${question.id}:${value}:${detail.version}`,
      key => gradeEssay(currentId, question.id, value, detail.version, feedback[question.id] ?? "", key));
    if (saved && next) {
      try {
        let response = await listTeacherAttempts(distribution.id, page, query, statusFilter);
        let target = response.data.find(row => row.id !== currentId && ["PENDING_ESSAY", "PENDING_GRADING"].includes(row.gradingStatus));
        if (!target && response.links.next) {
          response = await listTeacherAttempts(distribution.id, page + 1, query, statusFilter);
          setItems(response.data); setPage(page + 1);
          target = response.data.find(row => ["PENDING_ESSAY", "PENDING_GRADING"].includes(row.gradingStatus));
        }
        if (target?.id) await showAttempt(target.id);
        else setNotice("Đã lưu điểm. Không còn bài chờ chấm trong các trang vừa kiểm tra.");
      } catch { setError("Điểm đã lưu, nhưng chưa thể tải bài tiếp theo. Tải lại danh sách để tiếp tục."); }
    }
  }

  function promptReason(title: string): string | null {
    const value = window.prompt(title);
    return value?.trim() || null;
  }

  function grant() {
    const id = Number(studentId);
    if (!Number.isSafeInteger(id) || id < 1) { setError("Nhập mã học sinh hợp lệ."); return; }
    const amount = Number(window.prompt("Cấp thêm bao nhiêu lượt? (1–5)", "1"));
    if (!Number.isInteger(amount) || amount < 1 || amount > 5) return;
    const reason = promptReason("Lý do cấp thêm lượt:");
    if (!reason) return;
    void command(`grant:${id}:${amount}:${reason}`, key => grantAdditionalAttempts(distribution.id, id, amount, reason, key), false);
  }

  function exception() {
    const id = Number(studentId);
    if (!Number.isSafeInteger(id) || id < 1) { setError("Nhập mã học sinh hợp lệ."); return; }
    const old = exceptions.find(item => item.studentId === id);
    const late = window.prompt("Hạn bắt đầu riêng (ISO có múi giờ; để trống nếu không cấp):", old?.lateStartUntil ?? "");
    if (late === null) return;
    const completion = window.prompt("Hạn hoàn thành riêng (ISO có múi giờ; để trống nếu không cấp):", old?.completionDeadlineAt ?? "");
    if (completion === null) return;
    const limit = window.prompt("Thời lượng riêng tính bằng giây (để trống nếu không cấp):", String(old?.timeLimitSeconds ?? ""));
    if (limit === null) return;
    const reason = promptReason("Lý do thay đổi ngoại lệ:");
    if (!reason) return;
    const input = { lateStartUntil: late || null, completionDeadlineAt: completion || null,
      timeLimitSeconds: limit ? Number(limit) : null, expectedVersion: old?.version ?? 0, reason };
    void command(`exception:${id}:${JSON.stringify(input)}`, key => setStudentException(distribution.id, id, input, key), false);
  }

  function extend() {
    if (!detail || distribution.lifecycleStatus !== "active") return;
    const date = window.prompt("Hạn mới cho lượt này (ISO có múi giờ):", detail.expiresAt);
    if (!date) return;
    const reason = promptReason("Lý do gia hạn lượt đang làm:");
    if (!reason) return;
    const version = detail.version;
    if (version === undefined) { setError("Thiếu phiên bản lượt làm; tải lại chi tiết."); return; }
    void command(`extend:${detail.id}:${date}:${version}`, key => extendAttempt(detail.id, date, version, reason, key));
  }

  function revoke() {
    if (!detail) return;
    const reason = promptReason("Lý do thu hồi lượt làm:");
    if (!reason || !window.confirm("Thu hồi lượt này và ghi audit?")) return;
    if (detail.version === undefined) { setError("Thiếu phiên bản lượt làm; tải lại chi tiết."); return; }
    void command(`revoke:${detail.id}:${detail.version}`, key => revokeAttempt(detail.id, detail.version!, reason, key));
  }

  return <section className="mt-4 space-y-4 rounded-xl border border-line bg-slate-50 p-4" aria-label="Theo dõi và chấm bài">
    {!open ? <button className={secondary} onClick={() => { setOpen(true); void load(1); }}>Theo dõi lượt làm và chấm bài</button> : <>
      {!activeSection && <nav aria-label="Khu vực bài đã giao" className="flex flex-wrap gap-2">
        {(["grading", "results", "settings"] as const).map(value => <button key={value} type="button"
          className={section === value ? `${secondary} border-emerald-600 bg-emerald-50` : secondary}
          aria-current={section === value ? "page" : undefined} onClick={() => setSection(value)}>
          {value === "grading" ? "Chấm bài" : value === "results" ? "Kết quả & Công bố" : "Cài đặt & Thao tác nâng cao"}
        </button>)}
      </nav>}
      <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-bold">{currentSection === "grading" ? "Lượt làm của học sinh" : currentSection === "results" ? "Bảng kết quả" : "Ngoại lệ học sinh"}</h4>
        {currentSection !== "results" && <IconAction icon={RefreshCw} label="Tải lại danh sách lượt làm" loading={busy} onClick={() => void refreshAttempts()} />}</div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
      {busy && <p role="status" className="text-sm text-secondary">Đang liên hệ máy chủ…</p>}
      {currentSection === "grading" && <>
      {summary && <p className="rounded-xl bg-white p-3 text-sm">Chờ chấm: {summary.pendingGrading} · Đang làm: {summary.inProgress} · Đã chấm: {summary.graded}. Danh sách ưu tiên bài chờ chấm.</p>}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <input aria-label="Tìm học sinh để chấm" placeholder="Tìm theo tên học sinh" className="min-h-11 rounded-xl border border-line px-3"
          value={query} onChange={event => { setQuery(event.target.value); setPage(1); setDetail(null); }} />
        <select aria-label="Lọc trạng thái lượt làm" className="min-h-11 rounded-xl border border-line px-3" value={statusFilter}
          onChange={event => { setStatusFilter(event.target.value); setPage(1); setDetail(null); }}>
          <option value="">Tất cả lượt làm</option><option value="PENDING_ESSAY">Chờ chấm tự luận</option>
          <option value="NOT_STARTED">Chưa bắt đầu</option>
          <option value="IN_PROGRESS">Đang làm</option><option value="SUBMITTED">Đã nộp</option>
          <option value="TIMED_OUT">Hết giờ</option><option value="GRADED">Đã chấm</option>
        </select>
      </div>
      <ul className="space-y-2">{items.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3 text-sm">
        <span>{row.studentName ?? `Học sinh #${row.studentId}`} · {row.id ? `Lượt ${row.attemptNo} · ` : ""}{attemptLabel[row.status] ?? row.status}{row.id ? ` · ${gradingLabel[row.gradingStatus] ?? row.gradingStatus}` : ""}</span>
        {row.id && <button className={secondary} onClick={() => void showAttempt(row.id!)}>Xem và chấm</button>}
      </li>)}</ul>
      {!busy && items.length === 0 && !error && <p className="text-sm text-secondary">Chưa có lượt làm.</p>}
      {lastPage > 1 && <div className="flex items-center gap-2"><button className={secondary} disabled={busy || page <= 1} onClick={() => void load(page - 1)}>Trước</button>
        <span>{page}/{lastPage}</span><button className={secondary} disabled={busy || page >= lastPage} onClick={() => void load(page + 1)}>Sau</button></div>}
      {detailLoading && <p role="status">Đang tải bài làm của học sinh…</p>}
      </>}
      {currentSection === "results" && <section className="space-y-3 rounded-xl bg-white p-4" aria-label="Kết quả và công bố">
        <h5 className="font-bold">Kết quả & Công bố</h5>
        <p className="text-sm text-secondary">Điểm và đáp án có chính sách công bố riêng. Không công bố đáp án khi còn học sinh đủ điều kiện làm bài.</p>
        <p className="text-sm">{distribution.scoreReleaseMode === "AFTER_ATTEMPT_GRADED" ? "Điểm từng lượt tự hiển thị sau khi được chấm." : distribution.scoreReleaseMode === "MANUAL" ? "Điểm cần được giáo viên công bố." : "Tổng điểm tự hiển thị khi đợt giao kết thúc và đã chấm xong."}
          {summary?.scoresPublished && " Điểm đã được công bố thủ công."}</p>
        <p className="text-sm">{distribution.answerReleaseMode === "NEVER" ? "Đáp án không được công bố theo cấu hình đợt giao." : summary?.answersPublished ? "Đáp án và lời giải đã được công bố." : "Đáp án và lời giải chưa được công bố."}</p>
      <div className="flex flex-wrap gap-2">
        {distribution.scoreReleaseMode === "MANUAL" && <button className={secondary} disabled={busy || summary?.scoresPublished} onClick={() => void command("publish-scores", key => publishAttemptScores(distribution.id, key), false)}>Công bố điểm</button>}
        {distribution.answerReleaseMode !== "NEVER" && <button className={secondary} disabled={busy || summary?.answersPublished} onClick={() => {
          if (window.confirm("Công bố đáp án và lời giải khi mọi lượt đã kết thúc?")) void command("publish-answers", key => publishAttemptAnswers(distribution.id, key), false);
        }}>Công bố đáp án</button>}
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
        <input aria-label="Tìm học sinh trong kết quả" placeholder="Tìm theo tên học sinh" className="min-h-11 rounded-xl border border-line px-3"
          value={resultsQuery} onChange={event => setResultsQuery(event.target.value)} />
        <select aria-label="Lọc trạng thái kết quả" className="min-h-11 rounded-xl border border-line px-3"
          value={resultsStatus} onChange={event => setResultsStatus(event.target.value)}>
          <option value="">Tất cả kết quả</option><option value="PENDING_GRADING">Chờ chấm</option>
          <option value="PROVISIONAL">Điểm tạm thời</option><option value="FINAL">Điểm hoàn tất</option>
          <option value="PENDING_REGRADE">Đang chấm lại</option><option value="VOID">Đã hủy</option>
        </select>
        <IconAction icon={RefreshCw} label="Tải lại bảng kết quả" loading={resultsLoading} onClick={() => void refreshResults()} />
      </div>
      {resultsLoading && <p role="status" className="text-sm">Đang tải kết quả…</p>}
      {resultsError && <p role="alert" className="text-sm text-red-700">{resultsError}</p>}
      {!resultsLoading && !resultsError && results.length === 0 && <p className="text-sm text-secondary">Chưa có kết quả phù hợp.</p>}
      {results.length > 0 && <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
        <thead><tr className="border-b border-line"><th className="p-2">Học sinh</th><th className="p-2">Trạng thái</th><th className="p-2">Điểm tổng hợp</th></tr></thead>
        <tbody>{results.map(row => <tr key={row.studentId} className="border-b border-line">
          <td className="p-2">{row.studentName ?? `Học sinh #${row.studentId}`}</td>
          <td className="p-2">{resultLabel[row.status] ?? row.status}</td>
          <td className="p-2">{row.status === "PENDING_GRADING" || row.status === "PENDING_REGRADE" || row.status === "VOID"
            ? "Chưa có điểm chính thức" : pointsLabel(row.aggregateScore)}{row.status === "PROVISIONAL" ? " (tạm thời)" : ""}</td>
        </tr>)}</tbody>
      </table></div>}
      {resultsLastPage > 1 && <div className="flex items-center gap-2">
        <button className={secondary} disabled={resultsLoading || resultsPage <= 1} onClick={() => void loadResults(resultsPage - 1, resultsQuery, resultsStatus)}>Trước</button>
        <span>{resultsPage}/{resultsLastPage}</span>
        <button className={secondary} disabled={resultsLoading || resultsPage >= resultsLastPage} onClick={() => void loadResults(resultsPage + 1, resultsQuery, resultsStatus)}>Sau</button>
      </div>}
      </section>}
      {currentSection === "settings" && <section className="space-y-3 rounded-xl bg-white p-4" aria-label="Ngoại lệ học sinh">
        <h5 className="font-bold">Ngoại lệ học sinh</h5>
      <div className="flex flex-wrap items-end gap-2 rounded-xl bg-white p-3">
        <label className="text-sm">Tìm học sinh trong lớp<input className="mt-1 block min-h-11 rounded-xl border border-line px-3"
          value={rosterQuery} onChange={event => setRosterQuery(event.target.value)} placeholder="Tên hoặc mã học sinh" /></label>
        <label className="text-sm">Chọn học sinh<select className="mt-1 block min-h-11 rounded-xl border border-line px-3"
          value={studentId} onChange={event => setStudentId(event.target.value)}>
          <option value="">{rosterLoading ? "Đang tìm…" : "Chọn từ danh sách"}</option>
          {roster.map(item => <option key={item.id} value={item.linkedUserId ?? ""}>{item.fullName} · {item.studentCode}</option>)}
        </select></label>
        <label className="text-sm">Mã học sinh<input className="mt-1 block min-h-11 rounded-xl border border-line px-3" value={studentId} onChange={event => setStudentId(event.target.value)} /></label>
        <button className={secondary} disabled={busy || distribution.lifecycleStatus !== "active"} onClick={grant}>Cấp thêm lượt</button>
        <button className={secondary} disabled={busy || distribution.lifecycleStatus !== "active"} onClick={exception}>Ngoại lệ riêng</button>
      </div>
      </section>}
      {currentSection === "grading" && detail && <div className="space-y-3 rounded-xl bg-white p-4">
        <h5 className="font-bold">{detail.studentName ?? `Học sinh #${detail.studentId}`} · Lượt {detail.attemptNo}</h5>
        <p className="text-sm">{attemptLabel[detail.status] ?? detail.status} · {gradingLabel[detail.gradingStatus] ?? detail.gradingStatus} · Hết giờ {new Date(detail.expiresAt).toLocaleString("vi-VN")}</p>
        <p className="rounded-xl bg-slate-50 p-3 text-sm">Trắc nghiệm tự chấm: {pointsLabel(detail.autoScore)} · Tự luận đã chấm: {pointsLabel(detail.manualScore)} · {detail.totalScore === null ? "Tổng điểm: đang chờ chấm đủ tự luận" : `Điểm gốc hiện tại: ${pointsLabel(detail.totalScore)} / ${maximumTotal(detail.questions)}`}. Không có quy đổi điểm ở đợt này; điểm hiện tại chưa đồng nghĩa đã công bố cho học sinh.</p>
        {(detail.questions ?? []).map(question => <article key={question.id} className="rounded-xl border border-line p-3 text-sm">
          <p className="font-semibold">Câu {question.position}: {question.content.content} · {Number(question.maxPoints)} điểm</p>
          <p className="mt-2 whitespace-pre-wrap">Bài làm: {readableAnswer(question, detail.answers[question.id]?.answer ?? null)}</p>
          {question.type === "essay_text" && question.rubric?.rubricText && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-2">Gợi ý chấm: {question.rubric.rubricText}</p>}
          {detail.gradeItems?.filter(item => item.questionId === question.id).map(item => <p key={`${item.questionId}-${item.generation}`} className="mt-2 text-secondary">{item.source === "AUTO" ? "Điểm tự chấm" : "Điểm đã lưu"}: {pointsLabel(item.points)} / {pointsLabel(question.maxPoints)}</p>)}
          {question.type === "essay_text" && detail.status !== "IN_PROGRESS" && detail.answers[question.id]?.answer && <div className="mt-3 flex flex-wrap items-end gap-2">
            <label>Điểm (tối đa {pointsLabel(question.maxPoints)})<input className="mt-1 block min-h-11 w-24 rounded-xl border border-line px-2" inputMode="decimal" aria-label={`Điểm câu ${question.position}`}
              value={points[question.id] ?? ""} onChange={event => setPoints(previous => ({ ...previous, [question.id]: event.target.value }))} /></label>
            <label>Nhận xét<input className="mt-1 block min-h-11 rounded-xl border border-line px-2"
              value={feedback[question.id] ?? ""} onChange={event => setFeedback(previous => ({ ...previous, [question.id]: event.target.value }))} /></label>
            <button className={secondary} disabled={busy || !points[question.id] || detail.version === undefined} onClick={() => void saveGrade(question)}>Lưu điểm</button>
            <button className={secondary} disabled={busy || !points[question.id] || detail.version === undefined} onClick={() => void saveGrade(question, true)}>Lưu & chấm bài tiếp theo</button>
          </div>}
          <details className="mt-3"><summary className="cursor-pointer text-secondary">Thao tác nâng cao cho câu hỏi</summary>
          <button className={`${destructive} mt-3`} disabled={busy} onClick={() => {
            const reason = promptReason("Lý do vô hiệu câu hỏi cho toàn bộ đề:");
            if (reason && window.confirm("Toàn bộ lượt làm của các lớp dùng phiên bản đề này sẽ được chấm lại. Tiếp tục?"))
              void command(`invalidate:${detail.revisionId}:${question.id}`, key => invalidateRevisionQuestion(detail.revisionId, question.id, reason, key));
          }}>Vô hiệu câu và chấm lại</button>
          </details>
        </article>)}
        <details><summary className="cursor-pointer text-secondary">Thao tác nâng cao cho lượt làm</summary>
        <div className="flex flex-wrap gap-2">
          <button className={secondary} disabled={busy || detail.status !== "IN_PROGRESS" || distribution.lifecycleStatus !== "active"} onClick={extend}>Gia hạn lượt</button>
          <button className={destructive} disabled={busy || detail.status === "REVOKED" || detail.status === "CANCELLED"} onClick={revoke}>Thu hồi lượt</button>
        </div>
        </details>
      </div>}
    </>}
  </section>;
}
