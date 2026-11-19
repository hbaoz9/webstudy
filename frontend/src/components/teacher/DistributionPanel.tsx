import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../../service/api/client";
import { useAuth } from "../../contexts/AuthContext";
import { listTeacherClassrooms, type TeacherClassroom } from "../../service/api/classrooms";
import {
  createDistributions, listDistributions, previewDistribution, type Distribution,
  type DistributionInput, type DistributionPreview,
} from "../../service/api/distributions";

const panel = "rounded-2xl border border-line bg-white p-4 shadow-card sm:p-6";
const button = "min-h-11 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const secondary = "min-h-11 rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50";
const statusLabels: Record<Distribution["status"], string> = {
  scheduled: "Chưa mở", open: "Đang mở", expired: "Đã hết hạn",
  closed: "Ngừng nhận lượt mới", cancelled: "Đã hủy",
};

type Props = { revisionId?: string; assessmentId?: string; classId?: string | null; initialDistributionId?: string | null;
  onDirtyChange?: (dirty: boolean) => void; onCreated?: () => void; showForm?: boolean; targetTab?: "grading" | "results" };

function localDateTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  return date.getFullYear() === Number(match[1]) && date.getMonth() + 1 === Number(match[2])
    && date.getDate() === Number(match[3]) ? date : null;
}

