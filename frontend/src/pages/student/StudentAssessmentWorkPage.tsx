import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { QuestionImageView } from "../../components/questions/QuestionImage";
import { ApiError } from "../../service/api/client";
import {
  getAttempt, getEligibility, getStudentDistribution, getStudentResult, listOwnAttempts,
  saveAttemptAnswer, startAttempt, submitAttempt,
  type Answer, type Attempt, type Eligibility, type PublicQuestion, type StudentDistribution, type StudentResult,
} from "../../service/api/attempts";

const button = "min-h-11 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50";
const secondary = "min-h-11 rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink disabled:opacity-50";
type SaveState = "saving" | "saved" | "failed";
type SaveJob = { answer: Answer; expectedVersion: number; key: string; running: boolean };
const sameAnswer = (a: Answer, b: Answer) => JSON.stringify(a) === JSON.stringify(b);
const attemptLabel: Record<string, string> = { IN_PROGRESS: "Đang làm", SUBMITTED: "Đã nộp", TIMED_OUT: "Hết giờ",
  REVOKED: "Đã thu hồi", CANCELLED: "Đã hủy" };
const gradingLabel: Record<string, string> = { NOT_GRADED: "Chưa chấm", PENDING_ESSAY: "Chờ chấm tự luận",
  GRADED: "Đã chấm", PENDING_REGRADE: "Đang chấm lại" };
const recoveryKey = (ownerId: string, attemptId: string) => `webstudy:attempt-recovery:${ownerId}:${attemptId}`;
function readRecovery(key: string): Record<string, Answer> {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(key) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, Answer> : {};
  } catch { return {}; }
}
function writeRecovery(key: string, data: Record<string, Answer>) {
  try { if (Object.keys(data).length) sessionStorage.setItem(key, JSON.stringify(data)); else sessionStorage.removeItem(key); return true; }
  catch { return false; }
}
function displayAnswerKey(key: Record<string, unknown> | null, question?: PublicQuestion): string {
  if (!key) return "Bài tự luận do giáo viên chấm.";
  const options = question?.content.options ?? [];
  const label = (id: string) => options.find(option => option.id === id)?.text ?? "Phương án không còn khả dụng";
  if (typeof key.correctOptionId === "string") return label(key.correctOptionId);
  if (Array.isArray(key.correctOptionIds)) return key.correctOptionIds.filter((id): id is string => typeof id === "string").map(label).join("; ");
  if (key.answersByStatementId && typeof key.answersByStatementId === "object")
    return (question?.content.statements ?? []).map(statement => `${statement.content}: ${(key.answersByStatementId as Record<string, boolean>)[statement.id] ? "Đúng" : "Sai"}`).join("; ");
  if (typeof key.correctAnswer === "boolean") return key.correctAnswer ? "Đúng" : "Sai";
  if (typeof key.correctAnswer === "string") return key.correctAnswer;
  return "Đáp án đã được công bố.";
}

function answerSummary(question: PublicQuestion, answer: Answer): string {
  if (!answer) return "Chưa trả lời";
  const option = (id: string) => question.content.options?.find(item => item.id === id)?.text ?? "Phương án không còn khả dụng";
  if ("optionId" in answer) return option(answer.optionId);
  if ("optionIds" in answer) return answer.optionIds.map(option).join("; ") || "Chưa chọn phương án";
  if ("answersByStatementId" in answer) return (question.content.statements ?? []).map(item =>
    `${item.content}: ${answer.answersByStatementId[item.id] === undefined ? "Chưa trả lời" : answer.answersByStatementId[item.id] ? "Đúng" : "Sai"}`).join("\n");
  if ("value" in answer) return typeof answer.value === "boolean" ? answer.value ? "Đúng" : "Sai" : answer.value;
  return answer.text || "Chưa trả lời";
}

