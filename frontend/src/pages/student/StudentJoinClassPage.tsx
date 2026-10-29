import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { ApiError } from "../../service/api/client";
import {
  createStudentJoinRequest, getStudentActiveMemberships, getStudentJoinRequests,
  lookupStudentClassroom, type ClassroomJoinRequest, type ClassroomMembership, type ClassroomPreview,
} from "../../service/api/joinRequests";

const requestLabels = { pending: "Chờ giáo viên duyệt", approved: "Đã duyệt", rejected: "Bị từ chối" };

const formatRequestedAt = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("vi-VN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
};

export default function StudentJoinClassPage() {
  const { session } = useAuth();
  const [classCode, setClassCode] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [declaredClass, setDeclaredClass] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lookup, setLookup] = useState<{ code: string; classroom?: ClassroomPreview; error?: string } | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [requests, setRequests] = useState<ClassroomJoinRequest[]>([]);
  const [memberships, setMemberships] = useState<ClassroomMembership[]>([]);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const statusGeneration = useRef(0);

  const normalizedClassCode = classCode.trim().toUpperCase();
  const currentLookup = lookup?.code === normalizedClassCode ? lookup : null;
  const targetClassroom = currentLookup?.classroom;
  const latestRequest = targetClassroom ? requests.find((request) => request.classroomId === targetClassroom.id) : undefined;
  const isJoined = targetClassroom ? memberships.some((membership) => membership.classroom.id === targetClassroom.id && membership.status === "active") : false;
  const joinState = isJoined ? "joined" : latestRequest?.status ?? "none";
  const activeMembership = memberships.find((membership) => membership.status === "active");
  const sortedRequests = [...requests].sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt));
  const isSubmitLocked = submitting || lookupLoading || statusLoading || Boolean(statusError) || !targetClassroom || joinState === "joined" || joinState === "pending";

  const loadStatus = useCallback(async () => {
    const generation = ++statusGeneration.current;
    setStatusLoading(true);
    setStatusError("");
    try {
      const [ownRequests, activeMemberships] = await Promise.all([getStudentJoinRequests(), getStudentActiveMemberships()]);
      if (generation !== statusGeneration.current) return;
      setRequests(ownRequests.sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt)));
      setMemberships(activeMemberships);
    } catch (cause) {
      if (generation === statusGeneration.current) setStatusError(cause instanceof Error ? cause.message : "Không thể tải trạng thái tham gia lớp.");
    } finally {
      if (generation === statusGeneration.current) setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    return () => { ++statusGeneration.current; };
  }, [loadStatus]);

  useEffect(() => {
    if (!normalizedClassCode) { setLookup(null); setLookupLoading(false); return; }
    let active = true;
    setLookupLoading(true);
    const timer = window.setTimeout(() => {
      void lookupStudentClassroom(normalizedClassCode)
        .then((classroom) => { if (active) setLookup({ code: normalizedClassCode, classroom }); })
        .catch((cause) => {
          if (!active) return;
          setLookup({ code: normalizedClassCode, error: cause instanceof ApiError && cause.status === 404
            ? "Không tìm thấy lớp đang hoạt động với mã lớp này." : cause instanceof Error ? cause.message : "Không thể tra mã lớp." });
        })
        .finally(() => { if (active) setLookupLoading(false); });
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [normalizedClassCode]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitLock.current || isSubmitLocked || !targetClassroom) return;
    setError("");
    setSuccess("");
    const trimmedStudentCode = studentCode.trim();
    const trimmedDeclaredClass = declaredClass.trim();
    if (!trimmedStudentCode || !trimmedDeclaredClass) {
      setError("Vui lòng nhập mã học sinh và lớp đang học.");
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    try {
      const created = await createStudentJoinRequest({ class_code: normalizedClassCode, student_code: trimmedStudentCode, declared_class: trimmedDeclaredClass });
      setRequests((current) => [created, ...current]);
      setSuccess(`Đã gửi yêu cầu tham gia ${targetClassroom.name}. Vui lòng chờ giáo viên duyệt.`);
      await loadStatus();
    } catch (cause) {
      const details = cause instanceof ApiError ? Object.values(cause.errors).flat().join(" ") : "";
      setError(details || (cause instanceof Error ? cause.message : "Không thể gửi yêu cầu tham gia."));
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 py-6">
      {!statusLoading && !statusError && activeMembership && <section aria-labelledby="active-class-title" className="mx-auto mb-6 max-w-xl rounded-2xl border border-emerald/30 bg-emerald/10 p-6 shadow-card">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald">Lớp đang tham gia</p>
        <h1 id="active-class-title" className="mt-2 text-2xl font-extrabold text-ink">{activeMembership.classroom.name}</h1>
        <p className="mt-2 text-sm text-secondary">Năm học {activeMembership.classroom.academicYear}</p>
        {activeMembership.classroom.description && <p className="mt-3 text-sm text-secondary">{activeMembership.classroom.description}</p>}
        <Link to={`/student/classes/${activeMembership.classroom.id}`} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-emerald px-5 text-sm font-bold text-white">Xem lớp học</Link>
      </section>}
      {!statusLoading && !statusError && !activeMembership &&
      <form onSubmit={(event) => void handleSubmit(event)} className="mx-auto max-w-xl space-y-4 rounded-2xl border border-line bg-white p-6 shadow-card">
        <h1 className="text-2xl font-extrabold text-ink">Tham gia lớp học</h1>
        <p className="text-sm text-secondary">Nhập mã lớp do giáo viên cung cấp và thông tin học sinh để gửi yêu cầu tham gia.</p>

        <div className="rounded-xl bg-canvas px-4 py-3 text-sm text-secondary">
          <p>Tài khoản: <strong className="text-ink">{session?.name ?? ""}</strong></p>
          <p className="mt-1 break-all">{session?.email ?? ""}</p>
        </div>

        <label className="block text-sm font-semibold text-ink">Mã lớp do giáo viên cung cấp
          <input required value={classCode} onChange={(event) => { setClassCode(event.target.value); setError(""); setSuccess(""); }} className="mt-2 h-12 w-full rounded-lg border border-line px-4" />
        </label>
        {lookupLoading && <p role="status" className="text-sm text-secondary">Đang tra mã lớp…</p>}
        {!lookupLoading && currentLookup?.error && <p role="alert" className="text-sm text-red-600">{currentLookup.error}</p>}
        {targetClassroom && (
          <div className="space-y-3 rounded-xl border border-line bg-canvas p-4">
            <div>
              <p className="text-xs font-semibold text-secondary">LỚP HỌC ĐƯỢC TÌM THẤY</p>
              <h2 className="mt-1 text-lg font-extrabold text-ink">{targetClassroom.name}</h2>
              <p className="mt-1 text-xs text-secondary">Năm học {targetClassroom.academicYear}</p>
              {targetClassroom.description && <p className="mt-2 text-sm text-secondary">{targetClassroom.description}</p>}
            </div>
            {joinState === "joined" && <p role="status" className="rounded-lg bg-emerald/10 p-3 text-sm text-emerald">Bạn đã là thành viên của lớp học này.</p>}
            {joinState === "pending" && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">Yêu cầu của bạn đang chờ giáo viên duyệt. Bạn không cần gửi lại.</p>}
            {joinState === "approved" && <p role="status" className="rounded-lg bg-sky-50 p-3 text-sm text-sky-700">Yêu cầu đã được duyệt. Hiện không có membership đang hoạt động trong lớp này.</p>}
            {joinState === "rejected" && <p role="status" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">Yêu cầu trước đó đã bị từ chối. Bạn có thể kiểm tra thông tin và gửi lại.</p>}
            {joinState === "none" && <p className="text-sm text-secondary">Lớp đang nhận yêu cầu tham gia. Vui lòng nhập chính xác thông tin học sinh.</p>}
          </div>
        )}

        <label className="block text-sm font-semibold text-ink">Mã học sinh trong danh sách lớp
          <input required value={studentCode} onChange={(event) => setStudentCode(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-line px-4" />
        </label>
        <label className="block text-sm font-semibold text-ink">Lớp đang học (ví dụ: 10A1)
          <input required value={declaredClass} onChange={(event) => setDeclaredClass(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-line px-4" />
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {success && <p role="status" className="text-sm text-emerald">{success}</p>}
        {statusLoading && <p role="status" className="text-sm text-secondary">Đang tải trạng thái yêu cầu…</p>}
        {statusError && <div role="alert" className="text-sm text-red-600">{statusError} <button type="button" onClick={() => void loadStatus()} className="font-bold underline">Thử lại</button></div>}
        <button type="submit" disabled={isSubmitLocked} className={`min-h-12 rounded-xl px-6 py-3 text-sm font-bold transition ${isSubmitLocked ? "cursor-not-allowed bg-slate-200 text-slate-500" : "bg-emerald text-white hover:opacity-90"}`}>
          {submitting ? "Đang gửi…" : joinState === "joined" ? "Đã tham gia lớp" : joinState === "pending" ? "Đang chờ giáo viên duyệt" : joinState === "rejected" ? "Gửi lại yêu cầu tham gia" : "Gửi yêu cầu tham gia"}
        </button>
        <div><Link to="/student/classes" className="text-sm font-bold text-emerald hover:underline">← Quay về Lớp học của tôi</Link></div>
      </form>}

      {statusLoading && <p role="status" className="mx-auto max-w-xl text-sm text-secondary">Đang tải trạng thái yêu cầu…</p>}
      {statusError && <div role="alert" className="mx-auto max-w-xl text-sm text-red-600">{statusError} <button type="button" onClick={() => void loadStatus()} className="font-bold underline">Thử lại</button></div>}

      <section aria-labelledby="join-history-title" className="mx-auto mt-6 max-w-xl rounded-2xl border border-line bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="join-history-title" className="text-lg font-extrabold text-ink">Yêu cầu đã gửi</h2>
          <button type="button" onClick={() => void loadStatus()} disabled={statusLoading} className="text-sm font-bold text-emerald disabled:opacity-50">Làm mới trạng thái</button>
        </div>
        {!statusLoading && !statusError && (requests.length === 0 ? <p className="mt-3 text-sm text-muted">Bạn chưa gửi yêu cầu tham gia lớp nào.</p> :
          <ul className="mt-4 space-y-3">{sortedRequests.map((request) => {
            return <li key={request.id} className="rounded-xl border border-line bg-canvas p-4 text-sm">
              <p className="font-bold text-ink">Mã học sinh: {request.studentCode}</p>
              <p className="mt-1 text-secondary">{requestLabels[request.status]}</p>
              <p className="mt-1 text-xs text-muted">Lớp khai báo: {request.declaredClass}</p>
              <p className="mt-1 text-xs text-muted">Gửi lúc: {formatRequestedAt(request.requestedAt)}</p>
            </li>;
          })}</ul>)}
      </section>
    </div>
  );
}
