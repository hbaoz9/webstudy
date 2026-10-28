import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  BookOpenText,
  Plus,
  Search,
  SearchX,
  UsersRound,
} from 'lucide-react';

import {
  Link,
} from 'react-router-dom';

import {
  TeacherClassCard,
} from '../../components/teacher/TeacherClassCard';

import {
  TeacherStatCard,
} from '../../components/teacher/TeacherStatCard';

import { listTeacherClassrooms, type TeacherClassroom } from '../../service/api/classrooms';

type ClassroomStatusFilter =
    | 'all'
    | 'active'
    | 'archived'

function normalizeSearchText(
  value: string,
) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export default function TeacherClassesPage() {
  const [classrooms, setClassrooms] = useState<TeacherClassroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setClassrooms([]);
    void listTeacherClassrooms()
      .then((items) => { if (active) setClassrooms(items); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải danh sách lớp.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);

  const [
    searchValue,
    setSearchValue,
  ] = useState('');

  const [
    academicYearFilter,
    setAcademicYearFilter,
  ] = useState('all');

  const [
    classroomStatusFilter,
    setClassroomStatusFilter,
  ] =
    useState<ClassroomStatusFilter>(
        'active',
    );

  const academicYearOptions =
    useMemo(() => {
      const years = classrooms
        .map(
          (classroom) =>
            classroom.academicYear,
        )
        .filter(
          (year): year is string =>
            typeof year === 'string' &&
            year.length > 0,
        );

      return Array.from(
        new Set(years),
      ).sort((firstYear, secondYear) =>
        secondYear.localeCompare(
          firstYear,
        ),
      );
    }, [classrooms]);

  const filteredClassrooms =
    useMemo(() => {
      const normalizedSearch =
        normalizeSearchText(
          searchValue,
        );

      return classrooms
        .filter((classroom) => {
          const matchesSearch =
            !normalizedSearch ||
            normalizeSearchText(
              [
                classroom.name,
                classroom.code,
                classroom.description ??
                  '',
              ].join(' '),
            ).includes(
              normalizedSearch,
            );

          const matchesAcademicYear =
            academicYearFilter ===
              'all' ||
            classroom.academicYear ===
              academicYearFilter;

          const classroomStatus =
            classroom.status ?? 'active';

          const matchesStatus =
            classroomStatusFilter ===
                'all' ||
            classroomStatus ===
                classroomStatusFilter;

          return (
            matchesSearch &&
            matchesAcademicYear &&
            matchesStatus
          );
        })
        .sort((firstClass, secondClass) =>
          (
            secondClass.createdAt ?? ''
          ).localeCompare(
            firstClass.createdAt ?? '',
          ),
        );
    }, [
      classrooms,
      searchValue,
      academicYearFilter,
      classroomStatusFilter,
    ]);

  const totalStudents =
    classrooms.reduce(
      (total, classroom) =>
        total +
        classroom.studentCount,
      0,
    );

  const hasFilters =
    searchValue.trim().length > 0 ||
    academicYearFilter !== 'all' ||
    classroomStatusFilter !==
        'active';

  const clearFilters = () => {
    setSearchValue('');
    setAcademicYearFilter('all');
    setClassroomStatusFilter(
        'active',
    );
  };

  return (
    <div className="space-y-6">
      {/* Tiêu đề */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">
            Danh sách lớp học
          </h1>

          <p className="mt-2 text-sm text-secondary">
            Các lớp thuộc tài khoản giáo viên của bạn.
          </p>
        </div>

        <Link
          to="/teacher/classes/new"
          className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-full bg-amber px-5 text-sm font-extrabold text-ink transition hover:bg-amber/90 sm:self-auto"
        >
          <Plus className="size-4" />
          Tạo lớp mới
        </Link>
      </div>

      {/* Thống kê */}
      {!loading && !error && <section className="grid gap-5 sm:grid-cols-2">
        <TeacherStatCard
          label="Tổng số lớp"
          value={classrooms.length}
          description="Lớp thuộc tài khoản của bạn"
          icon={BookOpenText}
          tone="green"
        />

        <TeacherStatCard
          label="Học sinh đang tham gia"
          value={totalStudents}
          description="Theo dữ liệu lớp học"
          icon={UsersRound}
          tone="slate"
        />

      </section>}

      {loading && <p role="status" className="rounded-2xl border border-line bg-white p-5 text-sm text-secondary">Đang tải danh sách lớp…</p>}
      {error && !loading && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        <p>{error}</p>
        <button type="button" onClick={() => setRevision((value) => value + 1)} className="mt-3 min-h-11 font-bold underline">Thử lại</button>
      </div>}

      {!loading && !error && <>
      {/* Tìm kiếm và bộ lọc */}
      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />

            <input
              aria-label="Tìm lớp"
              type="search"
              value={searchValue}
              onChange={(event) =>
                setSearchValue(
                  event.target.value,
                )
              }
              placeholder="Tìm theo tên hoặc mã lớp..."
              className="min-h-11 w-full rounded-xl border border-line bg-white pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-muted focus:border-emerald focus:ring-2 focus:ring-emerald/10"
            />
          </div>

          <select
            aria-label="Lọc theo năm học"
            value={academicYearFilter}
            onChange={(event) =>
              setAcademicYearFilter(
                event.target.value,
              )
            }
            className="min-h-11 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink outline-none transition focus:border-emerald focus:ring-2 focus:ring-emerald/10 md:min-w-48"
          >
            <option value="all">
              Tất cả năm học
            </option>

            {academicYearOptions.map(
              (academicYear) => (
                <option
                  key={academicYear}
                  value={academicYear}
                >
                  Năm học {academicYear}
                </option>
              ),
            )}
          </select>

          <select
            aria-label="Lọc theo trạng thái"
            value={classroomStatusFilter}
            onChange={(event) =>
                setClassroomStatusFilter(
                event.target
                    .value as ClassroomStatusFilter,
                )
            }
            className="min-h-11 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink outline-none transition focus:border-emerald focus:ring-2 focus:ring-emerald/10 md:min-w-44"
            >
            <option value="active">
                Đang hoạt động
            </option>

            <option value="archived">
                Đã lưu trữ
            </option>

            <option value="all">
                Tất cả trạng thái
            </option>
            </select>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="min-h-11 rounded-xl border border-line px-4 text-sm font-bold text-secondary transition hover:bg-slate-50 hover:text-ink"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </section>

      {/* Danh sách */}
      <section>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-ink">
              Lớp học của tôi
            </h2>

            <p className="mt-1 text-sm text-muted">
              Hiển thị{' '}
              {filteredClassrooms.length}/
              {classrooms.length} lớp
            </p>
          </div>
        </div>

        {filteredClassrooms.length >
        0 ? (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filteredClassrooms.map(
              (classroom) => (
                <TeacherClassCard
                  key={classroom.id}
                  classroom={classroom}
                />
              ),
            )}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center">
            <SearchX className="mx-auto size-10 text-muted" />

            <h3 className="mt-4 font-extrabold text-ink">
              {classrooms.length === 0
                ? 'Chưa có lớp học'
                : 'Không tìm thấy lớp phù hợp'}
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
              {classrooms.length === 0
                ? 'Hãy tạo lớp đầu tiên để bắt đầu quản lý học sinh và bài học.'
                : 'Thử thay đổi từ khóa hoặc năm học đang chọn.'}
            </p>

            {classrooms.length === 0 ? (
              <Link
                to="/teacher/classes/new"
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-emerald px-5 text-sm font-bold text-white"
              >
                <Plus className="size-4" />
                Tạo lớp đầu tiên
              </Link>
            ) : (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 rounded-full bg-ink px-5 py-3 text-sm font-bold text-white"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        )}
      </section>
      </>}
    </div>
  );
}
