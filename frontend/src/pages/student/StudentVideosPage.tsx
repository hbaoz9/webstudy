import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";

import InteractiveVideoPlayer from "../../components/media/InteractiveVideoPlayer";
import { useTeacherData } from "../../contexts/TeacherDataContext";
import { loadTeacherVideos, videoClassIds, TEACHER_VIDEOS_KEY, TEACHER_VIDEOS_CHANGED } from "../../utils/teacherVideoStorage";
import { geo10Lessons } from "../../data/geo10Curriculum";
import { useStudentAccount } from "../../contexts/StudentAccountContext";
import { useStudentClassMemberships } from "../../hooks/useStudentClassMemberships";
import { getActiveStudentClassIds } from "../../utils/studentMembership";
import { useLocalStorageRevision } from "../../hooks/useLocalStorageRevision";
import StudentPageHeader from "../../components/student/StudentPageHeader";

const videoStorageKeys = [TEACHER_VIDEOS_KEY];
const videoEvents = [TEACHER_VIDEOS_CHANGED];

export default function StudentVideosPage() {
  const [searchParams] = useSearchParams();
  const requestedLessonId = searchParams.get("lesson");
  const requestedClassId = searchParams.get("class");
  const selectedLesson = geo10Lessons.find(
    (lesson) => lesson.id === requestedLessonId,
  );

  const { classrooms } = useTeacherData();
  const { memberships } = useStudentClassMemberships();

  const { student, hasStudentProfile } = useStudentAccount();
  const videosRevision = useLocalStorageRevision(videoStorageKeys, videoEvents);
  const videos = useMemo(loadTeacherVideos, [videosRevision]);

  const joinedClassIds = getActiveStudentClassIds(memberships);

  const visibleVideos = videos.filter(
    (video) =>
      video.status === "published" &&
      videoClassIds(video).some((id) => joinedClassIds.has(id) && (requestedClassId === null || id === requestedClassId)) &&
      (requestedLessonId === null || video.lessonId === requestedLessonId),
  );

  return (
    <div className="min-w-0 py-2">
      <div className="mx-auto max-w-3xl space-y-6">
        <StudentPageHeader title={selectedLesson
          ? `Video của Bài ${selectedLesson.number}` : "Video bài học"}
          description="Video tương tác của các lớp bạn đã tham gia." />

        <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
          {hasStudentProfile ? (
            <p className="text-sm text-secondary">
              Học sinh đang xem:{" "}
              <strong className="text-ink">{student.name}</strong>
            </p>
          ) : (
            <Link
              to="/student/join-class"
              className="text-sm font-bold text-emerald-700"
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
                    <p className="mt-1 text-sm font-semibold text-emerald-700">
                      Bài {lesson.number}. {lesson.title}
                    </p>
                  )}

                  <p className="mt-1 text-sm text-secondary">
                    {classroom?.name ?? "Lớp học"}
                    {" · "}
                    {video.checkpoints.length} câu hỏi trong video
                  </p>

                  <div className="student-video-player mt-4">
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
          className="inline-block text-sm font-bold text-emerald-700"
        >
          ← Quay lại bài học
        </Link>
      </div>
    </div>
  );
}
