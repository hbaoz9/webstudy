import { useSearchParams } from "react-router-dom";
import { geo10Chapters } from "../../data/geo10Curriculum";
import UploadedInfographicGallery from "../../components/infographic/UploadedInfographicGallery";

export default function TeacherInfographicsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const chapterFromUrl = searchParams.get("chapter");
  const chapterIndex = Math.max(
    0,
    geo10Chapters.findIndex((item) => item.id === chapterFromUrl),
  );
  const chapter = geo10Chapters[chapterIndex];

  if (!chapter) {
    return <p>Chưa có chương nào trong chương trình.</p>;
  }

  function chooseChapter(id: string) {
    setSearchParams({ chapter: id });
  }

  return (
    <div className="min-w-0 space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-ink">Học liệu trực quan</h1>
        <p className="mt-2 text-sm text-secondary">
          Quản lý infographic theo chương. Chèn học liệu từ thư viện vào nội dung bài học để học sinh xem.
        </p>
      </header>
      <section aria-label="Chọn chương quản lý infographic" className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-0 basis-full text-sm font-bold text-ink sm:min-w-[240px] sm:flex-1 sm:basis-auto">
            Chọn chương
            <select
              value={chapter.id}
              onChange={(event) => chooseChapter(event.target.value)}
              className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-3"
            >
              {geo10Chapters.map((item) => (
                <option key={item.id} value={item.id}>
                  Chương {item.number}. {item.title}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            aria-label="Chương trước"
            disabled={chapterIndex === 0}
            onClick={() => chooseChapter(geo10Chapters[chapterIndex - 1].id)}
            className="min-h-11 rounded-xl border border-line px-4 disabled:opacity-40"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Chương sau"
            disabled={chapterIndex === geo10Chapters.length - 1}
            onClick={() => chooseChapter(geo10Chapters[chapterIndex + 1].id)}
            className="min-h-11 rounded-xl border border-line px-4 disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </section>
      <UploadedInfographicGallery
        key={`chapter-${chapter.id}`}
        targetType="chapter"
        targetId={chapter.id}
      />
    </div>
  );
}
