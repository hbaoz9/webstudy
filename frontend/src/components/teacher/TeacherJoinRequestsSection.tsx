import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../service/api/client";
import { getTeacherClassroomRoster, type TeacherRosterEntry } from "../../service/api/classrooms";
import {
  approveTeacherJoinRequest, getTeacherJoinRequests, manuallyVerifyTeacherJoinRequest, rejectTeacherJoinRequest,
  type ApiPage, type ClassroomJoinRequest,
} from "../../service/api/joinRequests";
import { JoinRequestCard } from "./JoinRequestCard";
import { ManualVerificationModal } from "./ManualVerificationModal";
import type { ManualVerificationPayload } from "../../types/teacher";

type Review = { request: ClassroomJoinRequest; action: "approve" | "reject" };

export function TeacherJoinRequestsSection({ classroomId, archived, onMembershipChange, onRosterChange }: {
  classroomId: string;
  archived: boolean;
  onMembershipChange: () => Promise<void>;
  onRosterChange?: () => void;
}) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: ApiPage<ClassroomJoinRequest>; error?: string } | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const actionLock = useRef(false);
  const [manualRequest, setManualRequest] = useState<ClassroomJoinRequest | null>(null);
  const [manualRevision, setManualRevision] = useState(0);
  const [manualRoster, setManualRoster] = useState<{ entries?: TeacherRosterEntry[]; error?: string } | null>(null);
  const [manualError, setManualError] = useState("");
  const key = JSON.stringify([classroomId, page, revision]);
  const current = result?.key === key ? result : null;
  const loading = !current;

  useEffect(() => {
    if (archived) { setReview(null); setManualRequest(null); }
  }, [archived]);

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
    void getTeacherJoinRequests(classroomId, page)
      .then((data) => { if (active) setResult({ key, data }); })
      .catch((cause) => {
        if (!active) return;
        const message = cause instanceof ApiError && cause.status === 401 ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
          : cause instanceof ApiError && cause.status === 403 ? "Bạn không có quyền xem yêu cầu của lớp này."
            : cause instanceof ApiError && cause.status === 404 ? "Không tìm thấy lớp học."
              : cause instanceof Error ? cause.message : "Không thể tải yêu cầu tham gia.";
        setResult({ key, error: message });
      });
    return () => { active = false; };
  }, [classroomId, page, revision, key]);

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
      {!loading && current?.data && <span className="self-start rounded-full bg-amber/10 px-4 py-2 text-xs font-bold text-amber-700 sm:self-auto">{current.data.meta.total} yêu cầu</span>}
    </div>
    {archived && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-secondary">Lớp đã lưu trữ. Yêu cầu chỉ có thể xem.</p>}
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
      <div className="mt-5 flex flex-wrap gap-3 border-b border-line pb-3 text-sm font-bold text-emerald">Tất cả yêu cầu <span className="rounded-full bg-emerald/10 px-2 text-xs">{current.data.meta.total}</span></div>
      {current.data.data.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center"><p className="font-bold text-ink">Chưa có yêu cầu tham gia</p><p className="mt-2 text-sm text-muted">Các yêu cầu mới sẽ xuất hiện tại đây.</p></div>
        : <div className="mt-5 space-y-4">{current.data.data.map((request) => <JoinRequestCard key={request.id} request={request}
          onApprove={() => startReview(request, "approve")} onReject={() => startReview(request, "reject")}
          onManualVerify={() => { if (!archived && !actionLock.current) { setManualError(""); setManualRequest(request); } }}
          showManualVerify={!archived} showActions={!archived && request.status === "pending"} actionsDisabled={processing} />)}</div>}
      {current.data.meta.last_page > 1 && <nav aria-label="Phân trang yêu cầu tham gia" className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="min-h-11 rounded-xl border border-line bg-white px-4 font-bold text-emerald disabled:opacity-50">Trang trước</button>
        <span>Trang {current.data.meta.current_page} / {current.data.meta.last_page}</span>
        <button type="button" disabled={page >= current.data.meta.last_page} onClick={() => setPage((value) => value + 1)} className="min-h-11 rounded-xl border border-line bg-white px-4 font-bold text-emerald disabled:opacity-50">Trang sau</button>
      </nav>}
    </>}
  </section>;
}
