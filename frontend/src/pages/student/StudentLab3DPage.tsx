import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Lab3DHubView } from "../../features/lab3d/components/Lab3DHubView";
import { Lab3DViewer } from "../../features/lab3d/components/Lab3DViewer";
import { getLab3DModelById } from "../../features/lab3d/data/lab3dModels";
import type { Lab3DModelId } from "../../features/lab3d/types";

export default function StudentLab3DPage() {
  const { modelId } = useParams<{ modelId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const chapterFromQuery = searchParams.get("chapter") || "all";
  const [selectedChapterId, setSelectedChapterId] = useState(chapterFromQuery);

  const selectedModel = getLab3DModelById(modelId);
  const returnLessonId = searchParams.get("lesson");

  const handleSelectChapter = (nextChapterId: string) => {
    setSelectedChapterId(nextChapterId);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (nextChapterId === "all") next.delete("chapter");
      else next.set("chapter", nextChapterId);
      return next;
    });
  };

  const handleOpenModel = (targetId: Lab3DModelId) => {
    const next = new URLSearchParams();
    if (selectedChapterId !== "all") next.set("chapter", selectedChapterId);
    if (returnLessonId) next.set("lesson", returnLessonId);
    navigate(`/student/3d-lab/${targetId}${next.size ? `?${next}` : ""}`);
  };

  const handleBackToHub = () => {
    const query =
      selectedChapterId !== "all" ? `?chapter=${encodeURIComponent(selectedChapterId)}` : "";
    navigate(`/student/3d-lab${query}`);
  };

  if (selectedModel) {
    return (
      <div className="space-y-3">
      {returnLessonId && <Link className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-semibold text-ink" to={`/student/lessons?lesson=${encodeURIComponent(returnLessonId)}`}>← Quay lại bài học</Link>}
      <Lab3DViewer
        model={selectedModel}
        onBack={handleBackToHub}
        onSelectModel={handleOpenModel}
      />
      </div>
    );
  }

  return (
    <Lab3DHubView
      selectedChapterId={selectedChapterId}
      onSelectChapterId={handleSelectChapter}
      onOpenModel={handleOpenModel}
    />
  );
}
