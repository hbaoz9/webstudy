import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import InteractiveVideoPlayer from "../../components/media/InteractiveVideoPlayer";
import { useTeacherData } from "../../contexts/TeacherDataContext";
import { loadTeacherVideos, videoClassIds, TEACHER_VIDEOS_KEY, TEACHER_VIDEOS_CHANGED } from "../../utils/teacherVideoStorage";
import { geo10Lessons } from "../../data/geo10Curriculum";
import { useStudentAccount } from "../../contexts/StudentAccountContext";

export default function StudentVideosPage() {
  const [searchParams] = useSearchParams();
  const requestedLessonId = searchParams.get("lesson");
  const requestedClassId = searchParams.get("class");
  const selectedLesson = geo10Lessons.find(
    (lesson) => lesson.id === requestedLessonId,
  );

  const { classrooms, isStudentJoinedClass } = useTeacherData();

  const { student, hasStudentProfile } = useStudentAccount();
  const [videos, setVideos] = useState(loadTeacherVideos);
  useEffect(() => {
    const refresh = () => setVideos(loadTeacherVideos());
    const storage = (event: StorageEvent) => { if (event.key === TEACHER_VIDEOS_KEY || event.key === null) refresh(); };
    window.addEventListener("storage", storage);
    window.addEventListener("focus", refresh);
    window.addEventListener(TEACHER_VIDEOS_CHANGED, refresh);
    return () => { window.removeEventListener("storage", storage); window.removeEventListener("focus", refresh); window.removeEventListener(TEACHER_VIDEOS_CHANGED, refresh); };
  }, []);

  const joinedClassIds = new Set(
    classrooms
      .filter(
        (classroom) =>
          classroom.status !== "archived" &&
          hasStudentProfile &&
          isStudentJoinedClass(classroom.id, student!.id),
      )
      .map((classroom) => classroom.id),
  );

  const visibleVideos = videos.filter(
    (video) =>
      video.status === "published" &&
      videoClassIds(video).some((id) => joinedClassIds.has(id) && (requestedClassId === null || id === requestedClassId)) &&
      (requestedLessonId === null || video.lessonId === requestedLessonId),
  );

  return (
    <div className="min-w-0 py-2">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="text-2xl font-extrabold text-ink">
            {selectedLesson
              ? `Video của Bài ${selectedLesson.number}`
              : "Video bài học"}
          </h1>
          <p className="mt-2 text-sm text-secondary">
            Video tương tác của các lớp bạn đã tham gia.
          </p>
        </header>

        <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
          {hasStudentProfile ? (
            <p className="text-sm text-secondary">
              Học sinh đang xem:{" "}
              <strong className="text-ink">{student.name}</strong>
            </p>
          ) : (
            <Link
              to="/student/join-class"
              className="text-sm font-bold text-emerald"
            >
              Tạo hồ sơ và tham gia lớp
            </Link>
          )}
        </section>

        {!hasStudentProfile || visibleVideos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-secondary">
            Chưa có video nào dành cho học sinh này.
          </p>
        ) : (
          <section className="space-y-4">
            {visibleVideos.map((video) => {
              const classroom = classrooms.find(
                (item) => videoClassIds(video).includes(item.id) && joinedClassIds.has(item.id) && (requestedClassId === null || item.id === requestedClassId),
              );

              const lesson = geo10Lessons.find(
                (item) => item.id === video.lessonId,
              );

              return (
                <article
                  key={video.id}
                  className="min-w-0 rounded-2xl border border-line bg-white p-5 shadow-card [overflow-wrap:anywhere]"
                >
                  <h2 className="font-extrabold text-ink">{video.title}</h2>

                  {lesson && (
                    <p className="mt-1 text-sm font-semibold text-emerald">
                      Bài {lesson.number}. {lesson.title}
                    </p>
                  )}

                  <p className="mt-1 text-sm text-secondary">
                    {classroom?.name ?? "Lớp học"}
                    {" · "}
                    {video.checkpoints.length} câu hỏi trong video
                  </p>

                  <div className="mt-4">
                    <InteractiveVideoPlayer videoId={video.youtubeId} checkpoints={video.checkpoints} title={video.title} />
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <Link
          to={
            requestedLessonId
              ? `/student/lessons?lesson=${requestedLessonId}`
              : "/student/lessons"
          }
          className="inline-block text-sm font-bold text-emerald"
        >
          ← Quay lại bài học
        </Link>
      </div>
    </div>
  );
}
