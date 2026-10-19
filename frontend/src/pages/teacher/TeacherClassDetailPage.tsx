import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  ClipboardCopy,
  ClipboardList,
  GraduationCap,
  UsersRound,
  FileSpreadsheet,
  Search,
  CheckCheck,
  UserMinus,
  Settings,
} from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { TeacherStatCard } from "../../components/teacher/TeacherStatCard";

import { JoinRequestCard } from "../../components/teacher/JoinRequestCard";

import { useTeacherData } from "../../contexts/TeacherDataContext";
import { useTeacherAssignments } from "../../contexts/TeacherAssignmentsContext";

import type {
  JoinRequest,
  ClassRosterEntry,
  RosterImportRow,
  ManualVerificationPayload,
  JoinRequestStatus,
  VerificationStatus,
  Classroom,
} from "../../types/teacher";

import { RosterImportModal } from "../../components/teacher/RosterImportModal";

import {
  buildImportedRoster,
  isCodeBlocked,
  normalizeStudentCode,
  resolveJoinRequestVerification,
} from "../../utils/rosterMatching";

import { ManualVerificationModal } from "../../components/teacher/ManualVerificationModal";

import { ClassSettingsModal } from "../../components/teacher/ClassSettingsModal";

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

type RosterStatusFilter = "all" | "joined" | "not_joined" | "conflict";

