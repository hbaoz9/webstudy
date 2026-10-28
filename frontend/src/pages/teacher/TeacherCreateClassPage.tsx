import { useRef, useState, type FormEvent } from "react";

import { ArrowLeft, ImageIcon, School } from "lucide-react";

import { useNavigate } from "react-router-dom";

import { ApiError } from "../../service/api/client";
import { createTeacherClassroom } from "../../service/api/classrooms";

import {
  getAcademicYearOptions,
  normalizeClassName,
} from "../../utils/classroom";

export default function TeacherCreateClassPage() {
  const navigate = useNavigate();

  const academicYearOptions = getAcademicYearOptions();

  const [classNameValue, setClassNameValue] = useState("");

  const [academicYear, setAcademicYear] = useState(academicYearOptions[1]);

  const [description, setDescription] = useState("");

  const [coverImageUrl, setCoverImageUrl] = useState("");

  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLock = useRef(false);

  const normalizedClassName = normalizeClassName(classNameValue);

  const displayedClassName = normalizedClassName
    ? `Lớp ${normalizedClassName}`
    : "Lớp chưa đặt tên";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitLock.current) return;
    setFormError("");
    setFieldErrors({});

    if (normalizedClassName.length < 2) {
      setFieldErrors({ name: "Tên lớp phải có ít nhất 2 ký tự." });

      return;
    }

    if (normalizedClassName.length > 255) {
      setFieldErrors({ name: "Tên lớp không được vượt quá 255 ký tự." });

      return;
    }

    const coverUrl = coverImageUrl.trim();
    if (coverUrl && (!/^https?:\/\//i.test(coverUrl) || coverUrl.length > 255)) {
      setFieldErrors({ cover_image_path: "Liên kết ảnh bìa phải là URL http(s) và không quá 255 ký tự." });
      return;
    }

    submitLock.current = true;
    setIsSubmitting(true);
    try {
      const classroom = await createTeacherClassroom({
        name: normalizedClassName,
        academic_year: academicYear,
        description: description.trim() || null,
        cover_image_path: coverUrl || null,
      });
      navigate(`/teacher/classes/${classroom.id}`, { replace: true });
    } catch (cause) {
      if (cause instanceof ApiError && Object.keys(cause.errors).length > 0) {
        const errors = Object.fromEntries(Object.entries(cause.errors).map(([field, messages]) => [field, messages[0]]));
        setFieldErrors(errors);
        if (Object.keys(errors).some((field) => !["name", "academic_year", "description", "cover_image_path"].includes(field))) {
          setFormError(Object.values(errors)[0]);
        }
      } else {
        setFormError(cause instanceof Error ? cause.message : "Không thể tạo lớp. Vui lòng thử lại.");
      }
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
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
          Thiết lập thông tin cơ bản. Mã lớp sẽ được hệ thống tạo sau khi lưu.
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
                  setFieldErrors((current) => ({ ...current, name: "" }));
                }}
                placeholder="Ví dụ: 10A1"
                maxLength={255}
                aria-invalid={Boolean(fieldErrors.name)}
                className="min-h-12 w-full rounded-xl border border-line bg-white pl-12 pr-4 text-sm text-ink outline-none transition placeholder:text-muted focus:border-emerald focus:ring-2 focus:ring-emerald/10"
              />
            </div>
            {fieldErrors.name && <p role="alert" className="mt-2 text-sm text-red-700">{fieldErrors.name}</p>}

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
              aria-invalid={Boolean(fieldErrors.academic_year)}
              onChange={(event) => {
                setAcademicYear(event.target.value);
                setFieldErrors((current) => ({ ...current, academic_year: "" }));
              }}
              className="mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-sm text-ink outline-none transition focus:border-emerald focus:ring-2 focus:ring-emerald/10"
            >
              {academicYearOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {fieldErrors.academic_year && <p role="alert" className="mt-2 text-sm text-red-700">{fieldErrors.academic_year}</p>}
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
              onChange={(event) => { setDescription(event.target.value); setFieldErrors((current) => ({ ...current, description: "" })); }}
              rows={4}
              maxLength={200}
              aria-invalid={Boolean(fieldErrors.description)}
              placeholder="Ví dụ: Lớp ôn thi THPT Quốc gia môn Địa lý."
              className="mt-2 w-full resize-none rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-emerald focus:ring-2 focus:ring-emerald/10"
            />
            {fieldErrors.description && <p role="alert" className="mt-2 text-sm text-red-700">{fieldErrors.description}</p>}
          </div>

          <div className="mt-5">
            <div className="flex items-center gap-2">
              <ImageIcon className="size-4 text-muted" />

              <p className="text-sm font-bold text-ink">Ảnh bìa</p>

              <span className="text-xs text-muted">Không bắt buộc</span>
            </div>

            <label htmlFor="cover-url" className="mt-3 block text-xs text-secondary">Liên kết ảnh công khai (http/https)</label>
            <input id="cover-url" type="url" maxLength={255} value={coverImageUrl} onChange={(event) => { setCoverImageUrl(event.target.value); setFieldErrors((current) => ({ ...current, cover_image_path: "" })); }} placeholder="https://example.com/anh-bia.jpg" aria-invalid={Boolean(fieldErrors.cover_image_path)} className="mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-sm text-ink outline-none transition placeholder:text-muted focus:border-emerald focus:ring-2 focus:ring-emerald/10" />
            <p className="mt-2 text-xs text-muted">Ảnh tải từ máy chưa được lưu qua API lớp học.</p>
            {fieldErrors.cover_image_path && <p role="alert" className="mt-2 text-sm text-red-700">{fieldErrors.cover_image_path}</p>}
          </div>
        </section>

        {/* Xem trước */}
        <aside className="self-start rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6 lg:sticky lg:top-24">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald">
            Xem trước lớp học
          </p>

          <div className="mt-4 overflow-hidden rounded-xl border border-line">
            <div className="relative min-h-40">
              {coverImageUrl.trim() ? (
                <img
                  src={coverImageUrl.trim()}
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
              <p className="mt-2 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-secondary">Được tạo tự động sau khi lưu</p>

              <p className="mt-4 text-sm leading-6 text-secondary">
                {description.trim() || "Chưa có mô tả cho lớp học này."}
              </p>

              <p className="mt-5 border-t border-line pt-4 text-xs text-muted">Sĩ số và thông tin lớp sẽ hiển thị sau khi tạo.</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald px-6 text-sm font-extrabold text-white transition hover:bg-emerald/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <School className="size-4" />

            {isSubmitting ? "Đang tạo lớp..." : "Tạo lớp học"}
          </button>

          {formError && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
          <p className="mt-3 text-center text-xs leading-5 text-muted">Sau khi tạo, bạn sẽ được chuyển đến chi tiết lớp.</p>
        </aside>
      </form>
    </div>
  );
}
