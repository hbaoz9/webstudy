import type { LessonContent } from "../../types/curriculum";
import DragImageBoard from "./DragImageBoard";
import InteractiveVideoPlayer, {
  getYouTubeVideoId,
} from "../media/InteractiveVideoPlayer";
import { LessonBody } from "../common/LessonBody";
import { dragImageActivityError } from "../../utils/lessonContentStorage";

export default function StudentLessonSections({
  content,
  lessonId,
  studentId = "demo",
  preview = false,
}: {
  content: LessonContent;
  lessonId: string;
  studentId?: string;
  preview?: boolean;
}) {
  const sections = content.sections ?? [];

  const visibleSections = sections.filter((section) => {
    const hasText =
      Boolean(section.content?.trim()) &&
      section.content.trim() !== content.explanation.trim();

    const hasKeyPoints = section.keyPoints.some((point) => point.trim());

    const hasImage =
      section.imageMode !== "drag_drop" && Boolean(section.imageUrl?.trim());

    const hasVideo = Boolean(section.videoUrl?.trim());

    const hasValidActivity =
      section.imageMode === "drag_drop" &&
      Boolean(section.dragImageActivity) &&
      dragImageActivityError(section.dragImageActivity) === null;

    return Boolean(
      hasText || hasKeyPoints || hasImage || hasVideo || hasValidActivity,
    );
  });

  if (visibleSections.length === 0) return null;

  return (
    <section className="space-y-6 border-t border-line pt-6">
      <h3 className="text-lg font-extrabold text-ink">Các mục trong bài</h3>
      {visibleSections.map((section, index) => {
        const activity = section.dragImageActivity;
        const videoId = section.videoUrl
          ? getYouTubeVideoId(section.videoUrl)
          : null;
        const hasBoard =
          section.imageMode === "drag_drop" &&
          Boolean(activity) &&
          dragImageActivityError(activity) === null;
        const boardKey = `webstudy-v1-geo10-image-placement-${studentId}-${lessonId}-${section.id}`;

        return (
          <article
            key={section.id}
            className="space-y-4 rounded-xl border border-line p-4"
          >
            <h4 className="font-bold text-ink">
              Mục {index + 1}. {section.title}
            </h4>

            {section.content?.trim() &&
              section.content.trim() !== content.explanation.trim() && (
                <LessonBody
                  value={section.content}
                  format={section.contentFormat}
                  teacherPreview={preview}
                  lessonPublished={content.status === "published"}
                />
              )}

            {section.keyPoints.length > 0 && (
              <div>
                <p className="text-sm font-bold text-ink">Ý chính</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-secondary">
                  {section.keyPoints.map((point, pointIndex) => (
                    <li key={pointIndex}>{point}</li>
                  ))}
                </ul>
              </div>
            )}
            {section.imageMode !== "drag_drop" && section.imageUrl && (
              <figure>
                <img
                  src={section.imageUrl}
                  alt={section.imageCaption || section.title}
                  className="max-h-[480px] max-w-full rounded-xl border border-line object-contain"
                />
                {section.imageCaption && (
                  <figcaption className="mt-2 text-sm text-secondary">
                    {section.imageCaption}
                  </figcaption>
                )}
              </figure>
            )}
            {hasBoard && activity && (
              <div>
                <p className="mb-3 font-bold text-ink">
                  {activity.kind === "label_zones"
                    ? "Ghép nhãn trên ảnh"
                    : "Ghép hình"}
                </p>
                <DragImageBoard
                  key={boardKey}
                  activity={activity}
                  storageKey={preview ? undefined : boardKey}
                />
              </div>
            )}
            {section.videoUrl &&
              (videoId ? (
                <InteractiveVideoPlayer
                  videoId={videoId}
                  title={`Video: ${section.title}`}
                />
              ) : (
                <p role="alert" className="text-sm text-red-600">
                  Liên kết video của mục này không hợp lệ.
                </p>
              ))}
          </article>
        );
      })}
    </section>
  );
}
