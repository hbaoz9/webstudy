import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Camera,
  CheckCircle2,
  Compass,
  Eye,
  FlaskConical,
  Layers,
  MousePointerClick,
  Pause,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  XCircle,
} from "lucide-react";
import { LAB3D_MODELS } from "../data/lab3dModels";
import type {
  Lab3DCameraPreset,
  Lab3DLearningActivity,
  Lab3DModelConfig,
  Lab3DModelId,
  TectonicBoundaryMode,
} from "../types";
import { detectWebGLSupport } from "../utils/webglSupport";
import { Fallback2DDiagram } from "./Fallback2DDiagram";

const ThreeSceneCanvas = lazy(() =>
  import("./ThreeSceneCanvas").then((mod) => ({ default: mod.ThreeSceneCanvas })),
);

export function Lab3DViewer({
  model,
  onBack,
  onSelectModel,
  embedded = false,
}: {
  model: Lab3DModelConfig;
  onBack: () => void;
  onSelectModel?: (modelId: Lab3DModelId) => void;
  embedded?: boolean;
}) {
  const [webglSupported, setWebglSupported] = useState<boolean>(() => detectWebGLSupport());
  const [force2DMode, setForce2DMode] = useState(false);
  const [activeHotspotId, setActiveHotspotId] = useState<string>(
    model.hotspots[0]?.id ?? "",
  );
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [explodeFactor, setExplodeFactor] = useState(0.35);
  const [tectonicMode, setTectonicMode] = useState<TectonicBoundaryMode>("convergent");
  const [showGridLines, setShowGridLines] = useState(true);
  const [activeCameraPreset, setActiveCameraPreset] = useState<Lab3DCameraPreset | null>(
    null,
  );
  const [resetCounter, setResetCounter] = useState(0);

  // Trạng thái Hoạt động Khám phá (Quan sát -> Dự đoán -> Thử nghiệm -> Giải thích)
  const [selectedPredictionId, setSelectedPredictionId] = useState<string | null>(null);
  const [experimentExecuted, setExperimentExecuted] = useState(false);

  // Đồng bộ hotspot & trạng thái thí nghiệm khi đổi sang mô hình khác
  useEffect(() => {
    setActiveHotspotId(model.hotspots[0]?.id ?? "");
    setIsPaused(false);
    setSpeed(1.0);
    setExplodeFactor(0.35);
    setTectonicMode("convergent");
    setActiveCameraPreset(null);
    setSelectedPredictionId(null);
    setExperimentExecuted(false);
  }, [model.id, model.hotspots]);

  const handleWebGLError = useCallback(() => {
    setWebglSupported(false);
  }, []);

  const handleResetView = () => {
    setIsPaused(false);
    setSpeed(1.0);
    setExplodeFactor(0.35);
    setTectonicMode("convergent");
    setShowGridLines(true);
    setActiveHotspotId(model.hotspots[0]?.id ?? "");
    setActiveCameraPreset(null);
    setResetCounter((c) => c + 1);
  };

  const applyLearningExperiment = (activity: Lab3DLearningActivity) => {
    const preset = activity.experimentPreset;
    if (preset.hotspotId) setActiveHotspotId(preset.hotspotId);
    if (typeof preset.speed === "number") setSpeed(preset.speed);
    if (typeof preset.explodeFactor === "number") setExplodeFactor(preset.explodeFactor);
    if (preset.tectonicMode) setTectonicMode(preset.tectonicMode);
    if (typeof preset.showGridLines === "boolean") setShowGridLines(preset.showGridLines);
    if (typeof preset.isPaused === "boolean") setIsPaused(preset.isPaused);
    if (preset.cameraPresetId) {
      const foundCam = model.cameraPresets.find((c) => c.id === preset.cameraPresetId);
      if (foundCam) setActiveCameraPreset({ ...foundCam });
    }
    setExperimentExecuted(true);
  };

  const activeHotspot =
    model.hotspots.find((h) => h.id === activeHotspotId) ?? model.hotspots[0];
  const primaryActivity = model.learningActivities[0];
  const selectedPrediction = primaryActivity?.predictions.find(
    (p) => p.id === selectedPredictionId,
  );
  const use3DCanvas = webglSupported && !force2DMode;

  return (
    <div className="space-y-6" data-testid="lab3d-viewer">
      {/* Thanh điều hướng trên cùng */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3.5 shadow-card sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-3.5 text-sm font-bold text-ink hover:bg-canvas"
          >
            <ArrowLeft className="size-4" />
            {embedded ? "Đóng mô phỏng" : "Danh mục Mô hình 3D"}
          </button>

          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald">
              {model.badge}
            </span>
            <h1 className="text-base font-extrabold text-ink sm:text-xl">{model.title}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!embedded && onSelectModel && <><label className="sr-only" htmlFor="lab3d-model-switcher">
            Chuyển nhanh mô hình 3D khác
          </label>
          <select
            id="lab3d-model-switcher"
            value={model.id}
            onChange={(e) => onSelectModel(e.target.value as Lab3DModelId)}
            className="min-h-11 rounded-xl border border-line bg-canvas px-3 text-xs font-bold text-ink sm:text-sm"
          >
            {LAB3D_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select></>}

          {webglSupported && (
            <button
              type="button"
              onClick={() => setForce2DMode((v) => !v)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 text-xs font-bold text-ink hover:bg-canvas"
            >
              <Layers className="size-4 text-emerald" />
              {force2DMode ? "Chuyển sang 3D" : "Sơ đồ mặt cắt 2D"}
            </button>
          )}

          <button
            type="button"
            onClick={handleResetView}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 text-xs font-bold text-ink hover:bg-canvas"
          >
            <RotateCcw className="size-4 text-secondary" />
            Đặt lại
          </button>
        </div>
      </div>

      {/* Thông báo tự động chuyển sang 2D nếu trình duyệt không hỗ trợ WebGL */}
      {!webglSupported && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-extrabold">
              Thiết bị hoặc trình duyệt hiện không bật tăng tốc đồ họa 3D (WebGL)
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-900">
              Hệ thống đã tự động chuyển sang <strong>Chế độ Sơ đồ 2D tương tác</strong> để bạn vẫn
              quan sát đầy đủ các lớp cấu trúc, thực hiện hoạt động khám phá và đọc trọn vẹn kiến thức Địa lí 10.
            </p>
          </div>
        </div>
      )}

      {/* Lưới chính: Khung nhìn 3D/2D + Bảng điều khiển, Thí nghiệm Khám phá và Kiến thức */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* Cột trái: Viewport + Góc nhìn học tập + Bộ điều khiển trực tiếp */}
        <div className="space-y-4">
          <div className="relative rounded-3xl border border-line bg-[#060c18] p-2 shadow-card sm:p-3">
            {/* Thanh chọn nhanh Góc nhìn học tập (Camera Presets) */}
            {model.cameraPresets.length > 0 && (
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-emerald-300">
                  <Camera className="size-3.5" />
                  Góc nhìn học tập:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {model.cameraPresets.map((preset) => {
                    const isCamActive = activeCameraPreset?.id === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setActiveCameraPreset({ ...preset })}
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${
                          isCamActive
                            ? "border-emerald-400 bg-emerald text-white"
                            : "border-white/15 bg-white/10 text-slate-200 hover:bg-white/20"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {use3DCanvas ? (
              <Suspense
                fallback={
                  <div
                    role="status"
                    className="flex h-[360px] w-full items-center justify-center rounded-2xl bg-[#060c18] text-sm font-bold text-slate-300 sm:h-[460px]"
                  >
                    Đang khởi tạo không gian mô phỏng 3D...
                  </div>
                }
              >
                <ThreeSceneCanvas
                  modelId={model.id}
                  activeHotspotId={activeHotspotId}
                  onSelectHotspot={setActiveHotspotId}
                  isPaused={isPaused}
                  speed={speed}
                  explodeFactor={explodeFactor}
                  tectonicMode={tectonicMode}
                  showGridLines={showGridLines}
                  cameraPreset={activeCameraPreset}
                  resetCounter={resetCounter}
                  onWebGLError={handleWebGLError}
                />
              </Suspense>
            ) : (
              <Fallback2DDiagram
                model={model}
                activeHotspotId={activeHotspotId}
                onSelectHotspot={setActiveHotspotId}
                tectonicMode={tectonicMode}
                explodeFactor={explodeFactor}
              />
            )}

            {/* Thanh chú thích thao tác nhanh dưới đáy khung nhìn */}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-2 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <MousePointerClick className="size-3.5 text-emerald-400" />
                {use3DCanvas
                  ? "Bấm trực tiếp vào bộ phận trên mô hình 3D để chọn • Kéo xoay 360° • Cuộn thu phóng"
                  : "Bấm vào các điểm đánh số trên sơ đồ hoặc nút bên dưới để xem chi tiết"}
              </span>
              <span className="font-semibold text-amber">
                {model.lessonTitle}
              </span>
            </div>
          </div>

          {/* Bảng Điều khiển Mô phỏng (Controls) */}
          <section
            aria-label="Bộ điều khiển mô hình"
            className="space-y-4 rounded-2xl border border-line bg-white p-5 shadow-card"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-extrabold text-ink">
                <Sliders className="size-4 text-emerald" />
                Điều khiển tham số mô phỏng
              </h2>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaused((p) => !p)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald px-4 text-xs font-extrabold text-white hover:bg-emerald-600"
                >
                  {isPaused ? (
                    <>
                      <Play className="size-4" />
                      Tiếp tục chuyển động
                    </>
                  ) : (
                    <>
                      <Pause className="size-4" />
                      Tạm dừng
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Thanh trượt tốc độ mô phỏng */}
              <label className="block space-y-1.5 text-xs font-bold text-ink">
                <span>Tốc độ chuyển động: {speed.toFixed(1)}x</span>
                <input
                  type="range"
                  min={0.2}
                  max={2.5}
                  step={0.1}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-full accent-emerald"
                />
              </label>

              {/* Điều khiển riêng cho từng mô hình */}
              {model.id === "earth-rotation" && (
                <div className="flex items-center">
                  <label className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-xs font-bold text-ink">
                    <input
                      type="checkbox"
                      checked={showGridLines}
                      onChange={(e) => setShowGridLines(e.target.checked)}
                      className="size-4 rounded accent-emerald"
                    />
                    Hiển thị vòng Xích đạo (0°) &amp; Chí tuyến
                  </label>
                </div>
              )}

              {model.id === "earth-layers" && (
                <label className="block space-y-1.5 text-xs font-bold text-ink">
                  <span>Độ tách lớp đồng tâm: {Math.round(explodeFactor * 100)}%</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={explodeFactor}
                    onChange={(e) => setExplodeFactor(Number(e.target.value))}
                    className="w-full accent-amber"
                  />
                </label>
              )}

              {model.id === "plate-tectonics" && (
                <div className="sm:col-span-2">
                  <p className="mb-2 text-xs font-bold text-ink">
                    Chọn kiểu tiếp xúc ranh giới mảng kiến tạo:
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {(
                      [
                        ["convergent", "1. Hội tụ (Hút chìm & Núi lửa)"],
                        ["divergent", "2. Phân kì (Tách giãn đáy biển)"],
                        ["transform", "3. Trượt ngang (Đứt gãy)"],
                      ] as const
                    ).map(([modeKey, label]) => (
                      <button
                        key={modeKey}
                        type="button"
                        onClick={() => setTectonicMode(modeKey)}
                        aria-pressed={tectonicMode === modeKey}
                        className={`min-h-11 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                          tectonicMode === modeKey
                            ? "border-emerald bg-emerald text-white"
                            : "border-line bg-canvas text-ink hover:bg-slate-100"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Danh sách các nút chọn thành phần / lớp (Hotspots) */}
            <div className="border-t border-line pt-4">
              <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-secondary">
                Chọn bộ phận trên mô hình 3D hoặc bấm nút bên dưới ({model.hotspots.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {model.hotspots.map((spot, idx) => {
                  const isSelected = spot.id === activeHotspotId;
                  return (
                    <button
                      key={spot.id}
                      type="button"
                      onClick={() => setActiveHotspotId(spot.id)}
                      aria-pressed={isSelected}
                      className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 py-2 text-left text-xs font-bold transition ${
                        isSelected
                          ? "border-ink bg-ink text-white shadow-sm"
                          : "border-line bg-canvas text-ink hover:bg-slate-100"
                      }`}
                    >
                      <span
                        className="inline-block size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: spot.colorHex }}
                      />
                      <span>
                        {idx + 1}. {spot.label.split("(")[0].replace(/^\d+\.\s*/, "").trim()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* HOẠT ĐỘNG KHÁM PHÁ TƯƠNG TÁC: QUAN SÁT -> DỰ ĐOÁN -> THAY ĐỔI THAM SỐ -> XEM KẾT QUẢ -> GIẢI THÍCH */}
          {primaryActivity && (
            <section
              aria-label="Hoạt động khám phá tương tác"
              data-testid="lab3d-learning-activity"
              className="space-y-4 rounded-3xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-emerald-50/50 p-5 shadow-card sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white">
                  <FlaskConical className="size-3.5" />
                  Hoạt động Khám phá Khoa học
                </span>
                <span className="text-xs font-bold text-indigo-900">
                  Quan sát → Dự đoán → Thay đổi tham số → Kết quả &amp; Giải thích
                </span>
              </div>

              <h3 className="text-base font-extrabold text-ink sm:text-lg">
                {primaryActivity.title}
              </h3>

              {/* Bước 1: Quan sát */}
              <div className="rounded-2xl border border-indigo-100 bg-white p-3.5 text-xs leading-relaxed text-secondary sm:text-sm">
                <strong className="text-indigo-950">1. Quan sát:</strong>{" "}
                {primaryActivity.observePrompt}
              </div>

              {/* Bước 2: Dự đoán */}
              <div className="space-y-2.5">
                <p className="text-xs font-extrabold text-ink sm:text-sm">
                  2. Dự đoán của bạn: {primaryActivity.predictQuestion}
                </p>
                <div className="space-y-2">
                  {primaryActivity.predictions.map((pred) => {
                    const isPicked = selectedPredictionId === pred.id;
                    return (
                      <button
                        key={pred.id}
                        type="button"
                        onClick={() => setSelectedPredictionId(pred.id)}
                        aria-pressed={isPicked}
                        className={`flex w-full items-start gap-2.5 rounded-2xl border p-3 text-left text-xs font-semibold transition sm:text-sm ${
                          isPicked
                            ? pred.isCorrect
                              ? "border-2 border-emerald-600 bg-emerald-50 text-emerald-950"
                              : "border-2 border-amber-500 bg-amber-50 text-amber-950"
                            : "border-line bg-white text-ink hover:border-indigo-400"
                        }`}
                      >
                        <Compass className="mt-0.5 size-4 shrink-0 text-indigo-600" />
                        <span>{pred.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Phản hồi dự đoán */}
              {selectedPrediction && (
                <div
                  role="status"
                  className={`flex items-start gap-2.5 rounded-2xl border p-3.5 text-xs leading-relaxed sm:text-sm ${
                    selectedPrediction.isCorrect
                      ? "border-emerald-300 bg-emerald-50/90 text-emerald-950"
                      : "border-amber-300 bg-amber-50/90 text-amber-950"
                  }`}
                >
                  {selectedPrediction.isCorrect ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  )}
                  <span>{selectedPrediction.feedback}</span>
                </div>
              )}

              {/* Bước 3: Thay đổi tham số trên mô hình 3D để kiểm chứng */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <span className="text-xs font-bold text-secondary">
                  3. Thử nghiệm trực tiếp trên mô hình:
                </span>
                <button
                  type="button"
                  onClick={() => applyLearningExperiment(primaryActivity)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-indigo-600 px-5 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-indigo-700 sm:text-sm"
                >
                  <Sparkles className="size-4" />
                  {primaryActivity.experimentActionLabel}
                </button>
              </div>

              {/* Bước 4 & 5: Xem kết quả & Giải thích khoa học */}
              {(experimentExecuted || selectedPredictionId !== null) && (
                <div className="space-y-2 rounded-2xl border border-emerald-300 bg-white p-4 text-xs leading-relaxed sm:text-sm">
                  <p className="text-ink">
                    <strong className="text-emerald-800">4. Kết quả quan sát trên mô hình:</strong>{" "}
                    {primaryActivity.resultSummary}
                  </p>
                  <p className="text-secondary">
                    <strong className="text-ink">5. Giải thích nguyên nhân – hệ quả:</strong>{" "}
                    {primaryActivity.scientificExplanation}
                  </p>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Cột phải: Thẻ chi tiết thành phần đang chọn & Kiến thức trọng tâm */}
        <div className="space-y-5">
          {/* Chi tiết Hotspot đang chọn */}
          {activeHotspot && (
            <article
              aria-live="polite"
              className="rounded-3xl border-2 border-emerald/40 bg-white p-6 shadow-card"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald/15 px-3 py-1 text-xs font-extrabold text-emerald-800">
                  <Eye className="size-3.5 text-emerald" />
                  Đang chọn trên mô hình
                </span>
                <span className="rounded-lg bg-canvas px-2.5 py-1 text-xs font-bold text-secondary">
                  {activeHotspot.shortTag}
                </span>
              </div>

              <h2 className="mt-3 text-xl font-extrabold text-ink">
                {activeHotspot.label}
              </h2>

              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-line bg-canvas p-3">
                  <p className="text-[11px] font-bold uppercase text-secondary">
                    Vị trí / Độ sâu / Độ cao
                  </p>
                  <p className="mt-1 text-xs font-extrabold text-ink sm:text-sm">
                    {activeHotspot.depthOrAltitudeLabel}
                  </p>
                </div>
                <div className="rounded-xl border border-line bg-canvas p-3">
                  <p className="text-[11px] font-bold uppercase text-secondary">
                    Đặc trưng / Thông số
                  </p>
                  <p className="mt-1 text-xs font-extrabold text-ink sm:text-sm">
                    {activeHotspot.temperatureOrStatLabel}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-sm font-semibold leading-relaxed text-ink">
                {activeHotspot.summary}
              </p>

              <ul className="mt-3 space-y-2 border-t border-line pt-3 text-sm text-secondary">
                {activeHotspot.details.map((detail, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald" />
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </article>
          )}

          {/* Tổng hợp Kiến thức trọng tâm SGK Địa lí 10 */}
          <section className="rounded-3xl border border-line bg-white p-6 shadow-card">
            <h3 className="flex items-center gap-2 text-base font-extrabold text-ink">
              <BookOpen className="size-5 text-emerald" />
              Kiến thức trọng tâm Địa lí 10
            </h3>
            <p className="mt-1 text-xs font-semibold text-emerald">
              {model.lessonTitle}
            </p>
            <ul className="mt-4 list-disc space-y-2.5 pl-5 text-sm leading-relaxed text-secondary">
              {model.keyTakeaways.map((point, idx) => (
                <li key={idx}>{point}</li>
              ))}
            </ul>

            {/* Ghi chú minh bạch về giới hạn mô phỏng khoa học không theo tỉ lệ thực tế */}
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs leading-relaxed text-amber-950">
              {model.scientificSimulationNote}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