function DateTimeField({ label, value, onChange, disabled, error }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean; error?: string }) {
  const [date = "", time = ""] = value.split("T");
  return <fieldset className="min-w-0 text-sm"><legend>{label}</legend>
    <div className="mt-1 grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
      <label className="min-w-0"><span className="sr-only">Ngày {label}</span><input aria-label={`Ngày ${label}`} type="date" lang="vi-VN"
        className="min-h-11 w-full min-w-0 rounded-xl border border-line px-2" disabled={disabled} value={date}
        onChange={event => onChange(event.target.value ? `${event.target.value}T${time || "08:00"}` : "")} /></label>
      <label><span className="sr-only">Giờ {label}</span><input aria-label={`Giờ ${label}`} type="text" inputMode="numeric" placeholder="HH:mm" maxLength={5}
        className="min-h-11 w-full rounded-xl border border-line px-2" disabled={disabled} value={time}
        onChange={event => onChange(`${date}T${event.target.value}`)} /></label>
    </div><p className="mt-1 text-xs text-secondary">Ngày theo lịch địa phương (DD/MM/YYYY), giờ 24h (HH:mm).</p>
    {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
  </fieldset>;
}

export function DistributionPanel(props: Props) {
  const { session } = useAuth();
  return <DistributionPanelForOwner key={session?.userId ?? "none"} {...props} />;
}

function DistributionPanelForOwner({ revisionId, assessmentId, classId, initialDistributionId, onDirtyChange, onCreated, showForm = true, targetTab }: Props) {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<TeacherClassroom[]>([]);
  const [items, setItems] = useState<Distribution[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>(classId ? [classId] : []);
  const [opensAt, setOpensAt] = useState("");
  const [deadlineAt, setDeadlineAt] = useState("");
  const [minutes, setMinutes] = useState("45");
  const [maxAttempts, setMaxAttempts] = useState("1");
  const [deadlinePolicy, setDeadlinePolicy] = useState<"" | DistributionInput["deadlinePolicy"]>("");
  const [preview, setPreview] = useState<DistributionPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [notice, setNotice] = useState("");
  const [createUncertain, setCreateUncertain] = useState(false);
  const createKey = useRef<string | null>(null);
  const configDirty = Boolean(revisionId && (opensAt || deadlineAt || minutes !== "45" || maxAttempts !== "1" || deadlinePolicy ||
    selectedIds.length !== (classId ? 1 : 0) || (classId && selectedIds[0] !== classId)));
  useEffect(() => { onDirtyChange?.(configDirty); }, [onDirtyChange, configDirty]);
  useEffect(() => () => { onDirtyChange?.(false); }, [onDirtyChange]);

  const reload = useCallback(async () => {
    const response = await listDistributions(page, classId ?? undefined, assessmentId);
    setItems(response.data); setLastPage(response.meta.lastPage); setListError("");
  }, [page, classId, assessmentId]);

  useEffect(() => {
    let live = true;
    setLoading(true); setListError("");
    setItems([]);
    Promise.all([listTeacherClassrooms(), listDistributions(page, classId ?? undefined, assessmentId)])
      .then(([classrooms, response]) => {
        if (!live) return;
        setClasses(classrooms.filter(c => c.status === "active"));
        setItems(response.data); setLastPage(response.meta.lastPage);
      })
      .catch(() => { if (live) setListError("Không thể tải bài đã giao. Vui lòng thử lại."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [page, classId, assessmentId]);

  useEffect(() => { if (classId) setSelectedIds([classId]); }, [classId]);
  useEffect(() => {
    if (initialDistributionId) navigate(`/teacher/distributions/${encodeURIComponent(initialDistributionId)}`, { replace: true });
  }, [initialDistributionId, navigate]);
  const invalidatePreview = () => { setPreview(null); createKey.current = null; };

  const input = useMemo((): DistributionInput | null => {
    if (!revisionId || selectedIds.length === 0 || !deadlineAt || !deadlinePolicy) return null;
    const duration = Number(minutes);
    const attempts = Number(maxAttempts);
    if (!Number.isInteger(duration) || duration < 1 || duration > 240 || !Number.isInteger(attempts) || attempts < 1 || attempts > 5) return null;
    const deadline = localDateTime(deadlineAt);
    const opens = opensAt ? localDateTime(opensAt) : null;
    if (!deadline || (opensAt && !opens) || (opens && opens >= deadline) || deadline <= new Date()) return null;
    return { revisionId, classroomIds: selectedIds, opensAt: opens?.toISOString() ?? null,
      deadlineAt: deadline.toISOString(), timeLimitSeconds: duration * 60,
      maxAttempts: attempts, deadlinePolicy };
  }, [revisionId, selectedIds, opensAt, deadlineAt, minutes, maxAttempts, deadlinePolicy]);

  async function doPreview() {
    if (!input) return;
    setBusy(true); setError(""); setNotice("");
    try { setPreview(await previewDistribution(input)); }
    catch { setError("Không thể kiểm tra lịch giao bài. Vui lòng kiểm tra thông tin và thử lại."); }
    finally { setBusy(false); }
  }

  async function create() {
    if (!input || !preview?.creationEnabled || busy) return;
    if (!window.confirm(`Giao đề cho ${selectedIds.length} lớp theo lịch đã xem trước?`)) return;
    const key = createKey.current ?? crypto.randomUUID();
    createKey.current = key;
    setBusy(true); setError(""); setNotice("");
    try {
      const created = await createDistributions({ ...input, overlapConfirmationToken: preview.overlapConfirmationToken }, key);
      createKey.current = null; setPreview(null); setCreateUncertain(false);
      setOpensAt(""); setDeadlineAt(""); setMinutes("45"); setMaxAttempts("1"); setDeadlinePolicy("");
      setSelectedIds(classId ? [classId] : []);
      setNotice(`Đã giao bài cho ${created.distributions.length} lớp.`);
      onCreated?.();
      try { await reload(); }
      catch { setListError("Đã giao bài thành công nhưng chưa tải lại được danh sách. Chọn Thử lại để xem đợt giao."); }
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        createKey.current = null; setPreview(null);
        setCreateUncertain(false);
        setError("Lịch hoặc dữ liệu đã thay đổi. Xem trước và xác nhận lại trước khi giao.");
      } else if (cause instanceof ApiError && cause.status === 423) {
        setError("Tính năng giao bài chưa được mở sử dụng.");
      } else if (cause instanceof ApiError && [401, 403, 404, 422].includes(cause.status ?? 0)) {
        createKey.current = null;
        setError("Không thể giao bài với cấu hình hoặc quyền hiện tại. Kiểm tra thông tin và xem trước lại.");
      } else {
        setCreateUncertain(true);
        setError("Chưa xác định được bài đã giao hay chưa. Giữ nguyên cấu hình và kiểm tra danh sách; thử lại sẽ dùng cùng mã yêu cầu.");
      }
    } finally { setBusy(false); }
  }

  return <section className={`${panel} space-y-4`} aria-label="Bài đã giao">
    <div><h2 className="text-lg font-bold">Bài đã giao</h2><p className="text-sm text-secondary">Theo dõi lịch giao bài và trạng thái từng lớp.</p></div>
    {revisionId && showForm && <div className="space-y-3 rounded-xl border border-line p-3" aria-label="Cấu hình giao bài">
      <h3 className="font-semibold">Thiết lập giao bài</h3>
      <fieldset><legend className="text-sm font-semibold">Chọn lớp</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{classes.map(item =>
        <label key={item.id} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={createUncertain} checked={selectedIds.includes(item.id)} onChange={event => {
          invalidatePreview(); setSelectedIds(ids => event.target.checked ? [...ids, item.id] : ids.filter(id => id !== item.id));
        }} />{item.name}</label>)}</div>{selectedIds.length === 0 && <p className="mt-1 text-xs text-red-700">Chọn ít nhất một lớp.</p>}</fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <DateTimeField label="Mở lúc (để trống để mở ngay)" disabled={createUncertain} value={opensAt} onChange={value => { invalidatePreview(); setOpensAt(value); }} error={opensAt && !localDateTime(opensAt) ? "Nhập ngày và giờ mở hợp lệ." : undefined} />
        <DateTimeField label="Hạn kết thúc" disabled={createUncertain} value={deadlineAt} onChange={value => { invalidatePreview(); setDeadlineAt(value); }} error={!deadlineAt ? "Chọn hạn kết thúc." : !localDateTime(deadlineAt) || localDateTime(deadlineAt)! <= new Date() ? "Hạn kết thúc phải là thời điểm hợp lệ trong tương lai." : undefined} />
        <label className="text-sm">Thời lượng mỗi lượt (phút)<input className="mt-1 block min-h-11 w-full rounded-xl border border-line px-3" type="number" min={1} max={240} disabled={createUncertain} value={minutes} onChange={event => { invalidatePreview(); setMinutes(event.target.value); }} />{(!Number.isInteger(Number(minutes)) || Number(minutes) < 1 || Number(minutes) > 240) && <span className="mt-1 block text-xs text-red-700">Nhập từ 1 đến 240 phút.</span>}</label>
        <label className="text-sm">Số lượt làm<input className="mt-1 block min-h-11 w-full rounded-xl border border-line px-3" type="number" min={1} max={5} disabled={createUncertain} value={maxAttempts} onChange={event => { invalidatePreview(); setMaxAttempts(event.target.value); }} />{(!Number.isInteger(Number(maxAttempts)) || Number(maxAttempts) < 1 || Number(maxAttempts) > 5) && <span className="mt-1 block text-xs text-red-700">Nhập từ 1 đến 5 lượt.</span>}</label>
      </div>
      <label className="block text-sm">Khi đến hạn<select className="mt-1 block min-h-11 w-full rounded-xl border border-line px-3" disabled={createUncertain} value={deadlinePolicy} onChange={event => { invalidatePreview(); setDeadlinePolicy(event.target.value as typeof deadlinePolicy); }}>
        <option value="">Chọn chính sách</option><option value="HARD_DEADLINE">Đến hạn kết thúc, lượt làm phải dừng dù chưa hết thời lượng.</option>
        <option value="FINISH_STARTED_ATTEMPT">Người đã bắt đầu hợp lệ trước hạn được làm hết thời lượng đã cấp.</option>
      </select>{!deadlinePolicy && <span className="mt-1 block text-xs text-red-700">Chọn cách xử lý khi đến hạn.</span>}</label>
      {!input && <p className="text-sm text-amber-700" role="status">Chọn ít nhất một lớp, hạn kết thúc trong tương lai, thời lượng từ 1–240 phút, số lượt từ 1–5 và chính sách khi đến hạn. Giờ mở phải trước hạn kết thúc.</p>}
      <button type="button" className={secondary} disabled={busy || !input} onClick={() => void doPreview()} title={!input ? "Hoàn tất các thông tin giao bài trước khi xem lịch" : undefined}>Xem trước lịch giao</button>
      {preview && <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm" role="status">
        <p>{preview.revision.title} · {preview.revision.questionCount} câu · {selectedIds.length} lớp</p>
        <p>Hạn: {new Date(input!.deadlineAt).toLocaleString("vi-VN")}</p>
        {preview.overlaps.length > 0 && <p role="alert">Có {preview.overlaps.length} lịch trùng. Cần xác nhận riêng khi giao.</p>}
        {preview.creationEnabled ? <button type="button" className={button} disabled={busy} onClick={() => void create()}>Giao bài</button>
          : <p>Tính năng giao bài chưa được mở sử dụng. Có thể xem trước nhưng chưa tạo bài giao.</p>}
      </div>}
      {createUncertain && <button type="button" className={secondary} disabled={busy} onClick={() => {
        void reload().then(() => {
          if (window.confirm("Đã kiểm tra danh sách bài giao? Đổi cấu hình sẽ dùng mã yêu cầu mới.")) {
            createKey.current = null; setCreateUncertain(false); setPreview(null);
          }
        }).catch(() => setError("Không thể kiểm tra danh sách. Giữ nguyên cấu hình để thử lại."));
      }}>Kiểm tra danh sách trước khi đổi cấu hình</button>}
    </div>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {loading ? <p role="status">Đang tải bài đã giao...</p> : listError ? <div role="alert"><p>{listError}</p><button type="button" className={secondary} onClick={() => { setLoading(true); void reload().catch(() => setListError("Không thể tải bài đã giao. Vui lòng thử lại.")).finally(() => setLoading(false)); }}>Thử lại</button></div>
      : items.length === 0 ? <p className="text-sm text-secondary">Chưa có bài đã giao.</p> : <ul className="space-y-2">{items.map(item => <li key={item.id} className="grid min-w-0 gap-3 rounded-xl border border-line p-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0"><p className="break-words font-semibold">{item.assessmentTitle}</p>
          <p className="mt-1 break-words text-secondary">{item.classroomName} · {statusLabels[item.status]} · Hạn {new Date(item.deadlineAt).toLocaleString("vi-VN")}</p></div>
        <Link className={`${secondary} inline-flex w-full items-center justify-center whitespace-nowrap sm:w-auto`}
          to={`/teacher/distributions/${encodeURIComponent(item.id)}${targetTab ? `?tab=${targetTab}` : ""}`}>{targetTab === "grading" ? "Chấm bài" : targetTab === "results" ? "Xem kết quả" : "Xem chi tiết"}</Link>
      </li>)}</ul>}
    {lastPage > 1 && <div className="flex gap-2"><button className={secondary} disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button><span>Trang {page}/{lastPage}</span><button className={secondary} disabled={page >= lastPage} onClick={() => setPage(page + 1)}>Sau</button></div>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
