import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Dialog from "../common/Dialog";
import { useTeacherAssignments } from "../../contexts/TeacherAssignmentsContext";
import { useTeacherData } from "../../contexts/TeacherDataContext";
import type { AssignmentV2 } from "../../types/assignment";
import { formatAssignmentDeadline } from "../../utils/assignmentQuestion";

function localDeadline(value?: string) {
  const date = new Date(value || Date.now());
  return Number.isFinite(date.getTime())
    ? new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "";
}

export default function AssignmentActions({ assignment, variant = "toolbar" }: {
  assignment: AssignmentV2; variant?: "toolbar" | "menu";
}) {
  const { extendAssignmentDeadline, submissions } = useTeacherAssignments();
  const { classrooms, getRosterEntries } = useTeacherData();
  const [action, setAction] = useState<"extend" | "remind" | null>(null);
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copying, setCopying] = useState(false);
  const modalAttempt = useRef(0);
  useEffect(() => () => { modalAttempt.current++; }, []);
  const classroom = classrooms.find((item) => item.id === assignment.classroomId);
  const active = !!classroom && classroom.status !== "archived";
  const submittedIds = new Set(submissions.filter((item) => item.assignmentId === assignment.id).map((item) => item.studentId));
  const roster = [...new Map(getRosterEntries(assignment.classroomId)
    .filter((entry) => entry.status === "joined" && entry.linkedUserId)
    .map((entry) => [entry.linkedUserId!, entry])).values()];
  const missing = roster.filter((entry) => !submittedIds.has(entry.linkedUserId!));
  const targetNames = missing.map((entry) => entry.fullName).join(", ");
  const expired = Date.parse(assignment.dueAt || "") <= Date.now();
  const reminder = `${classroom?.name || "Lớp học"} — Nhắc nộp bài “${assignment.title}”\nHạn nộp: ${formatAssignmentDeadline(assignment.dueAt)}\nCác bạn chưa nộp: ${targetNames}\nVào WebStudy → Bài tập & Kiểm tra → ${assignment.title} để hoàn thành và nộp bài.`;
  function close() { modalAttempt.current++; setAction(null); setError(""); setCopying(false); }
  function open(next: "extend" | "remind", button: HTMLButtonElement) {
    button.closest("details")?.removeAttribute("open");
    modalAttempt.current++; setAction(next); setDeadline(localDeadline(assignment.dueAt)); setError(""); setNotice("");
  }
  function extend() {
    try {
      if (!deadline) throw new Error("Vui lòng chọn ngày và giờ hạn mới.");
      extendAssignmentDeadline(assignment.id, new Date(deadline).toISOString());
      setNotice(`Đã gia hạn đến ${formatAssignmentDeadline(new Date(deadline).toISOString())}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể gia hạn bài."); }
  }
  async function copyReminder() {
    const attempt = modalAttempt.current;
    setError(""); setNotice(""); setCopying(true);
    try {
      await navigator.clipboard.writeText(reminder);
      if (attempt === modalAttempt.current) setNotice("Đã sao chép lời nhắc. Hãy dán vào nhóm lớp để gửi.");
    } catch {
      if (attempt === modalAttempt.current) setError("Không sao chép tự động được. Chọn nội dung bên dưới và sao chép thủ công.");
    } finally { if (attempt === modalAttempt.current) setCopying(false); }
  }
  const buttonClass = variant === "menu"
    ? "flex min-h-11 w-full items-center rounded-lg px-2 text-left text-sm font-semibold hover:bg-canvas disabled:opacity-40"
    : "min-h-11 rounded-xl border border-line bg-white px-4 text-sm font-bold disabled:opacity-40";
  if (assignment.status !== "published") return null;
  return <>
    <div className={variant === "toolbar" ? "flex flex-wrap gap-2" : ""}>
      <button type="button" disabled={!active} onClick={(event) => open("extend", event.currentTarget)} className={buttonClass}>Gia hạn</button>
      <button type="button" disabled={!active} onClick={(event) => open("remind", event.currentTarget)} className={buttonClass}>Nhắc nộp bài</button>
    </div>
    {notice && !action && <p role="status" className={variant === "menu" ? "sr-only" : "mt-2 text-sm text-emerald-800"}>{notice}</p>}
    {action && createPortal(<Dialog title={action === "extend" ? `Gia hạn: ${assignment.title}` : `Nhắc nộp: ${assignment.title}`} onClose={close}>
      {action === "extend" && notice ? <div className="space-y-4">
        <p role="status" className="text-sm font-bold text-emerald-800">{notice}</p>
        <button type="button" onClick={close} className="min-h-11 rounded-xl border border-line px-4 text-sm font-bold">Hoàn tất</button>
      </div> : action === "extend" ? <div className="space-y-4">
        <p className="text-sm">Hạn hiện tại: <strong>{formatAssignmentDeadline(assignment.dueAt)}</strong>
        </p>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="min-w-0 text-sm font-bold">Ngày<input aria-label="Ngày hạn mới" type="date" value={deadline.split("T")[0] || ""} onChange={(event) => setDeadline(event.target.value ? `${event.target.value}T${deadline.split("T")[1] || "23:59"}` : "")} className="mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-line px-3 font-normal" />
          </label>
          <label className="min-w-0 text-sm font-bold">Giờ<input aria-label="Giờ hạn mới" type="time" value={deadline.split("T")[1] || "23:59"} onChange={(event) => { if (event.target.value) setDeadline(`${deadline.split("T")[0] || localDeadline().split("T")[0]}T${event.target.value}`); }} className="mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-line px-3 font-normal" />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">{[1, 3, 7].map((days) => <button key={days} type="button" onClick={() => { const base = Math.max(Date.now(), Date.parse(assignment.dueAt || "") || 0); const date = new Date(base); date.setDate(date.getDate() + days); setDeadline(localDeadline(date.toISOString())); }} className="min-h-11 rounded-xl border border-line px-3 text-sm">Thêm {days} ngày</button>)}</div>
        <p className="text-sm text-secondary">Hạn mới phải trong tương lai và muộn hơn hạn hiện tại. Các bài đã nộp giữ nguyên kết quả.</p>
        {!active && <p role="alert" className="text-sm text-red-700">Lớp đã lưu trữ hoặc không còn tồn tại.</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={close} className="min-h-11 rounded-xl border border-line px-4 text-sm font-bold">Hủy</button>
          <button type="button" disabled={!active} onClick={extend} className="min-h-11 rounded-xl bg-emerald px-4 text-sm font-bold text-white disabled:opacity-40">Lưu hạn mới</button>
        </div>
      </div> : <div className="min-w-0 space-y-4">
        <p className="text-sm">
          <strong>{missing.length}/{roster.length}</strong> học sinh chưa nộp. Chỉ tính học sinh đã kết nối tài khoản.</p>
        {!!missing.length && <ul aria-label="Học sinh chưa nộp" className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-line p-3 text-sm">{missing.map((entry) => <li key={entry.linkedUserId} className="[overflow-wrap:anywhere]">{entry.fullName}{entry.studentCode ? ` · ${entry.studentCode}` : ""}</li>)}</ul>}
        {!missing.length ? <p className="text-sm text-secondary">{roster.length ? "Tất cả học sinh đã kết nối tài khoản đều đã nộp." : "Lớp chưa có học sinh đã kết nối tài khoản."}</p> : expired ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Bài đã hết hạn, học sinh chưa thể nộp. Gia hạn trước khi nhắc làm bài.</p> : <>
          <p className="text-sm text-secondary">WebStudy hiện chưa gửi thông báo trực tiếp. Sao chép lời nhắc để gửi qua nhóm lớp.</p>
          <label className="block text-sm font-bold">Nội dung lời nhắc<textarea aria-label="Nội dung lời nhắc" readOnly value={reminder} rows={6} onFocus={(event) => event.target.select()} className="mt-2 w-full rounded-xl border border-line p-3 text-sm font-normal" />
          </label>
          {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button type="button" disabled={copying || !active} onClick={() => void copyReminder()} className="min-h-11 rounded-xl bg-emerald px-4 text-sm font-bold text-white disabled:opacity-40">{copying ? "Đang sao chép…" : "Sao chép lời nhắc"}</button>
        </>}
        {expired && !!missing.length && <button type="button" disabled={!active} onClick={() => { modalAttempt.current++; setCopying(false); setNotice(""); setAction("extend"); setDeadline(localDeadline(assignment.dueAt)); setError(""); }} className="min-h-11 rounded-xl bg-emerald px-4 text-sm font-bold text-white disabled:opacity-40">Gia hạn trước</button>}
      </div>}
    </Dialog>, document.body)}
  </>;
}
