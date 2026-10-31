import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { ApiError } from "../../service/api/client";
import { getTeacherClassroomRoster, type TeacherRosterEntry } from "../../service/api/classrooms";
import {
  approveTeacherJoinRequest, executeTeacherBulkApproval, getTeacherJoinRequests, manuallyVerifyTeacherJoinRequest, previewTeacherBulkApproval, rejectTeacherJoinRequest,
  type BulkApprovalPreview, type BulkApprovalResult, type ClassroomJoinRequest, type TeacherJoinRequestPage,
} from "../../service/api/joinRequests";
import { JoinRequestCard } from "./JoinRequestCard";
import { ManualVerificationModal } from "./ManualVerificationModal";
import type { ManualVerificationPayload } from "../../types/teacher";

type Review = { request: ClassroomJoinRequest; action: "approve" | "reject" };
type PreviewEntry = BulkApprovalPreview["data"][number];

const bulkSkipLabels: Record<string, string> = {
  not_found: "Yêu cầu không còn trong lớp này.",
  already_processed: "Yêu cầu đã được xử lý.",
  not_matched: "Thông tin không còn khớp danh sách lớp.",
  student_ineligible: "Học sinh không còn đủ điều kiện tham gia.",
  roster_unavailable: "Dòng danh sách lớp không còn khả dụng.",
  claim_conflict: "Học sinh hoặc dòng danh sách đã được liên kết.",
  classroom_inactive: "Lớp không còn hoạt động.",
};

