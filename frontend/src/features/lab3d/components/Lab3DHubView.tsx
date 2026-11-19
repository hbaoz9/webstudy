import { Link } from "react-router-dom";
import {
  Box,
  Compass,
  Eye,
  FlaskConical,
  Gamepad2,
  Globe2,
  Layers,
  MousePointerClick,
  Sparkles,
} from "lucide-react";
import ContourBackground from "../../../components/common/ContourBackground";
import { geo10Chapters } from "../../../data/geo10Curriculum";
import { LAB3D_MODELS } from "../data/lab3dModels";
import type { Lab3DModelId } from "../types";

function ModelPreviewArtwork({ modelId }: { modelId: Lab3DModelId }) {
  if (modelId === "earth-rotation") {
    return (
      <svg viewBox="0 0 320 110" className="h-28 w-full rounded-2xl bg-[#071122]" aria-hidden="true">
        <circle cx="272" cy="55" r="24" fill="#fde047" />
        <line x1="205" y1="35" x2="242" y2="35" stroke="#fef08a" strokeWidth="2" strokeDasharray="4 3" />
        <line x1="205" y1="55" x2="242" y2="55" stroke="#fef08a" strokeWidth="2" strokeDasharray="4 3" />
        <line x1="205" y1="75" x2="242" y2="75" stroke="#fef08a" strokeWidth="2" strokeDasharray="4 3" />
        <g transform="translate(120, 55) rotate(-23.4)">
          <line x1="0" y1="-46" x2="0" y2="46" stroke="#f59e0b" strokeWidth="3" />
          <circle cx="0" cy="0" r="34" fill="#0284c7" />
          <path d="M-12,-18 Q8,-14 14,4 Q4,20 -10,14 Z" fill="#10b981" />
          <circle cx="10" cy="-6" r="4" fill="#ef4444" stroke="#fef08a" strokeWidth="1.5" />
          <ellipse cx="0" cy="0" rx="35" ry="9" fill="none" stroke="#34d399" strokeWidth="1.8" />
        </g>
        <line x1="120" y1="16" x2="120" y2="94" stroke="#38bdf8" strokeWidth="2" strokeDasharray="3 3" />
      </svg>
    );
  }

  if (modelId === "earth-layers") {
    return (
      <svg viewBox="0 0 320 110" className="h-28 w-full rounded-2xl bg-[#18100c]" aria-hidden="true">
        <circle cx="160" cy="55" r="42" fill="#0ea5e9" />
        <circle cx="160" cy="55" r="35" fill="#f97316" />
        <circle cx="160" cy="55" r="26" fill="#dc2626" />
        <circle cx="160" cy="55" r="17" fill="#facc15" />
        <circle cx="160" cy="55" r="8" fill="#fef08a" />
      </svg>
    );
  }

  if (modelId === "plate-tectonics") {
    return (
      <svg viewBox="0 0 320 110" className="h-28 w-full rounded-2xl bg-[#1c1117]" aria-hidden="true">
        <rect x="20" y="72" width="280" height="26" rx="6" fill="#c2410c" />
        <path d="M24,52 L145,52 L175,78 L24,68 Z" fill="#475569" />
        <rect x="155" y="46" width="140" height="24" rx="4" fill="#15803d" />
        <polygon points="205,46 230,14 255,46" fill="#57534e" />
        <circle cx="230" cy="14" r="6" fill="#ef4444" />
        <line x1="230" y1="74" x2="230" y2="18" stroke="#ef4444" strokeWidth="4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 320 110" className="h-28 w-full rounded-2xl bg-[#081526]" aria-hidden="true">
      <rect x="40" y="78" width="240" height="16" rx="4" fill="#38bdf8" fillOpacity="0.65" />
      <rect x="40" y="60" width="240" height="15" rx="4" fill="#10b981" fillOpacity="0.6" />
      <rect x="40" y="42" width="240" height="15" rx="4" fill="#3b82f6" fillOpacity="0.55" />
      <rect x="40" y="24" width="240" height="15" rx="4" fill="#a855f7" fillOpacity="0.5" />
      <rect x="40" y="8" width="240" height="13" rx="4" fill="#f59e0b" fillOpacity="0.45" />
    </svg>
  );
}

export function Lab3DHubView({
  selectedChapterId,
  onSelectChapterId,
  onOpenModel,
}: {
  selectedChapterId: string;
  onSelectChapterId: (chapterId: string) => void;
  onOpenModel: (modelId: Lab3DModelId) => void;
}) {
  const visibleModels =
    selectedChapterId === "all"
      ? LAB3D_MODELS
      : LAB3D_MODELS.filter((m) => m.chapterId === selectedChapterId);

  const relevantChapters = geo10Chapters.filter((c) =>
    LAB3D_MODELS.some((m) => m.chapterId === c.id),
  );

  return (
    <div className="space-y-8" data-testid="lab3d-hub-view">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-[#0f1e36] px-6 py-4 text-white shadow-card sm:px-8 sm:py-5">
        <ContourBackground className="absolute inset-0 h-full w-full opacity-15" />
        <div className="relative z-10 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald px-4 py-1.5 text-xs font-extrabold uppercase text-white">
              <Sparkles className="size-3.5" />
              PHÒNG THÍ NGHIỆM TƯƠNG TÁC 3D • ĐỊA LÍ TỰ NHIÊN 10
            </div>
            <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">
              Phòng Thí Nghiệm Mô Hình 3D Địa Lý
            </h1>
            <p className="text-sm leading-relaxed text-slate-200 sm:text-base">
              Quan sát Trái Đất, kiến tạo mảng và khí quyển qua bốn mô hình có thể tương tác.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/student/games"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 text-xs font-bold text-white transition hover:bg-white/20 sm:text-sm"
              >
                <Gamepad2 className="size-4 text-amber" />
                Khám phá trò chơi Địa lí ➔
              </Link>
            </div>
          </div>

          <div
            aria-hidden="true"
            className="hidden size-36 shrink-0 items-center justify-center rounded-full bg-white/10 lg:flex xl:size-44"
          >
            <Globe2 className="size-20 text-emerald" />
          </div>
        </div>
      </section>

      {/* Bộ lọc theo chương bài học */}
      <section className="space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-extrabold text-ink sm:text-2xl">
              Danh mục mô hình 3D tương tác ({visibleModels.length})
            </h2>
            <p className="mt-1 text-xs text-secondary sm:text-sm">
              Bấm chọn trực tiếp bộ phận trong không gian 3D, chuyển đổi góc nhìn học tập và thực hiện bài tập dự đoán khoa học.
            </p>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <label className="sr-only" htmlFor="lab3d-chapter-filter">
              Chọn chương Địa lí 10
            </label>
            <select
              id="lab3d-chapter-filter"
              value={selectedChapterId}
              onChange={(e) => onSelectChapterId(e.target.value)}
              className="min-h-11 w-full min-w-0 max-w-full rounded-xl border border-line bg-white px-4 text-xs font-bold text-ink shadow-sm sm:w-auto sm:text-sm"
            >
              <option value="all">Tất cả mô hình Địa lí 10 (4 mô hình)</option>
              {relevantChapters.map((c) => (
                <option key={c.id} value={c.id}>
                  Chương {c.number}: {c.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Lưới 4 mô hình 3D */}
        <div className="grid gap-6 md:grid-cols-2">
          {visibleModels.map((model) => (
            <article
              key={model.id}
              className="flex min-w-0 flex-col justify-between gap-5 rounded-[24px] border border-line bg-white p-6 shadow-card transition hover:border-slate-300 sm:p-7"
            >
              <div className="space-y-4">
                <ModelPreviewArtwork modelId={model.id} />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <div
                      className="flex size-11 items-center justify-center rounded-xl text-white"
                      style={{ backgroundColor: model.accentColor }}
                    >
                      {model.id === "earth-rotation" ? (
                        <Globe2 className="size-5" />
                      ) : model.id === "earth-layers" ? (
                        <Layers className="size-5" />
                      ) : model.id === "plate-tectonics" ? (
                        <Compass className="size-5" />
                      ) : (
                        <Box className="size-5" />
                      )}
                    </div>
                    <span
                      className="rounded-xl bg-canvas px-3 py-1 text-[11px] font-extrabold uppercase"
                      style={{ color: model.accentColor }}
                    >
                      {model.badge}
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald/10 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                    <MousePointerClick className="size-3.5" />
                    Chọn 3D trực tiếp
                  </span>
                </div>

                <div>
                  <h3 className="text-xl font-extrabold text-ink">{model.title}</h3>
                  <p className="mt-1 text-xs font-bold text-emerald">{model.lessonTitle}</p>
                  <p className="mt-2 text-sm leading-relaxed text-secondary">
                    {model.description}
                  </p>
                </div>

                {model.learningActivities[0] && (
                  <div className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-xs font-bold text-indigo-950">
                    <FlaskConical className="size-4 shrink-0 text-indigo-600" />
                    <span className="truncate">{model.learningActivities[0].title}</span>
                  </div>
                )}

                {/* Danh sách các nhãn hotspot có trong mô hình */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {model.hotspots.map((spot) => (
                    <span
                      key={spot.id}
                      className="rounded-lg border border-line bg-canvas px-2.5 py-1 text-[11px] font-semibold text-ink"
                    >
                      • {spot.label.split("(")[0].replace(/^\d+\.\s*/, "").trim()}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <span className="text-xs font-semibold text-secondary">
                  {model.hotspots.length} điểm tương tác • {model.cameraPresets.length} góc nhìn
                </span>

                <button
                  type="button"
                  onClick={() => onOpenModel(model.id)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-6 py-2.5 text-sm font-bold text-white transition hover:bg-emerald"
                >
                  <Eye className="size-4" />
                  Mở mô hình 3D
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