export default function TeacherClassDetailPage() {
  const navigate = useNavigate();
  const { hash } = useLocation();
  const { classId } = useParams();

  const {
    classrooms,
    getClassroom,
    getJoinRequests,
    getRosterEntries,
    updateClassJoinRequests,
    updateClassRoster,
    updateClassroom,
    deleteClassroom,
  } = useTeacherData();

  const { deleteClassAssignmentData } = useTeacherAssignments();

  const classroom = classId ? getClassroom(classId) : undefined;
  useEffect(() => {
    if (hash !== "#join-requests") return;
    const frame = window.requestAnimationFrame(() => document.getElementById("join-requests")?.scrollIntoView());
    return () => window.cancelAnimationFrame(frame);
  }, [classId, hash, classroom]);

  const [copied, setCopied] = useState(false);

  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);

  const [manualVerificationRequest, setManualVerificationRequest] =
    useState<JoinRequest | null>(null);

  const [activeRequestTab, setActiveRequestTab] =
    useState<JoinRequestStatus>("pending");

  const [requestSearch, setRequestSearch] = useState("");

  const [verificationFilter, setVerificationFilter] = useState<
    VerificationStatus | "all"
  >("all");

  const requests = classId ? getJoinRequests(classId) : [];

  const rosterEntries = classId ? getRosterEntries(classId) : [];

  const requestsWithConflicts = requests.map((request) =>
    request.status === "pending" && isCodeBlocked(request, requests, rosterEntries)
      ? { ...request, verificationStatus: "conflict" as const }
      : request,
  );

  const setRequests = (
    update: JoinRequest[] | ((currentRequests: JoinRequest[]) => JoinRequest[]),
  ) => {
    if (!classId) {
      return;
    }

    updateClassJoinRequests(classId, update);
  };

  const setRosterEntries = (
    update:
      | ClassRosterEntry[]
      | ((currentEntries: ClassRosterEntry[]) => ClassRosterEntry[]),
  ) => {
    if (!classId) {
      return;
    }

    updateClassRoster(classId, update);
  };

  const [rosterSearch, setRosterSearch] = useState("");

  const [rosterStatusFilter, setRosterStatusFilter] =
    useState<RosterStatusFilter>("all");

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  if (!classroom) {
    return (
      <section className="rounded-2xl border border-line bg-white p-10 text-center">
        <h1 className="text-xl font-extrabold text-ink">
          Không tìm thấy lớp học
        </h1>

        <button
          type="button"
          onClick={() => navigate("/teacher/dashboard")}
          className="mt-5 rounded-full bg-emerald px-5 py-3 text-sm font-bold text-white"
        >
          Quay lại Dashboard
        </button>
      </section>
    );
  }

  const handleToggleArchive = () => {
    const nextStatus = classroom.status === "archived" ? "active" : "archived";

    updateClassroom(classroom.id, {
      status: nextStatus,
    });

    setIsSettingsModalOpen(false);

    if (nextStatus === "archived") {
      navigate("/teacher/classes", {
        replace: true,
      });
    }
  };

  const handleDeleteClassroom = () => {
    deleteClassAssignmentData(classroom.id);
    deleteClassroom(classroom.id);

    navigate("/teacher/classes", {
      replace: true,
    });
  };

  const handleSaveClassSettings = (changes: Partial<Classroom>) => {
    updateClassroom(classroom.id, changes);

    setIsSettingsModalOpen(false);
  };

  const normalizedRosterSearch = normalizeSearchText(rosterSearch);

  const filteredRosterEntries = rosterEntries.filter((entry) => {
    const matchesSearch =
      !normalizedRosterSearch ||
      normalizeSearchText(
        [entry.fullName, entry.studentCode].join(" "),
      ).includes(normalizedRosterSearch);

    const matchesStatus =
      rosterStatusFilter === "all" || entry.status === rosterStatusFilter;

    return matchesSearch && matchesStatus;
  });

  const joinedRosterCount = rosterEntries.filter(
    (entry) => entry.status === "joined",
  ).length;

  const notJoinedRosterCount = rosterEntries.filter(
    (entry) => entry.status === "not_joined",
  ).length;

  const conflictRosterCount = rosterEntries.filter(
    (entry) => entry.status === "conflict",
  ).length;

  const pendingRequests = requestsWithConflicts.filter(
    (request) => request.status === "pending",
  );

  const approvedRequests = requests.filter(
    (request) => request.status === "approved",
  );

  const rejectedRequests = requests.filter(
    (request) => request.status === "rejected",
  );

  const currentTabRequests = requestsWithConflicts.filter(
    (request) => request.status === activeRequestTab,
  );

  const normalizedRequestSearch = normalizeSearchText(requestSearch);

  const visibleRequests = currentTabRequests.filter((request) => {
    const matchesVerification =
      verificationFilter === "all" ||
      request.verificationStatus === verificationFilter;

    if (!matchesVerification) {
      return false;
    }

    if (!normalizedRequestSearch) {
      return true;
    }

    const searchableContent = normalizeSearchText(
      [
        request.studentName,
        request.studentCode,
        request.declaredClass,
        request.email,
      ].join(" "),
    );

    return searchableContent.includes(normalizedRequestSearch);
  });

  const bulkApprovableRequests = pendingRequests.filter(
    (request) => request.verificationStatus === "matched",
  );

  const requestTabs: {
    value: JoinRequestStatus;
    label: string;
    count: number;
  }[] = [
    {
      value: "pending",
      label: "Chờ duyệt",
      count: pendingRequests.length,
    },
    {
      value: "approved",
      label: "Đã duyệt",
      count: approvedRequests.length,
    },
    {
      value: "rejected",
      label: "Đã từ chối",
      count: rejectedRequests.length,
    },
  ];

  const handleApprove = (requestId: string) => {
    const requestToApprove = requests.find(
      (request) => request.id === requestId,
    );

    if (!requestToApprove || requestToApprove.status !== "pending") {
      return;
    }

    const canApprove =
      requestToApprove.verificationStatus === "matched" ||
      requestToApprove.verificationStatus === "manual_verified";

    if (!canApprove) {
      return;
    }

    setRequests((currentRequests) =>
      currentRequests.map((request) =>
        request.id === requestId
          ? {
              ...request,
              status: "approved",
            }
          : request,
      ),
    );

    const approvedStudentCode = normalizeStudentCode(
      requestToApprove.studentCode,
    );

    setRosterEntries((currentEntries) =>
      currentEntries.map((entry) =>
        normalizeStudentCode(entry.studentCode) === approvedStudentCode &&
        (!entry.linkedUserId ||
          entry.linkedUserId === requestToApprove.studentId)
          ? {
              ...entry,
              linkedUserId: requestToApprove.studentId,
              status: "joined",
            }
          : entry,
      ),
    );
  };

  const handleReject = (requestId: string) => {
    setRequests((currentRequests) =>
      currentRequests.map((request) =>
        request.id === requestId
          ? {
              ...request,
              status: "rejected",
            }
          : request,
      ),
    );
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(classroom.code);

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      setCopied(false);
    }
  };

  const handleRosterImport = (rows: RosterImportRow[]) => {
    const importedEntries: ClassRosterEntry[] = buildImportedRoster(rows, rosterEntries, classroom.id);

    setRosterEntries(importedEntries);

    /*
     * Tính lại trạng thái yêu cầu ngay
     * sau khi có danh sách Excel.
     */
    setRequests((currentRequests) =>
      currentRequests.map((request) => ({
        ...request,

        verificationStatus: resolveJoinRequestVerification(
          request,
          importedEntries,
          classroom.name,
        ),
      })),
    );
  };

  const handleRemoveStudent = (rosterEntryId: string) => {
    const targetStudent = rosterEntries.find(
      (entry) => entry.id === rosterEntryId,
    );

    if (!targetStudent || targetStudent.status !== "joined") {
      return;
    }

    const shouldRemove = window.confirm(
      `Gỡ ${targetStudent.fullName} khỏi lớp học?\n\nHọc sinh vẫn được giữ trong danh sách đối chiếu nhưng tài khoản sẽ không còn liên kết với lớp.`,
    );

    if (!shouldRemove) {
      return;
    }

    setRosterEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.id === rosterEntryId
          ? {
              ...entry,

              linkedUserId: undefined,

              status: "not_joined",
            }
          : entry,
      ),
    );
  };

  const handleManualVerification = (payload: ManualVerificationPayload) => {
    const targetRequest = requests.find(
      (request) => request.id === payload.requestId,
    );

    const targetRosterEntry = rosterEntries.find(
      (entry) => entry.id === payload.rosterEntryId,
    );

    if (!targetRequest || !targetRosterEntry) {
      return;
    }

    if (isCodeBlocked(targetRequest, requests, rosterEntries, targetRosterEntry.studentCode)) {
      window.alert(
        "Mã học sinh này đang có yêu cầu khác chờ duyệt hoặc đã liên kết với tài khoản khác.",
      );
      return;
    }

    /*
     * Không cho chiếm mã đang thuộc
     * tài khoản khác.
     */
    if (
      targetRosterEntry.linkedUserId &&
      targetRosterEntry.linkedUserId !== targetRequest.studentId
    ) {
      return;
    }

    const verifiedAt = new Date().toISOString();

    setRequests((currentRequests) =>
      currentRequests.map((request) =>
        request.id === payload.requestId
          ? {
              ...request,

              /*
               * Sửa mã trong yêu cầu thành
               * mã của dòng được giáo viên chọn.
               */
              studentCode: targetRosterEntry.studentCode,

              verificationStatus: "manual_verified",

              /*
               * Xác minh thủ công đồng thời
               * duyệt để giảm thao tác cho GV.
               */
              status: "approved",

              manualVerification: {
                rosterEntryId: targetRosterEntry.id,

                originalStudentCode: request.studentCode,

                resolvedStudentCode: targetRosterEntry.studentCode,

                reason: payload.reason,
                note: payload.note,
                verifiedAt,
              },
            }
          : request,
      ),
    );

    setRosterEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.id === payload.rosterEntryId
          ? {
              ...entry,
              linkedUserId: targetRequest.studentId,
              status: "joined",
            }
          : entry,
      ),
    );

    setManualVerificationRequest(null);
  };

  const handleApproveAllMatched = () => {
    if (bulkApprovableRequests.length === 0) {
      return;
    }

    const shouldApprove = window.confirm(
      `Duyệt ${bulkApprovableRequests.length} yêu cầu đã khớp danh sách lớp?`,
    );

    if (!shouldApprove) {
      return;
    }

    const approvedRequestIds = new Set(
      bulkApprovableRequests.map((request) => request.id),
    );

    const requestByStudentCode = new Map(
      bulkApprovableRequests.map((request) => [
        normalizeStudentCode(request.studentCode),
        request,
      ]),
    );

    setRequests((currentRequests) =>
      currentRequests.map((request) =>
        approvedRequestIds.has(request.id)
          ? {
              ...request,
              status: "approved",
            }
          : request,
      ),
    );

    setRosterEntries((currentEntries) =>
      currentEntries.map((entry) => {
        const matchedRequest = requestByStudentCode.get(
          normalizeStudentCode(entry.studentCode),
        );

        if (!matchedRequest) {
          return entry;
        }

        /*
         * Phòng trường hợp dữ liệu vừa thay đổi
         * trước khi giáo viên bấm duyệt.
         */
        if (
          entry.linkedUserId &&
          entry.linkedUserId !== matchedRequest.studentId
        ) {
          return entry;
        }

        return {
          ...entry,
          linkedUserId: matchedRequest.studentId,
          status: "joined",
        };
      }),
    );
  };

  return (
    <div className="space-y-7">
      {/* Quay lại */}
      <button
        type="button"
        onClick={() => navigate("/teacher/dashboard")}
        className="inline-flex items-center gap-2 text-sm font-bold text-secondary transition hover:text-emerald"
      >
        <ArrowLeft className="size-4" />
        Quay lại Dashboard
      </button>

      {/* Thông tin lớp */}
      <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        <div
          className="relative min-h-48 bg-gradient-to-br from-slate-600 to-ink bg-cover bg-center px-6 py-7 sm:px-8"
          style={
            classroom.coverImage
              ? {
                  backgroundImage: `url(${classroom.coverImage})`,
                }
              : undefined
          }
        >
          <div className="absolute inset-0 bg-ink/65" />

          <div className="relative z-10 flex min-h-32 flex-col justify-between gap-5 text-white sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold text-white/75">
                Chi tiết lớp học
              </p>

              <h1 className="mt-2 text-3xl font-extrabold">{classroom.name}</h1>

              <p className="mt-2 text-sm text-white/80">
                Quản lý học sinh, yêu cầu tham gia và tiến độ học tập.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 self-start sm:self-auto">
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white/15 px-5 text-sm font-bold backdrop-blur-sm transition hover:bg-white/25"
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <ClipboardCopy className="size-4" />
                )}

                {copied ? "Đã sao chép" : `Mã lớp: ${classroom.code}`}
              </button>

              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(true)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white/15 px-5 text-sm font-bold backdrop-blur-sm transition hover:bg-white/25"
              >
                <Settings className="size-4" />
                Cài đặt
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Thống kê */}
      <section className="grid gap-5 md:grid-cols-3">
        <TeacherStatCard
          label="Sĩ số lớp"
          value={classroom.studentCount}
          description="Học sinh đang tham gia"
          icon={UsersRound}
          tone="green"
        />

        <TeacherStatCard
          label="Tiến độ học"
          value="_"
          description="Chưa theo dõi bài học"
          icon={GraduationCap}
          tone="slate"
        />

        <TeacherStatCard
          label="Yêu cầu chờ duyệt"
          value={pendingRequests.length}
          description="Cần giáo viên kiểm tra"
          icon={ClipboardList}
          tone="amber"
        />
      </section>

      {/* Danh sách học sinh dùng để đối chiếu */}
      <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-extrabold text-ink">
              Danh sách học sinh
            </h2>

            <p className="mt-1 text-sm text-secondary">
              Dùng để đối chiếu mã học sinh khi có yêu cầu tham gia lớp.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsRosterModalOpen(true)}
            className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-full bg-ink px-5 text-sm font-bold text-white transition hover:bg-ink/90 sm:self-auto"
          >
            <FileSpreadsheet className="size-4" />

            {rosterEntries.length > 0
              ? "Thay danh sách Excel"
              : "Nhập danh sách Excel"}
          </button>
        </div>

        {rosterEntries.length > 0 && (
          <>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-secondary">
                Danh sách: {rosterEntries.length}
              </span>

              <span className="rounded-full bg-emerald/10 px-3 py-2 text-xs font-bold text-emerald">
                Đã tham gia: {joinedRosterCount}
              </span>

              <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-secondary">
                Chưa tham gia: {notJoinedRosterCount}
              </span>

              {conflictRosterCount > 0 && (
                <span className="rounded-full bg-red-50 px-3 py-2 text-xs font-bold text-red-600">
                  Xung đột: {conflictRosterCount}
                </span>
              )}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />

                <input
                  type="search"
                  value={rosterSearch}
                  onChange={(event) => setRosterSearch(event.target.value)}
                  placeholder="Tìm theo tên hoặc mã học sinh..."
                  className="min-h-11 w-full rounded-xl border border-line bg-white pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-muted focus:border-emerald focus:ring-2 focus:ring-emerald/10"
                />
              </div>

              <select
                value={rosterStatusFilter}
                onChange={(event) =>
                  setRosterStatusFilter(
                    event.target.value as RosterStatusFilter,
                  )
                }
                className="min-h-11 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink outline-none transition focus:border-emerald focus:ring-2 focus:ring-emerald/10"
              >
                <option value="all">Tất cả trạng thái</option>

                <option value="joined">Đã tham gia</option>

                <option value="not_joined">Chưa tham gia</option>

                <option value="conflict">Có xung đột</option>
              </select>
            </div>
          </>
        )}

        {rosterEntries.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-line bg-slate-50 px-6 py-10 text-center">
            <FileSpreadsheet className="mx-auto size-8 text-muted" />

            <p className="mt-3 font-bold text-ink">
              Chưa có danh sách đối chiếu
            </p>

            <p className="mt-1 text-sm text-muted">
              Tải danh sách Excel để hệ thống có thể xác minh học sinh tự động.
            </p>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-xl border border-line">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-secondary">
                <tr>
                  <th className="px-4 py-3">STT</th>

                  <th className="px-4 py-3">Họ và tên</th>

                  <th className="px-4 py-3">Mã học sinh</th>

                  <th className="px-4 py-3">Trạng thái</th>

                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-line">
                {filteredRosterEntries.map((student) => (
                  <tr key={student.id}>
                    <td className="px-4 py-3 text-muted">
                      {student.orderNumber}
                    </td>

                    <td className="px-4 py-3 font-semibold text-ink">
                      {student.fullName}
                    </td>

                    <td className="px-4 py-3 font-bold text-ink">
                      {student.studentCode}
                    </td>

                    <td className="px-4 py-3">
                      {student.status === "joined" ? (
                        <span className="rounded-full bg-emerald/10 px-3 py-1.5 text-xs font-semibold text-emerald">
                          Đã tham gia
                        </span>
                      ) : student.status === "conflict" ? (
                        <span className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600">
                          Có xung đột
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-secondary">
                          Chưa tham gia
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {student.status === "joined" ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveStudent(student.id)}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50"
                        >
                          <UserMinus className="size-4" />
                          Gỡ khỏi lớp
                        </button>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredRosterEntries.length === 0 && (
              <div className="border-t border-line px-6 py-10 text-center">
                <Search className="mx-auto size-7 text-muted" />

                <p className="mt-3 font-bold text-ink">
                  Không tìm thấy học sinh
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setRosterSearch("");
                    setRosterStatusFilter("all");
                  }}
                  className="mt-3 text-sm font-bold text-emerald"
                >
                  Xóa bộ lọc
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Yêu cầu tham gia */}
      <section id="join-requests" className="scroll-mt-24">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-xl font-extrabold text-ink">
              Yêu cầu tham gia lớp học
            </h2>

            <p className="mt-1 text-sm text-secondary">
              Kiểm tra và quản lý lịch sử yêu cầu tham gia lớp.
            </p>
          </div>

          <span className="self-start rounded-full bg-amber/10 px-4 py-2 text-xs font-bold text-amber-700 sm:self-auto">
            {pendingRequests.length} yêu cầu đang chờ
          </span>
        </div>

        {/* Tabs */}
        <div className="mt-5 flex gap-2 overflow-x-auto border-b border-line">
          {requestTabs.map((tab) => {
            const isActive = activeRequestTab === tab.value;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveRequestTab(tab.value)}
                className={`relative flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-bold transition ${
                  isActive ? "text-emerald" : "text-muted hover:text-ink"
                }`}
              >
                {tab.label}

                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    isActive
                      ? "bg-emerald/10 text-emerald"
                      : "bg-slate-100 text-muted"
                  }`}
                >
                  {tab.count}
                </span>

                {isActive && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-emerald" />
                )}
              </button>
            );
          })}
        </div>

        {/* Tìm kiếm và lọc */}
        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />

            <input
              type="search"
              value={requestSearch}
              onChange={(event) => setRequestSearch(event.target.value)}
              placeholder="Tìm theo tên hoặc mã học sinh..."
              className="min-h-11 w-full rounded-xl border border-line bg-white pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-muted focus:border-emerald focus:ring-2 focus:ring-emerald/10"
            />
          </div>

          <select
            value={verificationFilter}
            onChange={(event) =>
              setVerificationFilter(
                event.target.value as VerificationStatus | "all",
              )
            }
            aria-label="Lọc trạng thái xác minh"
            className="min-h-11 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-secondary outline-none transition focus:border-emerald focus:ring-2 focus:ring-emerald/10"
          >
            <option value="all">Tất cả trạng thái</option>

            <option value="matched">Khớp danh sách</option>

            <option value="unverified">Chưa xác minh</option>

            <option value="mismatch">Sai lớp</option>

            <option value="conflict">Mã đã có tài khoản</option>

            <option value="manual_verified">Đã xác nhận thủ công</option>
          </select>

          {activeRequestTab === "pending" &&
            bulkApprovableRequests.length > 0 && (
              <button
                type="button"
                onClick={handleApproveAllMatched}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-emerald px-5 text-sm font-bold text-white transition hover:bg-emerald/90"
              >
                <CheckCheck className="size-4" />
                Duyệt nhanh {bulkApprovableRequests.length} yêu cầu
              </button>
            )}
        </div>

        <p className="mt-3 text-xs text-muted">
          Hiển thị {visibleRequests.length} / {currentTabRequests.length} yêu
          cầu
        </p>

        {/* Danh sách theo tab */}
        {visibleRequests.length > 0 ? (
          <div className="mt-5 space-y-4">
            {visibleRequests.map((request) => (
              <JoinRequestCard
                key={request.id}
                request={request}
                onApprove={handleApprove}
                onReject={handleReject}
                onManualVerify={setManualVerificationRequest}
                showActions={activeRequestTab === "pending"}
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center">
            <p className="font-bold text-ink">
              {currentTabRequests.length > 0
                ? "Không tìm thấy yêu cầu phù hợp"
                : activeRequestTab === "pending"
                  ? "Không còn yêu cầu chờ duyệt"
                  : activeRequestTab === "approved"
                    ? "Chưa có yêu cầu được duyệt"
                    : "Chưa có yêu cầu bị từ chối"}
            </p>

            <p className="mt-2 text-sm text-muted">
              {currentTabRequests.length > 0
                ? "Thử thay đổi từ khóa hoặc bộ lọc trạng thái."
                : activeRequestTab === "pending"
                  ? "Các yêu cầu mới sẽ xuất hiện tại đây."
                  : "Lịch sử xử lý sẽ được lưu tại tab này."}
            </p>
          </div>
        )}
      </section>

      <RosterImportModal
        isOpen={isRosterModalOpen}
        className={classroom.name}
        onClose={() => setIsRosterModalOpen(false)}
        onImport={handleRosterImport}
      />

      <ManualVerificationModal
        request={manualVerificationRequest}
        rosterEntries={rosterEntries}
        onClose={() => setManualVerificationRequest(null)}
        onConfirm={handleManualVerification}
      />

      {isSettingsModalOpen && (
        <ClassSettingsModal
          classroom={classroom}
          classrooms={classrooms}
          onClose={() => setIsSettingsModalOpen(false)}
          onSave={handleSaveClassSettings}
          onToggleArchive={handleToggleArchive}
          onDelete={handleDeleteClassroom}
        />
      )}
    </div>
  );
}
