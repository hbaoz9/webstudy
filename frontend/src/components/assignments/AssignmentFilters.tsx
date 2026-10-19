import type { Classroom } from "../../types/teacher";
import type { CurriculumChapter, CurriculumLesson } from "../../types/curriculum";

type AssignmentFiltersProps = {
  tabs: { id: string; label: string; count: number }[];
  statusFilter: string;
  search: string;
  classFilter: string;
  lessonFilter: string;
  sort: string;
  classrooms: Pick<Classroom, "id" | "name" | "status">[];
  chapters: Pick<CurriculumChapter, "id" | "number" | "title">[];
  lessons: CurriculumLesson[];
  mobileFiltersOpen: boolean;
  onFilterChange: (key: "status" | "q" | "class" | "lesson" | "sort", value: string) => void;
  onToggleMobileFilters: () => void;
  onResetFilters: () => void;
};

export function AssignmentFilters({
  tabs,
  statusFilter,
  search,
  classFilter,
  lessonFilter,
  sort,
  classrooms,
  chapters,
  lessons,
  mobileFiltersOpen,
  onFilterChange,
  onToggleMobileFilters,
  onResetFilters,
}: AssignmentFiltersProps) {
  return (
    <div
    aria-label="Lọc bài tập"
    className="space-y-3 rounded-2xl bg-white p-4 shadow-card"
  >
    <div
      aria-label="Trạng thái bài tập"
      className="flex flex-wrap gap-2"
    >
      {tabs.map((tab) => (
        <button
          type="button"
          key={tab.id}
          aria-pressed={statusFilter === tab.id}
          onClick={() => onFilterChange("status", tab.id)}
          className={`min-h-11 rounded-xl border px-3 text-sm font-bold ${statusFilter === tab.id ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-line text-ink hover:bg-canvas"}`}
        >
          {tab.label} (
          {
            tab.count
          }
          )
        </button>
      ))}
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-sm font-semibold">
        Tìm bài tập
        <input
          aria-label="Tìm bài tập"
          value={search}
          onChange={(event) => onFilterChange("q", event.target.value)}
          placeholder="Nhập tên bài"
          className="mt-2 min-h-11 w-full rounded-xl border border-line px-3"
        />
      </label>
      <button
        type="button"
        aria-expanded={mobileFiltersOpen}
        aria-controls="assignment-advanced-filters"
        onClick={onToggleMobileFilters}
        className="min-h-11 rounded-xl border border-line px-3 text-left text-sm font-bold sm:hidden"
      >
        Bộ lọc và sắp xếp
        {classFilter || lessonFilter || sort !== "deadline"
          ? " · đang áp dụng"
          : ""}{" "}
        {mobileFiltersOpen ? "▴" : "▾"}
      </button>
      <div
        id="assignment-advanced-filters"
        className={`${mobileFiltersOpen ? "grid" : "hidden"} gap-3 sm:contents`}
      >
        <label className="min-w-0 text-sm font-semibold">
          Lớp
          <select
            aria-label="Lọc lớp"
            value={classFilter}
            onChange={(event) =>
              onFilterChange("class", event.target.value)
            }
            className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3"
          >
            <option value="">Tất cả lớp</option>
            {classrooms.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>
                {classroom.name}
                {classroom.status === "archived" ? " (lưu trữ)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 text-sm font-semibold">
          Bài học
          <select
            aria-label="Lọc bài học"
            value={lessonFilter}
            onChange={(event) =>
              onFilterChange("lesson", event.target.value)
            }
            className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3"
          >
            <option value="">Tất cả bài học</option>
            <option value="none">Chưa gắn bài học</option>
            {chapters.map((chapter) => (
              <optgroup
                key={chapter.id}
                label={`Chương ${chapter.number}. ${chapter.title}`}
              >
                {lessons
                  .filter((lesson) => lesson.chapterId === chapter.id)
                  .map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>
                      Bài {lesson.number}. {lesson.title}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="min-w-0 text-sm font-semibold">
          Sắp xếp
          <select
            aria-label="Sắp xếp bài tập"
            value={sort}
            onChange={(event) =>
              onFilterChange("sort", event.target.value)
            }
            className="mt-2 min-h-11 w-full rounded-xl border border-line bg-white px-3"
          >
            <option value="deadline">Hạn gần nhất</option>
            <option value="newest">Mới tạo nhất</option>
            <option value="title">Tên A–Z</option>
          </select>
        </label>
      </div>
    </div>
    <button
      type="button"
      onClick={onResetFilters}
      className="min-h-11 rounded-lg px-2 text-sm font-bold text-secondary hover:bg-canvas"
    >
      Bỏ lọc · xem tất cả
    </button>
  </div>
  );
}