export function TeacherJoinRequestsSection({ classroomId, archived, onMembershipChange, onRosterChange }: {
  classroomId: string;
  archived: boolean;
  onMembershipChange: () => Promise<void>;
  onRosterChange?: () => void;
}) {
  const [page, setPage] = useState(1);
  const [queue, setQueue] = useState<"pending" | "processed">("pending");
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: TeacherJoinRequestPage; error?: string } | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const actionLock = useRef(false);
  const refreshLock = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [manualRequest, setManualRequest] = useState<ClassroomJoinRequest | null>(null);
  const [manualRevision, setManualRevision] = useState(0);
  const [manualRoster, setManualRoster] = useState<{ entries?: TeacherRosterEntry[]; error?: string } | null>(null);
  const [manualError, setManualError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [previewResult, setPreviewResult] = useState<{ key: string; data?: BulkApprovalPreview; error?: string } | null>(null);
  const [selectedPreviewIds, setSelectedPreviewIds] = useState<string[]>([]);
  const [bulkStep, setBulkStep] = useState<"select" | "confirm" | "submitting" | "result" | "error">("select");
  const [confirmationEntries, setConfirmationEntries] = useState<PreviewEntry[]>([]);
  const [bulkResult, setBulkResult] = useState<BulkApprovalResult | null>(null);
  const [bulkError, setBulkError] = useState("");
  const [bulkRefreshError, setBulkRefreshError] = useState("");
  const bulkLock = useRef(false);
  const classroomIdRef = useRef(classroomId);
  classroomIdRef.current = classroomId;
  const previewKey = JSON.stringify([classroomId, previewPage, previewRevision]);
  const previewCurrent = previewResult?.key === previewKey ? previewResult : null;
  const key = JSON.stringify([classroomId, queue, page, revision]);
  const current = result?.key === key ? result : null;
  const loading = !current;
  const counts = current?.data?.statusCounts ?? result?.data?.statusCounts;

  useEffect(() => {
    if (archived) { setReview(null); setManualRequest(null); setPreviewOpen(false); setSelectedPreviewIds([]); }
  }, [archived]);

  useEffect(() => {
    setPreviewOpen(false);
    setPreviewPage(1);
    setSelectedPreviewIds([]);
  }, [classroomId]);

  useEffect(() => {
    if (!previewOpen || archived) return;
    let active = true;
    void previewTeacherBulkApproval(classroomId, previewPage)
      .then((data) => {
        if (!active) return;
        if (previewPage > data.meta.lastPage) { setPreviewPage(data.meta.lastPage); return; }
        setPreviewResult({ key: previewKey, data });
      })
      .catch((cause) => {
        if (!active) return;
        setPreviewResult({ key: previewKey, error: cause instanceof Error ? cause.message : "Không thể tải danh sách xem trước." });
      });
    return () => { active = false; };
  }, [archived, classroomId, previewKey, previewOpen, previewPage, previewRevision]);

  const closePreview = () => {
    if (bulkLock.current) return;
    setPreviewOpen(false);
    setSelectedPreviewIds([]);
    setConfirmationEntries([]);
  };

  const changePreviewPage = (nextPage: number) => {
    setSelectedPreviewIds([]);
    setPreviewPage(nextPage);
  };

  const continueBulkApproval = () => {
    if (!previewCurrent?.data || bulkStep !== "select") return;
    const selected = new Set(selectedPreviewIds);
    const entries = previewCurrent.data.data.filter((entry) => selected.has(entry.requestId)).slice(0, 100);
    if (entries.length === 0) return;
    setConfirmationEntries(entries);
    setBulkStep("confirm");
  };

  const confirmBulkApproval = async () => {
    if (bulkLock.current || bulkStep !== "confirm" || archived || confirmationEntries.length === 0 || confirmationEntries.length > 100) return;
    bulkLock.current = true;
    setBulkStep("submitting");
    setBulkError("");
    setBulkRefreshError("");
    try {
      const response = await executeTeacherBulkApproval(classroomId, confirmationEntries.map((entry) => entry.requestId));
      if (classroomIdRef.current !== classroomId) return;
      setBulkResult(response);
      setBulkStep("result");
      setRevision((value) => value + 1);
      if (response.approvedCount > 0) {
        try { onRosterChange?.(); }
        catch { setBulkRefreshError("Đã xử lý yêu cầu nhưng chưa tải lại được danh sách học sinh. Vui lòng tải lại trang."); }
        try { await onMembershipChange(); }
        catch { setBulkRefreshError("Đã xử lý yêu cầu nhưng chưa tải lại được sĩ số. Vui lòng tải lại trang."); }
      }
    } catch (cause) {
      if (classroomIdRef.current !== classroomId) return;
      const details = cause instanceof ApiError ? Object.values(cause.errors).flat().join(" ") : "";
      setBulkError(details || (cause instanceof Error ? cause.message : "Không thể duyệt hàng loạt."));
      setBulkStep("error");
    } finally {
      bulkLock.current = false;
    }
  };

  const recheckBulkApproval = () => {
    setSelectedPreviewIds([]);
    setConfirmationEntries([]);
    setBulkResult(null);
    setBulkStep("select");
    setPreviewRevision((value) => value + 1);
  };

  useEffect(() => {
    if (!manualRequest) return;
    let active = true;
    setManualRoster(null);
    const load = async () => {
      const entries: TeacherRosterEntry[] = [];
      for (let rosterPage = 1, lastPage = 1; rosterPage <= lastPage; rosterPage += 1) {
        const response = await getTeacherClassroomRoster(classroomId, rosterPage);
        entries.push(...response.data);
        lastPage = response.meta.last_page;
      }
      return entries;
    };
    void load().then((entries) => { if (active) setManualRoster({ entries }); })
      .catch((cause) => { if (active) setManualRoster({ error: cause instanceof Error ? cause.message : "Không thể tải danh sách học sinh." }); });
    return () => { active = false; };
  }, [manualRequest, manualRevision, classroomId]);

  useEffect(() => {
    let active = true;
    void getTeacherJoinRequests(classroomId, page, queue)
      .then((data) => {
        if (!active) return;
        if (page > Math.max(1, data.meta.last_page)) { setPage(Math.max(1, data.meta.last_page)); return; }
        setResult({ key, data });
      })
      .catch((cause) => {
        if (!active) return;
        const message = cause instanceof ApiError && cause.status === 401 ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
          : cause instanceof ApiError && cause.status === 403 ? "Bạn không có quyền xem yêu cầu của lớp này."
            : cause instanceof ApiError && cause.status === 404 ? "Không tìm thấy lớp học."
              : cause instanceof Error ? cause.message : "Không thể tải yêu cầu tham gia.";
        setResult({ key, error: message });
      });
    return () => { active = false; };
  }, [classroomId, queue, page, revision, key]);

  const refreshQueue = () => {
    if (refreshLock.current || loading) return;
    refreshLock.current = true;
    setRefreshing(true);
    setRevision((value) => value + 1);
  };

  useEffect(() => {
    if (!refreshing || !current) return;
    refreshLock.current = false;
    setRefreshing(false);
  }, [refreshing, current]);

  const startReview = (request: ClassroomJoinRequest, action: Review["action"]) => {
    if (archived || actionLock.current || request.status !== "pending") return;
    if (action === "approve" && request.verificationStatus !== "matched" && request.verificationStatus !== "manual_verified") return;
    setActionError("");
    setNotice("");
    setReview({ request, action });
  };

  const confirmReview = async () => {
    if (!review || actionLock.current || archived) return;
    actionLock.current = true;
    setProcessing(true);
    setActionError("");
    try {
      if (review.action === "approve") {
        await approveTeacherJoinRequest(classroomId, review.request.id);
      } else {
        await rejectTeacherJoinRequest(classroomId, review.request.id);
      }
      setNotice(review.action === "approve" ? "Đã duyệt yêu cầu tham gia." : "Đã từ chối yêu cầu tham gia.");
      setReview(null);
      setRevision((value) => value + 1);
      if (review.action === "approve") {
        try { await onMembershipChange(); }
        catch { setActionError("Đã duyệt yêu cầu, nhưng chưa tải lại được sĩ số. Vui lòng tải lại trang."); }
      }
    } catch (cause) {
      const details = cause instanceof ApiError ? Object.values(cause.errors).flat().join(" ") : "";
      setActionError(details || (cause instanceof Error ? cause.message : "Không thể xử lý yêu cầu."));
    } finally {
      actionLock.current = false;
      setProcessing(false);
    }
  };

  const confirmManualVerification = async (payload: ManualVerificationPayload) => {
    if (!manualRequest || archived || actionLock.current || !manualRoster?.entries?.some((entry) => entry.id === payload.rosterEntryId && (!entry.linkedUserId || entry.linkedUserId === manualRequest.studentId))) return;
    actionLock.current = true;
    setProcessing(true);
    setManualError("");
    try {
      await manuallyVerifyTeacherJoinRequest(classroomId, manualRequest.id, {
        roster_entry_id: payload.rosterEntryId, reason: payload.reason, note: payload.note,
      });
      setManualRequest(null);
      setNotice("Đã xác minh và duyệt yêu cầu tham gia.");
      setRevision((value) => value + 1);
      onRosterChange?.();
      try { await onMembershipChange(); }
      catch { setActionError("Đã xác minh và duyệt, nhưng chưa tải lại được sĩ số. Vui lòng tải lại trang."); }
    } catch (cause) {
      const details = cause instanceof ApiError ? Object.values(cause.errors).flat().join(" ") : "";
      setManualError(details || (cause instanceof Error ? cause.message : "Không thể xác minh yêu cầu."));
    } finally {
      actionLock.current = false;
      setProcessing(false);
    }
  };

  return <section id="join-requests" aria-labelledby="join-requests-title" className="scroll-mt-24">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <h2 id="join-requests-title" className="text-xl font-extrabold text-ink">Yêu cầu tham gia lớp học</h2>
        <p className="mt-1 text-sm text-secondary">Kiểm tra và quản lý lịch sử yêu cầu tham gia lớp.</p>
      </div>
      <button type="button" onClick={refreshQueue} disabled={loading || refreshing} aria-label={refreshing ? "Đang làm mới yêu cầu" : "Làm mới yêu cầu"} title={refreshing ? "Đang làm mới yêu cầu" : "Làm mới yêu cầu"} className="grid size-11 shrink-0 place-items-center self-start rounded-full text-emerald hover:bg-emerald/10 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto">
        <RefreshCw className={`size-5 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
      </button>
    </div>
    <div role="tablist" aria-label="Trạng thái yêu cầu tham gia" className="mt-5 flex flex-wrap gap-2 border-b border-line pb-3">
      {(["pending", "processed"] as const).map((status) => <button key={status} type="button" role="tab" aria-selected={queue === status} disabled={processing} onClick={() => { if (queue !== status) { setQueue(status); setPage(1); setNotice(""); setActionError(""); } }} className={`min-h-11 rounded-full px-4 py-2 text-sm font-bold transition ${queue === status ? "bg-emerald text-white" : "bg-canvas text-secondary hover:bg-emerald/10"}`}>
        {status === "pending" ? "Chờ xử lý" : "Đã xử lý"} {counts ? `(${counts[status]})` : ""}
      </button>)}
    </div>
    {archived && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-secondary">Lớp đã lưu trữ. Yêu cầu chỉ có thể xem.</p>}
    {queue === "pending" && !archived && <button type="button" disabled={processing} onClick={() => {
      setSelectedPreviewIds([]); setConfirmationEntries([]); setBulkResult(null); setBulkStep("select");
      setPreviewPage(1); setPreviewRevision((value) => value + 1); setPreviewOpen(true);
    }} className="mt-4 min-h-11 rounded-full border border-emerald px-5 py-2 text-sm font-bold text-emerald hover:bg-emerald/10 disabled:opacity-50">
      Kiểm tra và duyệt hàng loạt
    </button>}
    {previewOpen && !archived && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) closePreview(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="bulk-preview-title" onKeyDown={(event) => { if (event.key === "Escape") closePreview(); }} className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-line p-4 sm:p-6">
          <div className="min-w-0">
            <h3 id="bulk-preview-title" className="text-lg font-extrabold text-ink">Duyệt hàng loạt</h3>
            <p className="mt-1 text-sm text-secondary">Đối chiếu học sinh trước khi duyệt.</p>
          </div>
          <button type="button" autoFocus disabled={bulkStep === "submitting"} onClick={closePreview} aria-label="Đóng xem trước duyệt hàng loạt" className="min-h-11 shrink-0 rounded-full border border-line px-4 text-sm font-bold text-secondary disabled:opacity-50">Đóng</button>
        </div>
        <div className="overflow-y-auto p-4 sm:p-6">
          {bulkStep === "select" && !previewCurrent && <p role="status" className="text-sm text-secondary">Đang tải danh sách xem trước…</p>}
          {bulkStep === "select" && previewCurrent?.error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{previewCurrent.error}
            <button type="button" onClick={() => { setSelectedPreviewIds([]); setPreviewRevision((value) => value + 1); }} className="ml-3 min-h-11 font-bold underline">Thử lại</button>
          </div>}
          {bulkStep === "select" && previewCurrent?.data && <>
            <div className="rounded-xl bg-canvas p-4 text-sm text-secondary">
              <p><strong className="text-ink">Đủ điều kiện: {previewCurrent.data.summary.eligibleTotal}</strong><span className="mx-2">·</span><strong className="text-ink">Cần xác minh: {previewCurrent.data.summary.requiresIndividualReviewTotal}</strong></p>
            </div>
            <p className="mt-3 text-sm font-semibold text-amber-700">Mã khớp chưa đảm bảo đúng người.</p>
            {previewCurrent.data.data.length === 0 ? <p className="mt-5 rounded-xl border border-dashed border-line p-6 text-center text-sm text-secondary">Không có yêu cầu đủ điều kiện trên trang này.</p> : <>
              <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm font-bold text-ink">
                <input type="checkbox" className="size-5 shrink-0 accent-emerald" checked={previewCurrent.data.data.every((entry) => selectedPreviewIds.includes(entry.requestId))} onChange={(event) => setSelectedPreviewIds(event.target.checked ? previewCurrent.data!.data.slice(0, 100).map((entry) => entry.requestId) : [])} />
                Chọn tất cả trang này
              </label>
              <ul className="mt-3 space-y-3">{previewCurrent.data.data.map((entry) => <li key={entry.requestId}>
                <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-line p-3 hover:bg-canvas sm:p-4">
                  <input type="checkbox" className="mt-1 size-5 shrink-0 accent-emerald" checked={selectedPreviewIds.includes(entry.requestId)} disabled={selectedPreviewIds.length >= 100 && !selectedPreviewIds.includes(entry.requestId)} onChange={(event) => setSelectedPreviewIds((ids) => event.target.checked ? ids.includes(entry.requestId) || ids.length >= 100 ? ids : [...ids, entry.requestId] : ids.filter((id) => id !== entry.requestId))} />
                  <span className="min-w-0 space-y-1 text-sm">
                    <span className="block break-words font-bold text-ink">Tài khoản: {entry.studentName}</span>
                    <span className="block break-all text-secondary">{entry.studentEmail}</span>
                    <span className="block break-words text-ink">Roster: {entry.rosterStudentName}</span>
                    <span className="block text-secondary">Mã gửi: {entry.submittedStudentCode} · Mã roster: {entry.rosterStudentCode}</span>
                  </span>
                </label>
              </li>)}</ul>
            </>}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <p role="status" className="text-sm font-semibold text-ink">Đã chọn: {selectedPreviewIds.length}/{previewCurrent.data.data.length}{previewCurrent.data.meta.lastPage > 1 && <span className="ml-2 font-normal text-secondary">· Đổi trang sẽ bỏ chọn</span>}</p>
              <button type="button" disabled={selectedPreviewIds.length === 0} onClick={continueBulkApproval} className="min-h-11 rounded-full bg-emerald px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Tiếp tục</button>
            </div>
            {previewCurrent.data.meta.lastPage > 1 && <nav aria-label="Phân trang xem trước duyệt hàng loạt" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
              <button type="button" disabled={previewPage <= 1} onClick={() => changePreviewPage(previewPage - 1)} className="min-h-11 rounded-xl border border-line px-4 font-bold text-emerald disabled:opacity-50">Trang trước</button>
              <span>Trang {previewCurrent.data.meta.currentPage} / {previewCurrent.data.meta.lastPage}</span>
              <button type="button" disabled={!previewCurrent.data.meta.hasMore} onClick={() => changePreviewPage(previewPage + 1)} className="min-h-11 rounded-xl border border-line px-4 font-bold text-emerald disabled:opacity-50">Trang sau</button>
            </nav>}
          </>}
          {bulkStep === "confirm" && <div className="space-y-4">
            <p className="text-lg font-bold text-ink">Duyệt {confirmationEntries.length} học sinh?</p>
            <p className="text-sm text-secondary">Backend sẽ kiểm tra lại điều kiện và có thể bỏ qua yêu cầu không còn hợp lệ.</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => setBulkStep("select")} className="min-h-11 rounded-full border border-line px-5 text-sm font-bold text-secondary">Quay lại</button>
              <button type="button" onClick={() => void confirmBulkApproval()} className="min-h-11 rounded-full bg-emerald px-5 text-sm font-bold text-white">Duyệt {confirmationEntries.length} học sinh</button>
            </div>
          </div>}
          {bulkStep === "submitting" && <p role="status" className="text-sm font-semibold text-secondary">Đang duyệt yêu cầu… Vui lòng chờ phản hồi từ hệ thống.</p>}
          {bulkStep === "error" && <div className="space-y-4">
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{bulkError}</p>
            <p className="text-sm text-secondary">Kiểm tra lại danh sách trước khi thử tiếp.</p>
            <button type="button" onClick={recheckBulkApproval} className="min-h-11 rounded-full border border-emerald px-5 text-sm font-bold text-emerald">Kiểm tra lại</button>
          </div>}
          {bulkStep === "result" && bulkResult && <div className="space-y-4">
            <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-800">Đã duyệt: {bulkResult.approvedCount} · Bỏ qua: {bulkResult.skippedCount}</p>
            {bulkResult.skippedCount > 0 && <div>
              <h4 className="text-sm font-bold text-ink">Yêu cầu cần kiểm tra lại</h4>
              <ul className="mt-2 space-y-2">{bulkResult.results.filter((entry) => entry.status === "skipped").map((entry) => <li key={entry.requestId} className="rounded-xl bg-canvas p-3 text-sm text-secondary">
                <span className="block break-words font-semibold text-ink">{confirmationEntries.find((selected) => selected.requestId === entry.requestId)?.studentName ?? entry.requestId}</span>
                <span>{bulkSkipLabels[entry.reason ?? ""] ?? "Điều kiện duyệt đã thay đổi. Vui lòng kiểm tra lại."}</span>
              </li>)}</ul>
            </div>}
            {bulkRefreshError && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{bulkRefreshError}</p>}
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={closePreview} className="min-h-11 rounded-full border border-line px-5 text-sm font-bold text-secondary">Đóng kết quả</button>
              <button type="button" onClick={recheckBulkApproval} className="min-h-11 rounded-full bg-emerald px-5 text-sm font-bold text-white">Kiểm tra đợt tiếp theo</button>
            </div>
          </div>}
        </div>
      </div>
    </div>}
    {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{notice}</p>}
    {actionError && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{actionError}</p>}
    {manualRequest && !manualRoster && <div role="status" className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-secondary">Đang tải danh sách học sinh để xác minh… <button type="button" onClick={() => setManualRequest(null)} className="ml-3 font-bold underline">Hủy</button></div>}
    {manualRequest && manualRoster?.error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{manualRoster.error} <button type="button" onClick={() => setManualRevision((value) => value + 1)} className="ml-3 font-bold underline">Thử lại</button><button type="button" onClick={() => setManualRequest(null)} className="ml-3 font-bold underline">Hủy</button></div>}
    {manualRequest && manualRoster?.entries && <ManualVerificationModal request={manualRequest} rosterEntries={manualRoster.entries} backendMode busy={processing} error={manualError}
      onClose={() => { if (!actionLock.current) setManualRequest(null); }} onConfirm={(payload) => void confirmManualVerification(payload)} />}
    {review && <div role="dialog" aria-label="Xác nhận xử lý yêu cầu" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <p className="font-bold text-ink">{review.action === "approve" ? "Duyệt" : "Từ chối"} yêu cầu của {review.request.studentName}?</p>
      <p className="mt-2 text-sm text-secondary">{review.action === "approve" ? "Backend sẽ tạo membership đang hoạt động sau khi xác nhận." : "Học sinh có thể kiểm tra thông tin và gửi yêu cầu mới sau khi bị từ chối."}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" disabled={processing} onClick={() => setReview(null)} className="min-h-11 rounded-full border border-line bg-white px-5 text-sm font-bold text-secondary disabled:opacity-50">Hủy</button>
        <button type="button" disabled={processing} onClick={() => void confirmReview()} className="min-h-11 rounded-full bg-emerald px-5 text-sm font-bold text-white disabled:opacity-50">{processing ? "Đang xử lý…" : "Xác nhận"}</button>
      </div>
    </div>}
    {loading && <p role="status" className="mt-5 text-sm text-secondary">Đang tải yêu cầu tham gia…</p>}
    {!loading && current?.error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{current.error}<button type="button" onClick={() => setRevision((value) => value + 1)} className="ml-3 font-bold underline">Thử lại</button></div>}
    {!loading && current?.data && <>
      <p className="mt-4 text-sm text-secondary">{current.data.meta.total} yêu cầu {queue === "pending" ? "chờ xử lý" : "đã xử lý"}</p>
      {current.data.data.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center"><p className="font-bold text-ink">{queue === "pending" ? "Không có yêu cầu chờ xử lý" : "Chưa có yêu cầu đã xử lý"}</p><p className="mt-2 text-sm text-muted">{queue === "pending" ? "Các yêu cầu mới sẽ xuất hiện tại đây." : "Yêu cầu đã duyệt hoặc từ chối sẽ xuất hiện tại đây."}</p></div>
        : queue === "pending" ? <div className="mt-5 space-y-4">{current.data.data.map((request) => <JoinRequestCard key={request.id} request={request}
          onApprove={() => startReview(request, "approve")} onReject={() => startReview(request, "reject")}
          onManualVerify={() => { if (!archived && !actionLock.current) { setManualError(""); setManualRequest(request); } }}
          showManualVerify={!archived} showActions={!archived && request.status === "pending"} actionsDisabled={processing} />)}</div>
          : <ul className="mt-5 divide-y divide-line rounded-2xl border border-line bg-white px-4 shadow-card sm:px-5">{current.data.data.map((request) => <li key={request.id} className="py-3 text-sm">
            <details className="group">
              <summary className="grid min-h-11 cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 font-semibold text-ink md:grid-cols-[minmax(0,1fr)_7rem_10rem]">
                <span className="min-w-0 break-words">{request.studentName}</span>
                <span className={request.status === "approved" ? "text-left text-emerald" : "text-left text-red-600"}>{request.status === "approved" ? "Đã duyệt" : "Bị từ chối"}</span>
                <time dateTime={request.requestedAt} className="col-span-2 text-xs font-normal text-secondary md:col-span-1 md:text-right">{new Date(request.requestedAt).toLocaleString("vi-VN")}</time>
              </summary>
              <div className="space-y-1 pb-2 pt-1 text-xs text-secondary">
                <p className="break-all">Email: {request.email}</p>
                <p>{request.studentCode ? `Mã học sinh: ${request.studentCode}` : "Chưa cung cấp mã học sinh"}</p>
                {request.declaredClass && <p>Lớp khai báo: {request.declaredClass}</p>}
              </div>
            </details>
          </li>)}</ul>}
      {current.data.meta.last_page > 1 && <nav aria-label="Phân trang yêu cầu tham gia" className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="min-h-11 rounded-xl border border-line bg-white px-4 font-bold text-emerald disabled:opacity-50">Trang trước</button>
        <span>Trang {current.data.meta.current_page} / {current.data.meta.last_page}</span>
        <button type="button" disabled={page >= current.data.meta.last_page} onClick={() => setPage((value) => value + 1)} className="min-h-11 rounded-xl border border-line bg-white px-4 font-bold text-emerald disabled:opacity-50">Trang sau</button>
      </nav>}
    </>}
  </section>;
}
