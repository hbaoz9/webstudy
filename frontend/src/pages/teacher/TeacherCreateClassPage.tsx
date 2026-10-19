import { useState, type FormEvent } from "react";

import { ArrowLeft, ImageIcon, RefreshCw, School } from "lucide-react";

import { useNavigate } from "react-router-dom";

import { useTeacherData } from "../../contexts/TeacherDataContext";

import { ClassCoverPicker } from "../../components/teacher/ClassCoverPicker";

import type { Classroom } from "../../types/teacher";

import {
  generateUniqueClassCode,
  getAcademicYearOptions,
  getComparableClassName,
  normalizeClassName,
} from "../../utils/classroom";

export default function TeacherCreateClassPage() {
  const navigate = useNavigate();

  const { classrooms, addClassroom } = useTeacherData();

  const academicYearOptions = getAcademicYearOptions();

  const [classNameValue, setClassNameValue] = useState("");

  const [academicYear, setAcademicYear] = useState(academicYearOptions[1]);

  const [description, setDescription] = useState("");

  const [isProcessingCover, setIsProcessingCover] = useState(false);

  const [selectedCoverImage, setSelectedCoverImage] = useState("");

  const [isCoverValid, setIsCoverValid] = useState(true);

  const [classCode, setClassCode] = useState(() =>
    generateUniqueClassCode(classrooms.map((classroom) => classroom.code)),
  );

  const [formError, setFormError] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedClassName = normalizeClassName(classNameValue);

  const displayedClassName = normalizedClassName
    ? `Lớp ${normalizedClassName}`
    : "Lớp chưa đặt tên";

  const handleRegenerateCode = () => {
    setClassCode(
      generateUniqueClassCode(classrooms.map((classroom) => classroom.code)),
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");

    if (isProcessingCover) {
      return;
    }

    if (!isCoverValid) {
      setFormError("Vui lòng kiểm tra lại ảnh bìa.");

      return;
    }

    if (normalizedClassName.length < 2) {
      setFormError("Tên lớp phải có ít nhất 2 ký tự.");

      return;
    }

    if (normalizedClassName.length > 30) {
      setFormError("Tên lớp không được vượt quá 30 ký tự.");

      return;
    }

    const duplicateClass = classrooms.some(
      (classroom) =>
        getComparableClassName(classroom.name) ===
          getComparableClassName(normalizedClassName) &&
        classroom.academicYear === academicYear,
    );

    if (duplicateClass) {
      setFormError(
        `Lớp ${normalizedClassName} đã tồn tại trong năm học ${academicYear}.`,
      );

      return;
    }

    setIsSubmitting(true);

    const classroomId =
      typeof window.crypto.randomUUID === "function"
        ? `class-${window.crypto.randomUUID()}`
        : `class-${Date.now()}`;

    const newClassroom: Classroom = {
      id: classroomId,
      name: `Lớp ${normalizedClassName}`,
      code: classCode,

      studentCount: 0,
      completionRate: 0,

      coverImage: selectedCoverImage,

      academicYear,

      description: description.trim(),

      status: "active",

      createdAt: new Date().toISOString(),
    };

    addClassroom(newClassroom);

    navigate(`/teacher/classes/${classroomId}`, {
      replace: true,
    });
  };

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate("/teacher/dashboard")}
        className="inline-flex items-center gap-2 text-sm font-bold text-secondary transition hover:text-emerald"
      >
        <ArrowLeft className="size-4" />
        Quay lại Dashboard
      </button>

      <div>
        <h1 className="text-2xl font-extrabold text-ink">Tạo lớp học mới</h1>

        <p className="mt-2 text-sm text-secondary">
          Thiết lập thông tin cơ bản. Sau khi tạo lớp, bạn có thể nhập danh sách
          học sinh bằng Excel.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]"
      >
        {/* Form */}
        <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
          <div>
            <label htmlFor="class-name" className="text-sm font-bold text-ink">
              Tên lớp
            </label>

            <div className="relative mt-2">
              <School className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />

              <input
                id="class-name"
                type="text"
                value={classNameValue}
                onChange={(event) => {
                  setClassNameValue(event.target.value);

                  setFormError("");
                }}
                placeholder="Ví dụ: 10A1"
                maxLength={30}
                className="min-h-12 w-full rounded-xl border border-line bg-white pl-12 pr-4 text-sm text-ink outline-none transition placeholder:text-muted focus:border-emerald focus:ring-2 focus:ring-emerald/10"
              />
            </div>

            <p className="mt-2 text-xs text-muted">
              Bạn có thể nhập “10A1” hoặc “Lớp 10A1”, hệ thống sẽ tự chuẩn hóa.
            </p>
          </div>

          <div className="mt-5">
            <label
              htmlFor="academic-year"
              className="text-sm font-bold text-ink"
            >
              Năm học
            </label>

            <select
              id="academic-year"
              value={academicYear}
              onChange={(event) => {
                setAcademicYear(event.target.value);

                setFormError("");
              }}
              className="mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-sm text-ink outline-none transition focus:border-emerald focus:ring-2 focus:ring-emerald/10"
            >
              {academicYearOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <label
                htmlFor="class-description"
                className="text-sm font-bold text-ink"
              >
                Mô tả lớp
              </label>

              <span className="text-xs text-muted">
                {description.length}/200
              </span>
            </div>

            <textarea
              id="class-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              maxLength={200}
              placeholder="Ví dụ: Lớp ôn thi THPT Quốc gia môn Địa lý."
              className="mt-2 w-full resize-none rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-emerald focus:ring-2 focus:ring-emerald/10"
            />
          </div>

          <div className="mt-5">
            <div className="flex items-center gap-2">
              <ImageIcon className="size-4 text-muted" />

              <p className="text-sm font-bold text-ink">Ảnh bìa</p>

              <span className="text-xs text-muted">Không bắt buộc</span>
            </div>

            <ClassCoverPicker
              value={selectedCoverImage}
              onChange={setSelectedCoverImage}
              onValidityChange={setIsCoverValid}
              onProcessingChange={setIsProcessingCover}
            />
          </div>
        </section>

        {/* Xem trước */}
        <aside className="self-start rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6 lg:sticky lg:top-24">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald">
            Xem trước lớp học
          </p>

          <div className="mt-4 overflow-hidden rounded-xl border border-line">
            <div className="relative min-h-40">
              {selectedCoverImage ? (
                <img
                  src={selectedCoverImage}
                  alt="Xem trước ảnh bìa"
                  className="absolute inset-0 size-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-slate-600 to-ink">
                  <ImageIcon className="size-10 text-white/50" />
                </div>
              )}

              <span className="absolute inset-0 bg-ink/60" />

              <div className="relative z-10 flex min-h-40 flex-col justify-end p-5 text-white">
                <h2 className="text-2xl font-extrabold">
                  {displayedClassName}
                </h2>

                <p className="mt-1 text-sm text-white/75">
                  Năm học {academicYear}
                </p>
              </div>
            </div>

            <div className="p-5">
              <p className="text-xs text-muted">Mã lớp</p>

              <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
                <strong className="tracking-[0.2em] text-ink">
                  {classCode}
                </strong>

                <button
                  type="button"
                  onClick={handleRegenerateCode}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald transition hover:text-emerald/80"
                >
                  <RefreshCw className="size-4" />
                  Tạo mã khác
                </button>
              </div>

              <p className="mt-4 text-sm leading-6 text-secondary">
                {description.trim() || "Chưa có mô tả cho lớp học này."}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 text-center">
                <div>
                  <p className="text-xl font-extrabold text-ink">0</p>

                  <p className="text-xs text-muted">Học sinh</p>
                </div>

                <div>
                  <p className="text-xl font-extrabold text-ink">0%</p>

                  <p className="text-xs text-muted">Hoàn thành</p>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isProcessingCover || !isCoverValid}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald px-6 text-sm font-extrabold text-white transition hover:bg-emerald/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <School className="size-4" />

            {isSubmitting ? "Đang tạo lớp..." : "Tạo lớp học"}
          </button>

          <p className="mt-3 text-center text-xs leading-5 text-muted">
            Sau khi tạo, bạn sẽ được chuyển đến trang quản lý lớp để nhập danh
            sách học sinh.
          </p>
        </aside>
      </form>
    </div>
  );
}