function labelFor(reason: string | null) {
  const labels: Record<string, string> = {
    release_locked: "Chức năng làm bài chưa được mở.", policy_unset: "Bài chưa được thiết lập đủ điều kiện làm bài.",
    membership_inactive: "Bạn không còn là thành viên đang học của lớp.", distribution_unavailable: "Bài đã đóng hoặc hủy.",
    not_open: "Bài chưa tới giờ mở.", deadline_passed: "Đã qua hạn bắt đầu.",
    attempt_limit_reached: "Bạn đã dùng hết số lượt làm.", attempt_in_progress: "Bạn đang có lượt làm dở.",
    no_remaining_time: "Không còn thời gian để bắt đầu bài.",
  };
  return reason ? labels[reason] ?? "Hiện chưa thể bắt đầu lượt mới." : "Có thể bắt đầu lượt mới.";
}

function QuestionAnswer({ question, answer, disabled, onChange }: {
  question: PublicQuestion; answer: Answer; disabled: boolean; onChange: (value: Answer) => void;
}) {
  const content = question.content;
  const optionIds = "optionIds" in (answer ?? {}) ? (answer as { optionIds: string[] }).optionIds : [];
  const group = "answersByStatementId" in (answer ?? {}) ? (answer as { answersByStatementId: Record<string, boolean> }).answersByStatementId : {};
  return <fieldset disabled={disabled} className="space-y-3 rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5">
    <legend className="px-1 font-bold text-ink">Câu {question.position} · {Number(question.maxPoints)} điểm</legend>
    <p className="whitespace-pre-wrap text-sm leading-7 text-ink">{content.content}</p>
    <QuestionImageView image={content.image} />
    {question.type === "single_choice" && content.options?.map((option, index) =>
      <label key={option.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-line p-3 text-sm">
        <input type="radio" name={question.id} checked={(answer as { optionId?: string } | null)?.optionId === option.id}
          onChange={() => onChange({ optionId: option.id })} />{String.fromCharCode(65 + index)}. {option.text}</label>)}
    {question.type === "multiple_choice" && content.options?.map((option, index) =>
      <label key={option.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-line p-3 text-sm">
        <input type="checkbox" checked={optionIds.includes(option.id)} onChange={event => onChange({ optionIds: event.target.checked
          ? [...optionIds, option.id] : optionIds.filter(id => id !== option.id) })} />{String.fromCharCode(65 + index)}. {option.text}</label>)}
    {question.type === "true_false" && <div className="flex gap-3">{[true, false].map(value =>
      <label key={String(value)} className="flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm">
        <input type="radio" name={question.id} checked={(answer as { value?: boolean } | null)?.value === value}
          onChange={() => onChange({ value })} />{value ? "Đúng" : "Sai"}</label>)}</div>}
    {question.type === "true_false_group" && content.statements?.map((statement, index) =>
      <div key={statement.id} className="rounded-xl border border-line p-3 text-sm">
        <p>{index + 1}. {statement.content}</p><div className="mt-2 flex gap-3">{[true, false].map(value =>
          <label key={String(value)} className="flex min-h-11 items-center gap-2 px-2"><input type="radio" name={`${question.id}:${statement.id}`}
            checked={group[statement.id] === value} onChange={() => onChange({ answersByStatementId: { ...group, [statement.id]: value } })} />{value ? "Đúng" : "Sai"}</label>)}</div>
      </div>)}
    {question.type === "short_answer" && <label className="block text-sm">Đáp án số
      <input className="mt-2 min-h-11 w-full rounded-xl border border-line px-3" inputMode="decimal"
        value={(answer as { value?: string } | null)?.value ?? ""} onChange={event => onChange(event.target.value === "" ? null : { value: event.target.value })} /></label>}
    {question.type === "essay_text" && <label className="block text-sm">Bài làm tự luận
      <textarea className="mt-2 min-h-36 w-full rounded-xl border border-line p-3"
        value={(answer as { text?: string } | null)?.text ?? ""} onChange={event => onChange({ text: event.target.value })} /></label>}
  </fieldset>;
}

export default function StudentAssessmentWorkPage() {
  const { distributionId } = useParams();
  const { session } = useAuth();
  return <WorkSession key={`${session?.userId ?? "none"}:${distributionId ?? "none"}`}
    ownerId={session?.userId ?? "none"} distributionId={distributionId ?? ""} />;
}

function WorkSession({ distributionId, ownerId }: { distributionId: string; ownerId: string }) {
  const [distribution, setDistribution] = useState<StudentDistribution | null>(null);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [result, setResult] = useState<StudentResult | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [recovered, setRecovered] = useState<Record<string, Answer>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [clock, setClock] = useState(Date.now());
  const [clockAnchor, setClockAnchor] = useState<{ server: number; local: number } | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);
  const versions = useRef<Record<string, number>>({});
  const jobs = useRef<Record<string, SaveJob>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const desired = useRef<Record<string, Answer>>({});
  const live = useRef(true);
  const generation = useRef(0);
  const submitKey = useRef<string | null>(null);
  const viewedAttemptRequest = useRef(0);
  const attemptId = attempt?.id;

  useEffect(() => { live.current = true; return () => {
    live.current = false;
    generation.current += 1;
    Object.values(timers.current).forEach(clearTimeout);
  }; }, []);

  const adopt = useCallback((next: Attempt) => {
    generation.current += 1;
    Object.values(timers.current).forEach(clearTimeout);
    timers.current = {};
    submitKey.current = null;
    setAttempt(next);
    const restored: Record<string, Answer> = {};
    const nextVersions: Record<string, number> = {};
    for (const [id, state] of Object.entries(next.answers ?? {})) {
      restored[id] = state.answer; nextVersions[id] = state.version;
    }
    versions.current = nextVersions; jobs.current = {}; desired.current = restored;
    setAnswers(restored); setSaveStates({});
    const key = recoveryKey(ownerId, next.id);
    const localCopy = next.status === "IN_PROGRESS" ? readRecovery(key) : {};
    for (const [id, value] of Object.entries(localCopy))
      if (sameAnswer(value, restored[id] ?? null)) delete localCopy[id];
    if (next.status === "IN_PROGRESS") writeRecovery(key, localCopy);
    setRecovered(localCopy);
    setClockAnchor({ server: Date.parse(next.serverNow), local: Date.now() });
  }, [ownerId]);

  useEffect(() => {
    let current = true;
    viewedAttemptRequest.current += 1;
    generation.current += 1;
    Object.values(timers.current).forEach(clearTimeout);
    timers.current = {};
    setLoading(true); setBusy(false); setError(""); setDistribution(null); setAttempt(null);
    setAnswers({}); setSaveStates({}); setRecovered({}); jobs.current = {}; desired.current = {};
    void Promise.all([getStudentDistribution(distributionId), getEligibility(distributionId),
      listOwnAttempts(distributionId).catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.status === 404) return { data: [] as Attempt[] };
        throw cause;
      })]).then(async ([item, eligible, history]) => {
      const active = history.data.find(row => row.status === "IN_PROGRESS");
      const detail = history.data.length ? await getAttempt(active?.id ?? history.data[0].id) : null;
      const outcome = history.data.length ? await getStudentResult(distributionId) : null;
      if (!current) return;
      setDistribution(item); setEligibility(eligible); setAttempts(history.data); setResult(outcome);
      if (detail) adopt(detail); else { setAttempt(null); setAnswers({}); }
    }).catch(() => { if (current) setError("Không thể tải bài kiểm tra. Vui lòng thử lại."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [distributionId, reloadIndex, adopt]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const serverNow = clockAnchor ? clockAnchor.server + (clock - clockAnchor.local) : clock;
  const remaining = attempt?.status === "IN_PROGRESS" ? Math.max(0, Math.ceil((Date.parse(attempt.expiresAt) - serverNow) / 1000)) : 0;
  useEffect(() => {
    if (!attemptId || !attempt || attempt.status !== "IN_PROGRESS" || remaining > 0) return;
    const timer = window.setTimeout(() => setReloadIndex(index => index + 1), 1000);
    return () => clearTimeout(timer);
  }, [attemptId, attempt, remaining]);

  const flush = useCallback(async (questionId: string) => {
    if (!attemptId) return;
    const requestGeneration = generation.current;
    const existing = jobs.current[questionId];
    if (existing?.running) return;
    const nextAnswer = desired.current[questionId];
    const question = attempt?.questions?.find(item => item.id === questionId);
    if (question?.type === "short_answer" && nextAnswer &&
      "value" in nextAnswer && typeof nextAnswer.value === "string" &&
      !/^[+-]?\d+(?:[.,]\d+)?$/.test(nextAnswer.value.trim())) {
      setSaveStates(states => ({ ...states, [questionId]: "failed" }));
      setError("Đáp án số chưa hợp lệ. Hoàn tất số hoặc xóa đáp án trước khi nộp.");
      return;
    }
    if (question?.type === "essay_text" && nextAnswer && "text" in nextAnswer &&
      [...nextAnswer.text].length > 10000) {
      setSaveStates(states => ({ ...states, [questionId]: "failed" }));
      setError("Bài tự luận vượt quá 10.000 ký tự. Rút ngắn trước khi lưu.");
      return;
    }
    const current = existing ?? { answer: desired.current[questionId], expectedVersion: versions.current[questionId] ?? 0,
      key: crypto.randomUUID(), running: false };
    jobs.current[questionId] = current;
    current.running = true;
    setSaveStates(states => ({ ...states, [questionId]: "saving" }));
    try {
      const accepted = await saveAttemptAnswer(attemptId, questionId, current.answer, current.expectedVersion, current.key);
      if (!live.current || generation.current !== requestGeneration) return;
      versions.current[questionId] = accepted.version;
      delete jobs.current[questionId];
      if (!sameAnswer(desired.current[questionId], current.answer)) void flush(questionId);
      else {
        const key = recoveryKey(ownerId, attemptId);
        const pending = readRecovery(key);
        delete pending[questionId];
        writeRecovery(key, pending);
        setSaveStates(states => ({ ...states, [questionId]: "saved" }));
      }
    } catch (cause) {
      if (!live.current || generation.current !== requestGeneration) return;
      if (cause instanceof ApiError && [409, 422, 423].includes(cause.status ?? 0)) delete jobs.current[questionId];
      else current.running = false;
      setSaveStates(states => ({ ...states, [questionId]: "failed" }));
      setError(cause instanceof ApiError && cause.status === 409
        ? "Bài làm đã thay đổi hoặc hết giờ. Tải lại để kiểm tra đáp án máy chủ đã nhận."
        : "Có đáp án chưa đồng bộ. Kiểm tra kết nối và thử lưu lại trước khi nộp.");
    }
  }, [attempt, attemptId, ownerId]);

  function changeAnswer(questionId: string, answer: Answer) {
    desired.current[questionId] = answer;
    setRecovered(previous => { const next = { ...previous }; delete next[questionId]; return next; });
    if (jobs.current[questionId] && !jobs.current[questionId].running && !sameAnswer(jobs.current[questionId].answer, answer))
      delete jobs.current[questionId];
    setAnswers(previous => ({ ...previous, [questionId]: answer }));
    if (attemptId && !writeRecovery(recoveryKey(ownerId, attemptId), {
      ...readRecovery(recoveryKey(ownerId, attemptId)), [questionId]: answer,
    })) setError("Không thể giữ tạm câu trả lời. Hãy giữ trang mở cho đến khi thấy trạng thái Đã lưu.");
    setSaveStates(previous => ({ ...previous, [questionId]: "saving" }));
    clearTimeout(timers.current[questionId]);
    timers.current[questionId] = setTimeout(() => void flush(questionId), 400);
  }

  const unsynced = Object.values(saveStates).some(state => state !== "saved");
  useEffect(() => {
    if (!unsynced) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [unsynced]);

  async function start() {
    if (!eligibility?.canStart || busy) return;
    if (eligibility.effectiveRemainingSeconds < 300 && !window.confirm("Bài còn chưa đến 5 phút theo thời gian máy chủ. Bạn vẫn muốn bắt đầu?")) return;
    setBusy(true); setError("");
    try { adopt(await startAttempt(distributionId, crypto.randomUUID())); setReloadIndex(value => value + 1); }
    catch (cause) { setError(cause instanceof ApiError && cause.status === 423 ? "Chức năng làm bài chưa được mở." : "Không thể bắt đầu bài. Vui lòng tải lại điều kiện và thử lại."); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!attempt || attempt.status !== "IN_PROGRESS" || unsynced || busy) return;
    if (!window.confirm("Nộp bài ngay? Bạn sẽ không thể sửa đáp án trong lượt này.")) return;
    setBusy(true); setError("");
    const key = submitKey.current ?? crypto.randomUUID();
    submitKey.current = key;
    try { adopt(await submitAttempt(attempt.id, key)); setReloadIndex(value => value + 1); }
    catch {
      try {
        const serverAttempt = await getAttempt(attempt.id);
        if (serverAttempt.status !== "IN_PROGRESS") { adopt(serverAttempt); setReloadIndex(value => value + 1); }
        else setError("Chưa xác nhận được việc nộp bài. Kiểm tra kết nối rồi thử lại với cùng yêu cầu.");
      } catch { setError("Chưa xác nhận được việc nộp bài. Tải lại để kiểm tra trạng thái máy chủ."); }
    }
    finally { setBusy(false); }
  }

  async function viewAttempt(id: string) {
    if (busy || attempt?.id === id) return;
    const request = ++viewedAttemptRequest.current;
    setBusy(true); setError("");
    try {
      const selected = await getAttempt(id);
      if (live.current && request === viewedAttemptRequest.current) adopt(selected);
    } catch {
      if (live.current && request === viewedAttemptRequest.current)
        setError("Không thể tải lượt làm này. Vui lòng thử lại.");
    } finally {
      if (live.current && request === viewedAttemptRequest.current) setBusy(false);
    }
  }

  return <main className="mx-auto max-w-4xl space-y-5 pb-20">
    <Link to="/student/assessments" className="text-sm font-bold text-emerald-700">← Bài tập & Kiểm tra</Link>
    {loading ? <p role="status" className="rounded-2xl bg-white p-5">Đang tải bài làm từ máy chủ…</p>
      : error && !distribution ? <section role="alert" className="rounded-2xl bg-white p-5">{error}<button className={`${secondary} ml-3`} onClick={() => setReloadIndex(i => i + 1)}>Thử lại</button></section>
      : distribution && <>
        <header className="rounded-2xl border border-line bg-white p-5">
          <h1 className="text-2xl font-extrabold text-ink">{distribution.title}</h1>
          <p className="mt-2 text-sm text-secondary">{distribution.classroomName} · Hạn bắt đầu: {new Date(distribution.deadlineAt).toLocaleString("vi-VN")}</p>
        </header>
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {attempt?.status === "IN_PROGRESS" ? <>
          <div role="status" className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white p-3 shadow-card">
            <span>Thời gian còn lại theo máy chủ: <strong>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</strong></span>
            <span className="text-sm">{unsynced ? "Có đáp án chưa đồng bộ" : "Đáp án đã lưu trên máy chủ"}</span>
          </div>
          {(attempt.questions ?? []).map(question => <div key={question.id} className="space-y-1">
            {Object.prototype.hasOwnProperty.call(recovered, question.id) && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
              <p>Có câu trả lời từ lần mở trước chưa được lưu. Chỉ câu trả lời đã lưu thành công mới được tính.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className={secondary} onClick={() => { changeAnswer(question.id, recovered[question.id]);
                  setRecovered(previous => { const next = { ...previous }; delete next[question.id]; return next; }); }}>Dùng bản chưa đồng bộ</button>
                <button className={secondary} onClick={() => { const key = recoveryKey(ownerId, attempt.id);
                  const pending = readRecovery(key); delete pending[question.id]; writeRecovery(key, pending);
                  setRecovered(previous => { const next = { ...previous }; delete next[question.id]; return next; }); }}>Bỏ câu trả lời chưa lưu</button>
              </div>
            </div>}
            <QuestionAnswer question={question} answer={answers[question.id] ?? null} disabled={remaining === 0 || busy}
              onChange={value => changeAnswer(question.id, value)} />
            <p role="status" className="px-2 text-xs text-secondary">{saveStates[question.id] === "saving" ? "Đang lưu…" : saveStates[question.id] === "failed" ? "Lưu thất bại · Chưa đồng bộ" : saveStates[question.id] === "saved" ? "Đã lưu trên máy chủ" : "Chưa trả lời"}</p>
            {saveStates[question.id] === "failed" && <button className={secondary} onClick={() => void flush(question.id)}>Thử lưu lại</button>}
          </div>)}
          <button className={button} disabled={busy || unsynced || remaining === 0} onClick={() => void submit()}>Nộp bài</button>
          {unsynced && <p className="text-sm text-amber-700">Chờ các đáp án được xác nhận trước khi nộp.</p>}
        </> : <>
          {eligibility && <section className="rounded-2xl border border-line bg-white p-5">
            <p>{labelFor(eligibility.reasonCode)}</p>
            <p className="mt-2 text-sm text-secondary">Đã dùng {eligibility.usedAttempts}/{eligibility.effectiveAttemptLimit} lượt.</p>
            {eligibility.canStart && <button className={`${button} mt-4`} disabled={busy} onClick={() => void start()}>Bắt đầu làm bài</button>}
          </section>}
          {attempts.length > 0 && <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="font-bold">Lịch sử lượt làm</h2><ul className="mt-2 space-y-2 text-sm">{attempts.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>Lượt {row.attemptNo} · {attemptLabel[row.status] ?? row.status} · {gradingLabel[row.gradingStatus] ?? row.gradingStatus}</span>
              <button className={secondary} disabled={busy || attempt?.id === row.id} onClick={() => void viewAttempt(row.id)}>Xem lượt {row.attemptNo}</button>
            </li>)}</ul>
          </section>}
          {attempt && <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="font-bold">Bài làm lượt {attempt.attemptNo}</h2>
            <div className="mt-3 space-y-3">{(attempt.questions ?? []).map(question => <article key={question.id} className="rounded-xl border border-line p-3 text-sm">
              <p className="font-semibold">Câu {question.position}: {question.content.content}</p>
              <p className="mt-2 whitespace-pre-wrap">Bài làm: {answerSummary(question, attempt.answers?.[question.id]?.answer ?? null)}</p>
            </article>)}</div>
          </section>}
          {result && <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="font-bold">Kết quả</h2><p className="mt-2 text-sm">{result.status === "PENDING_GRADING" ? "Đang chờ giáo viên chấm tự luận." : result.status === "VOID" ? "Bài đã hủy; kết quả không còn hiệu lực." : result.status === "PROVISIONAL" ? "Điểm tạm thời, còn khả năng thay đổi." : "Kết quả đã hoàn tất."}</p>
            {result.scoreVisible && result.aggregateScore !== null && <p className="mt-2 font-bold">Điểm: {result.aggregateScore}</p>}
            {result.attemptScores?.some(row => row.score !== null) && <ul className="mt-3 space-y-1 text-sm">
              {result.attemptScores.map(row => <li key={row.attemptId}>Lượt {row.attemptNo}: {row.score === null ? "Đang chờ chấm" : `${Number(row.score)} điểm`}</li>)}
            </ul>}
            {result.answerVisible && result.answers && <div className="mt-4 space-y-3 border-t border-line pt-4">
              <h3 className="font-semibold">Đáp án và lời giải đã công bố</h3>
              {result.answers.map((item, index) => <div key={item.questionId} className="rounded-xl bg-slate-50 p-3 text-sm">
                <p className="font-semibold">Câu {attempt?.questions?.find(question => question.id === item.questionId)?.position ?? index + 1}</p>
                <p className="mt-1">{item.invalidated ? "Câu đã được vô hiệu; mọi lượt làm được cộng đủ điểm câu này." : displayAnswerKey(item.answerKey, attempt?.questions?.find(question => question.id === item.questionId))}</p>
                {item.explanation && <p className="mt-2 whitespace-pre-wrap text-secondary">{item.explanation}</p>}
              </div>)}
            </div>}
          </section>}
        </>}
      </>}
  </main>;
}
