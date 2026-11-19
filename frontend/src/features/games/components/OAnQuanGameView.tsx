import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  Compass,
  Hand,
  HelpCircle,
  Lightbulb,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import { geo10Chapters } from "../../../data/geo10Curriculum";
import { getChapterDeckAvailability } from "../data/geo10GameQuestions";
import type { GameQuizOptionId } from "../types";
import {
  MANDARIN_STONE_VALUE,
  answerOAnQuanQuiz,
  cellPointValue,
  completeOAnQuanQuizModal,
  createOAnQuanState,
  executeStudentOAnQuanMove,
  requestGeographyMoveAdvisor,
  simulateOAnQuanMove,
  type OAnQuanCell,
  type OAnQuanState,
  type SowDirection,
} from "../engine/oAnQuanEngine";
import { isGameSoundEnabled, playGameSound, setGameSoundEnabled } from "../gameSound";

const PEBBLE_PALETTE = [
  "from-stone-500 via-stone-700 to-stone-900 border-stone-400/60",
  "from-emerald-600 via-teal-800 to-slate-900 border-emerald-300/60",
  "from-amber-600 via-amber-800 to-stone-900 border-amber-300/60",
  "from-slate-500 via-slate-700 to-slate-950 border-slate-300/60",
];

function StoneCluster({ cell }: { cell: OAnQuanCell }) {
  const maxDots = Math.min(cell.stones, 14);
  return (
    <div
      className="flex min-h-11 flex-wrap items-center justify-center gap-1.5 px-1 py-1.5"
      aria-hidden="true"
    >
      {cell.hasMandarin && (
        <span
          title={`1 Quân Quan (${MANDARIN_STONE_VALUE} điểm)`}
          className="relative inline-flex h-7 w-12 items-center justify-center rounded-full border-2 border-amber-200 bg-gradient-to-b from-amber-300 via-amber-500 to-orange-700 text-[10px] font-black tracking-wider text-amber-950 shadow-[0_3px_0_#78350f,0_4px_8px_rgba(0,0,0,0.35)]"
        >
          <span className="absolute left-1 top-0.5 h-1.5 w-3 rounded-full bg-white/60" />
          QUAN
        </span>
      )}
      {Array.from({ length: maxDots }).map((_, idx) => {
        const tone = PEBBLE_PALETTE[(cell.index + idx) % PEBBLE_PALETTE.length];
        return (
          <span
            key={idx}
            className={`relative inline-block h-3.5 w-4 rounded-full border bg-gradient-to-br ${tone} shadow-[0_2px_0_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.5)]`}
          >
            <span className="absolute left-0.5 top-0.5 size-1 rounded-full bg-white/65" />
          </span>
        );
      })}
      {cell.stones > 14 && (
        <span className="rounded-full bg-amber-950/80 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-100">
          +{cell.stones - 14}
        </span>
      )}
    </div>
  );
}

export function OAnQuanGameView({
  initialChapterId = "all",
  onBack,
  onRecordResult,
}: {
  initialChapterId?: string;
  onBack: () => void;
  onRecordResult: (result: {
    score: number;
    maxScore: number;
    won: boolean;
    summary: string;
    chapterId?: string;
  }) => void;
}) {
  const [chapterId, setChapterId] = useState(initialChapterId);
  const [state, setState] = useState<OAnQuanState>(() =>
    createOAnQuanState(initialChapterId, Math.random, false),
  );
  const [soundOn, setSoundOn] = useState<boolean>(() => isGameSoundEnabled());
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );
  const [sowAnimStep, setSowAnimStep] = useState<number | null>(null);
  const sowTimerRef = useRef<number | null>(null);
  const [resultRecorded, setResultRecorded] = useState(false);

  const totalStudentScore = state.studentCapturedScore + state.studentGeoBonusScore;
  const currentQuestion = state.questions[state.questionCursor];
  const chapterAvailability = useMemo(
    () => getChapterDeckAvailability(chapterId, 20, "quiz"),
    [chapterId],
  );

  useEffect(() => {
    return () => {
      if (sowTimerRef.current !== null) {
        window.clearInterval(sowTimerRef.current);
      }
    };
  }, []);

  const triggerSowStepAnimation = (pathLength: number) => {
    if (sowTimerRef.current !== null) {
      window.clearInterval(sowTimerRef.current);
      sowTimerRef.current = null;
    }
    const isTestEnv =
      typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent || "");
    if (reducedMotion || isTestEnv || pathLength <= 0) {
      setSowAnimStep(null);
      return;
    }

    const cappedSteps = Math.min(pathLength, 12);
    let current = 0;
    setSowAnimStep(0);
    sowTimerRef.current = window.setInterval(() => {
      current += 1;
      if (current >= cappedSteps) {
        if (sowTimerRef.current !== null) {
          window.clearInterval(sowTimerRef.current);
          sowTimerRef.current = null;
        }
        setSowAnimStep(null);
      } else {
        setSowAnimStep(current);
      }
    }, 150);
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setGameSoundEnabled(next);
  };

  // Tính toán chỉ dẫn nước đi (Move Preview) theo ô và hướng đang chọn
  const movePreview = useMemo(() => {
    if (
      state.phase !== "student_turn" ||
      state.selectedCellIndex === null ||
      state.board[state.selectedCellIndex]?.stones <= 0
    ) {
      return null;
    }
    return simulateOAnQuanMove(
      state.board,
      state.selectedCellIndex,
      state.selectedDirection,
    );
  }, [state.board, state.phase, state.selectedCellIndex, state.selectedDirection]);

  useEffect(() => {
    if (resultRecorded) return;
    if (state.phase === "game_over") {
      setResultRecorded(true);
      onRecordResult({
        score: Math.max(0, totalStudentScore * 10),
        maxScore: 800,
        won: state.winner === "student",
        summary: `Học sinh ${totalStudentScore} điểm (gồm ${state.studentGeoBonusScore} điểm thưởng Địa lí) vs Máy ${state.aiCapturedScore} điểm.`,
        chapterId: state.chapterId !== "all" ? state.chapterId : undefined,
      });
    }
  }, [state, totalStudentScore, resultRecorded, onRecordResult]);

  const handleSelectCell = (cellIndex: number) => {
    if (state.phase !== "student_turn") return;
    if (state.board[cellIndex].stones <= 0) return;
    playGameSound("click", soundOn);
    setState((prev) => ({ ...prev, selectedCellIndex: cellIndex }));
  };

  const handleDirectionChange = (direction: SowDirection) => {
    if (state.phase !== "student_turn") return;
    playGameSound("click", soundOn);
    setState((prev) => ({ ...prev, selectedDirection: direction }));
  };

  const handleConfirmMove = () => {
    if (state.phase !== "student_turn" || state.selectedCellIndex === null) return;
    playGameSound("stone", soundOn);
    const nextState = executeStudentOAnQuanMove(
      state,
      state.selectedCellIndex,
      state.selectedDirection,
    );
    setState(nextState);
    if (nextState.lastStudentSimulation) {
      triggerSowStepAnimation(nextState.lastStudentSimulation.visitedPath.length);
    }
  };

  const handleQuizAnswer = (optionId: GameQuizOptionId) => {
    if (state.selectedOptionId !== null) return;
    const next = answerOAnQuanQuiz(state, optionId);
    playGameSound(next.lastQuizCorrect ? "correct" : "wrong", soundOn);
    setState(next);
  };

  const handleRestart = (nextChapterId = chapterId) => {
    if (sowTimerRef.current !== null) {
      window.clearInterval(sowTimerRef.current);
      sowTimerRef.current = null;
    }
    setSowAnimStep(null);
    setChapterId(nextChapterId);
    setResultRecorded(false);
    setState(createOAnQuanState(nextChapterId, Math.random, false));
  };

  const topRowIndices = [11, 10, 9, 8, 7]; // Hiển thị từ trái qua phải nối giữa Quan Trái (0) và Quan Phải (6)
  const bottomRowIndices = [1, 2, 3, 4, 5]; // Hàng Học sinh từ trái qua phải

  const activeAnimatedCellIndex =
    sowAnimStep !== null && state.lastStudentSimulation
      ? state.lastStudentSimulation.visitedPath[sowAnimStep] ?? null
      : null;

  return (
    <div
      className="overflow-hidden rounded-3xl border border-amber-300/80 bg-gradient-to-b from-[#fffbeb] via-[#fef3c7]/45 to-[#fff7ed] shadow-card"
      data-testid="o-an-quan-game-view"
    >
      {/* Header mang bản sắc văn hóa dân gian Việt Nam */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-[#451a03] px-4 py-4 text-amber-50 sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-950/70 px-3 text-sm font-bold text-amber-100 hover:bg-amber-900"
          >
            <ArrowLeft className="size-4" />
            Quay lại
          </button>
          <div className="flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-xl border border-amber-400/40 bg-gradient-to-br from-amber-500 to-orange-700 text-white shadow-sm">
              <Compass className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-amber-100 sm:text-lg">
                  Ô Ăn Quan Địa Lý 10
                </h1>
                <span className="hidden rounded-full border border-amber-400/40 bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-200 sm:inline-block">
                  Di sản Trò chơi Dân gian Việt Nam
                </span>
              </div>
              <p className="text-xs text-amber-200/80">
                Lượt đi thứ {state.turnCount + 1} • Bốc, rải quân chiến thuật &amp; trả lời câu hỏi Địa lí
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="sr-only" htmlFor="o-an-quan-chapter-select">
            Chọn chương Địa lí 10
          </label>
          <select
            id="o-an-quan-chapter-select"
            value={chapterId}
            onChange={(e) => handleRestart(e.target.value)}
            className="min-h-11 rounded-xl border border-amber-400/30 bg-amber-950/90 px-3 text-xs font-bold text-amber-100"
          >
            <option value="all">Tất cả chương Địa lí 10</option>
            {geo10Chapters.map((c) => (
              <option key={c.id} value={c.id}>
                Chương {c.number}: {c.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setReducedMotion((v) => !v)}
            aria-pressed={reducedMotion}
            className="min-h-11 rounded-xl border border-amber-400/30 bg-amber-950/70 px-3 text-xs font-bold text-amber-100 hover:bg-amber-900"
          >
            {reducedMotion ? "Rải nhanh (Giảm hiệu ứng)" : "Hiệu ứng rải từng bước"}
          </button>

          <button
            type="button"
            onClick={toggleSound}
            aria-label={soundOn ? "Tắt âm thanh" : "Bật âm thanh"}
            className="grid size-11 place-items-center rounded-xl border border-amber-400/30 bg-amber-950/70 text-amber-100 hover:bg-amber-900"
          >
            {soundOn ? (
              <Volume2 className="size-4 text-amber-300" />
            ) : (
              <VolumeX className="size-4 text-amber-500/60" />
            )}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
        {/* Thông báo phạm vi câu hỏi thuần chương (không trộn chương ngầm) */}
        {chapterId !== "all" && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-300 bg-amber-100/70 px-4 py-2.5 text-xs font-semibold text-amber-950">
            <span>
              Đang lọc thuần túy <strong>{chapterAvailability.chapterTitle}</strong>:{" "}
              <strong>{chapterAvailability.availableCount} câu hỏi</strong> Địa lí 10 của riêng chương này (tuyệt đối không trộn câu chương khác).
            </span>
          </div>
        )}

        {/* Bảng điểm 2 bên & Nhật ký lượt đi */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 shadow-sm">
            <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-900">
              Điểm của bạn (Học sinh)
            </p>
            <p className="mt-1 text-2xl font-black text-emerald-700">
              {totalStudentScore} điểm
            </p>
            <p className="mt-0.5 text-xs font-semibold text-emerald-900">
              Quân cờ: {state.studentCapturedScore} • Thưởng Địa lí: +{state.studentGeoBonusScore}
            </p>
          </div>

          <div className="flex flex-col justify-center rounded-2xl border-2 border-amber-300 bg-white p-4 text-center shadow-sm">
            <p className="text-xs font-extrabold uppercase tracking-wider text-amber-800">
              Diễn biến bàn cờ
            </p>
            <p className="mt-1 text-xs font-bold leading-relaxed text-ink">
              {state.lastMoveSummary}
            </p>
            {state.lastAiMoveSummary && (
              <p className="mt-1.5 inline-flex items-center justify-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                <Bot className="size-3.5 text-amber-700" />
                <span>{state.lastAiMoveSummary}</span>
              </p>
            )}
          </div>

          <div className="rounded-2xl border-2 border-amber-900/20 bg-gradient-to-br from-stone-50 to-amber-50/70 p-4 shadow-sm">
            <p className="text-xs font-extrabold uppercase tracking-wider text-amber-950">
              Đối thủ Máy (Trạng Quỳnh AI)
            </p>
            <p className="mt-1 text-2xl font-black text-amber-950">
              {state.aiCapturedScore} điểm
            </p>
            <p className="mt-0.5 text-xs font-semibold text-amber-900/80">
              Chiến thuật ưu tiên ăn Quan &amp; giữ dân sân nhà
            </p>
          </div>
        </div>

        {/* Thanh hành trình bốc - rải - ăn quân từng bước của nước vừa đi */}
        {(state.lastStudentSimulation || state.lastAiSimulation) && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/90 bg-amber-50/90 px-4 py-3 text-xs">
            <div className="space-y-1">
              {state.lastStudentSimulation && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 font-extrabold text-amber-950">
                    <Hand className="size-3.5 text-orange-600" />
                    Nước rải của bạn (Ô {state.lastStudentSimulation.startIndex}):
                  </span>
                  {state.lastStudentSimulation.visitedPath.slice(0, 10).map((cellIdx, stepIdx) => (
                    <span
                      key={`${cellIdx}-${stepIdx}`}
                      className={`rounded-md px-1.5 py-0.5 font-bold ${
                        sowAnimStep === stepIdx
                          ? "bg-orange-600 text-white ring-2 ring-orange-300"
                          : "bg-white text-amber-950 border border-amber-200"
                      }`}
                    >
                      Ô {cellIdx}
                    </span>
                  ))}
                  {state.lastStudentSimulation.visitedPath.length > 10 && (
                    <span className="font-semibold text-amber-800">
                      ... ({state.lastStudentSimulation.visitedPath.length} bước)
                    </span>
                  )}
                  {state.lastStudentSimulation.capturedCells.length > 0 && (
                    <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 font-extrabold text-white">
                      Ăn Ô {state.lastStudentSimulation.capturedCells.join(", ")} (+
                      {state.lastStudentSimulation.capturedPoints} đ)
                    </span>
                  )}
                </div>
              )}

              {state.lastAiSimulation && (
                <div className="flex flex-wrap items-center gap-1.5 text-slate-700">
                  <span className="inline-flex items-center gap-1 font-extrabold text-slate-900">
                    <Bot className="size-3.5 text-amber-700" />
                    Phản hồi của Máy (Bốc Ô {state.lastAiSimulation.startIndex}):
                  </span>
                  <span>
                    Rải qua {state.lastAiSimulation.visitedPath.length} ô (kết thúc tại Ô{" "}
                    {state.lastAiSimulation.visitedPath[
                      state.lastAiSimulation.visitedPath.length - 1
                    ] ?? state.lastAiSimulation.startIndex}
                    )
                  </span>
                  {state.lastAiSimulation.capturedCells.length > 0 && (
                    <span className="rounded-full bg-amber-800 px-2 py-0.5 text-[11px] font-bold text-amber-100">
                      Máy ăn Ô {state.lastAiSimulation.capturedCells.join(", ")} (+
                      {state.lastAiSimulation.capturedPoints} đ)
                    </span>
                  )}
                </div>
              )}
            </div>

            {state.lastStudentSimulation && !reducedMotion && (
              <button
                type="button"
                onClick={() =>
                  triggerSowStepAnimation(state.lastStudentSimulation!.visitedPath.length)
                }
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-amber-400 bg-white px-3 py-1.5 text-xs font-extrabold text-amber-950 hover:bg-amber-100"
              >
                <Play className="size-3.5 text-orange-600" />
                Xem lại từng bước rải
              </button>
            )}
          </div>
        )}

        {/* Gợi ý từ Cố vấn Địa lí (nếu đã mở khóa) */}
        {state.recommendedMove && state.phase === "student_turn" && (
          <div
            role="status"
            className="flex items-center gap-3 rounded-2xl border-2 border-emerald bg-emerald/10 px-5 py-3 text-sm font-bold text-emerald-950"
          >
            <Lightbulb className="size-5 shrink-0 text-emerald" />
            <span>Cố vấn Địa lí gợi ý: {state.recommendedMove.reason}</span>
          </div>
        )}

        {/* BÀN CỜ GỖ TRẮC & TRE TRÚC VIỆT NAM */}
        <div
          className="relative rounded-[32px] border-4 border-[#78350f] bg-gradient-to-b from-[#d97706]/30 via-[#fde68a]/65 to-[#d97706]/35 p-3 shadow-[0_12px_30px_rgba(120,53,15,0.18),inset_0_2px_12px_rgba(120,53,15,0.22)] sm:p-6"
          aria-label="Bàn cờ Ô ăn quan truyền thống Việt Nam"
        >
          {/* Hoa văn góc bàn cờ truyền thống */}
          <div className="mb-2 flex items-center justify-between px-2 text-[11px] font-extrabold uppercase tracking-widest text-amber-950/75">
            <span>❖ Sân Cờ Dân Gian Việt Nam</span>
            <span>Quân Quan = 10 Dân • Hết 2 Quan Thu Tàn Dân ❖</span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[148px_minmax(0,1fr)_148px] md:items-stretch">
            {/* Ô QUAN TRÁI (Index 0) */}
            <div
              className={`relative flex flex-col items-center justify-between rounded-2xl border-2 p-3 text-center transition md:rounded-l-[76px] md:rounded-r-2xl ${
                activeAnimatedCellIndex === 0
                  ? "border-orange-500 bg-orange-100 ring-4 ring-orange-400"
                  : movePreview?.capturedCells.includes(0)
                    ? "border-emerald-600 bg-emerald-100/95 ring-2 ring-emerald-400"
                    : "border-[#92400e]/60 bg-gradient-to-b from-[#fef3c7] to-[#fde68a] shadow-inner"
              }`}
            >
              <span className="rounded-full bg-[#78350f] px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-amber-100">
                Quan Trái (0)
              </span>
              <StoneCluster cell={state.board[0]} />
              <div className="space-y-0.5">
                <span className="block text-[11px] font-semibold text-amber-900">
                  {state.board[0].hasMandarin ? "1 Quan + " : "0 Quan + "}
                  {state.board[0].stones} dân
                </span>
                <span className="inline-block rounded-full bg-amber-950/15 px-3 py-0.5 text-xs font-black text-amber-950">
                  Tổng: {cellPointValue(state.board[0])} đ
                </span>
              </div>
            </div>

            {/* 10 Ô DÂN Ở GIỮA (Hàng trên: Máy 11..7 | Hàng dưới: Học sinh 1..5) */}
            <div className="space-y-3">
              {/* Hàng trên: 5 Ô dân của Máy */}
              <div className="rounded-2xl border border-amber-900/20 bg-amber-950/5 p-2.5">
                <p className="mb-2 text-center text-[11px] font-extrabold uppercase tracking-wider text-amber-950">
                  ← Phần sân Đối thủ Máy (Ô 11 đến Ô 7) →
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {topRowIndices.map((idx) => {
                    const cell = state.board[idx];
                    const isCapturedInPreview = movePreview?.capturedCells.includes(idx);
                    const isVisitedInPreview = movePreview?.visitedPath.includes(idx);
                    const isActiveStep = activeAnimatedCellIndex === idx;
                    const isAiStart = state.lastAiSimulation?.startIndex === idx;

                    return (
                      <div
                        key={idx}
                        className={`relative flex min-h-28 flex-col items-center justify-between rounded-2xl border-2 p-2 text-center transition ${
                          isActiveStep
                            ? "border-orange-600 bg-orange-100 ring-4 ring-orange-400"
                            : isCapturedInPreview
                              ? "border-emerald-600 bg-emerald-100 shadow-sm"
                              : isVisitedInPreview
                                ? "border-amber-500 bg-amber-50"
                                : isAiStart
                                  ? "border-amber-700 bg-amber-100/80"
                                  : "border-[#92400e]/35 bg-[#fffbeb]/95 shadow-inner"
                        }`}
                      >
                        <div className="flex w-full items-center justify-between px-1">
                          <span className="text-[11px] font-extrabold text-amber-900">
                            Ô {idx}
                          </span>
                          {isCapturedInPreview && (
                            <span className="rounded bg-emerald-600 px-1 text-[9px] font-black text-white">
                              ĂN!
                            </span>
                          )}
                        </div>
                        <StoneCluster cell={cell} />
                        <span className="rounded-full bg-stone-200/80 px-2 py-0.5 text-xs font-extrabold text-stone-900">
                          {cell.stones} quân
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Hàng dưới: 5 Ô dân của Học sinh (Tương tác chọn ô) */}
              <div className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-2.5">
                <div className="grid grid-cols-5 gap-2">
                  {bottomRowIndices.map((idx) => {
                    const cell = state.board[idx];
                    const isSelected = state.selectedCellIndex === idx;
                    const isCapturedInPreview = movePreview?.capturedCells.includes(idx);
                    const isActiveStep = activeAnimatedCellIndex === idx;
                    const isRecommended = state.recommendedMove?.cellIndex === idx;
                    const disabled = state.phase !== "student_turn" || cell.stones <= 0;

                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={disabled}
                        onClick={() => handleSelectCell(idx)}
                        aria-label={`Ô dân ${idx} của bạn: có ${cell.stones} quân`}
                        aria-pressed={isSelected}
                        className={`relative flex min-h-28 flex-col items-center justify-between rounded-2xl border-2 p-2 text-center transition ${
                          isActiveStep
                            ? "border-orange-600 bg-orange-100 ring-4 ring-orange-400"
                            : isSelected
                              ? "border-[#ea580c] bg-orange-50 ring-2 ring-[#f97316] shadow-md"
                              : isRecommended
                                ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-400"
                                : isCapturedInPreview
                                  ? "border-emerald-500 bg-emerald-100"
                                  : cell.stones > 0
                                    ? "border-[#92400e]/40 bg-white hover:border-orange-500 hover:bg-orange-50/40"
                                    : "cursor-not-allowed border-stone-200 bg-stone-100/70 opacity-55"
                        }`}
                      >
                        <div className="flex w-full items-center justify-between px-1">
                          <span className="text-[11px] font-extrabold text-orange-800">
                            Ô dân {idx}
                          </span>
                          {isSelected && (
                            <span className="rounded bg-[#f97316] px-1 text-[9px] font-black text-white">
                              CHỌN
                            </span>
                          )}
                        </div>
                        <StoneCluster cell={cell} />
                        <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-extrabold text-orange-950">
                          {cell.stones} quân
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-center text-[11px] font-extrabold uppercase tracking-wider text-orange-900">
                  ← Phần sân của Bạn (Bấm chọn Ô 1 đến Ô 5 để bốc &amp; rải quân) →
                </p>
              </div>
            </div>

            {/* Ô QUAN PHẢI (Index 6) */}
            <div
              className={`relative flex flex-col items-center justify-between rounded-2xl border-2 p-3 text-center transition md:rounded-l-2xl md:rounded-r-[76px] ${
                activeAnimatedCellIndex === 6
                  ? "border-orange-500 bg-orange-100 ring-4 ring-orange-400"
                  : movePreview?.capturedCells.includes(6)
                    ? "border-emerald-600 bg-emerald-100/95 ring-2 ring-emerald-400"
                    : "border-[#92400e]/60 bg-gradient-to-b from-[#fef3c7] to-[#fde68a] shadow-inner"
              }`}
            >
              <span className="rounded-full bg-[#78350f] px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-amber-100">
                Quan Phải (6)
              </span>
              <StoneCluster cell={state.board[6]} />
              <div className="space-y-0.5">
                <span className="block text-[11px] font-semibold text-amber-900">
                  {state.board[6].hasMandarin ? "1 Quan + " : "0 Quan + "}
                  {state.board[6].stones} dân
                </span>
                <span className="inline-block rounded-full bg-amber-950/15 px-3 py-0.5 text-xs font-black text-amber-950">
                  Tổng: {cellPointValue(state.board[6])} đ
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bảng điều khiển nước đi & Chỉ dẫn nước đi */}
        {state.phase === "student_turn" && (
          <div className="grid gap-4 rounded-2xl border-2 border-amber-300/80 bg-white p-5 shadow-sm lg:grid-cols-[1fr_auto]">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-sm font-extrabold text-ink">
                  Đang chọn:{" "}
                  {state.selectedCellIndex
                    ? `Ô dân ${state.selectedCellIndex} (${state.board[state.selectedCellIndex].stones} quân)`
                    : "Chưa chọn ô dân"}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDirectionChange("left")}
                    aria-pressed={state.selectedDirection === "left"}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-4 text-xs font-bold transition sm:text-sm ${
                      state.selectedDirection === "left"
                        ? "border-[#f97316] bg-[#f97316] text-white shadow-sm"
                        : "border-line bg-canvas text-ink hover:bg-slate-100"
                    }`}
                  >
                    <ArrowLeft className="size-4" />
                    Rải sang Trái
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDirectionChange("right")}
                    aria-pressed={state.selectedDirection === "right"}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-4 text-xs font-bold transition sm:text-sm ${
                      state.selectedDirection === "right"
                        ? "border-[#f97316] bg-[#f97316] text-white shadow-sm"
                        : "border-line bg-canvas text-ink hover:bg-slate-100"
                    }`}
                  >
                    Rải sang Phải
                    <ArrowRight className="size-4" />
                  </button>
                </div>
              </div>

              {/* Chỉ dẫn dự báo kết quả nước đi */}
              {movePreview && (
                <p className="text-xs leading-relaxed text-secondary sm:text-sm">
                  <strong className="text-ink">Chỉ dẫn nước đi:</strong> Rải{" "}
                  {movePreview.relayCount > 0
                    ? `${movePreview.relayCount + 1} nhịp liên tiếp (${movePreview.visitedPath.length} viên)`
                    : `1 nhịp (${movePreview.visitedPath.length} viên)`}{" "}
                  •{" "}
                  {movePreview.capturedPoints > 0 ? (
                    <span className="font-bold text-emerald-700">
                      Dự kiến ăn được {movePreview.capturedPoints} điểm (tại ô{" "}
                      {movePreview.capturedCells.join(", ")}) và mở câu hỏi thưởng Địa lí!
                    </span>
                  ) : movePreview.stopReason === "mandarin_stop" ? (
                    <span>Dừng lượt do gặp Ô Quan.</span>
                  ) : (
                    <span>Dừng lượt tại ô trống (chưa ăn được quân).</span>
                  )}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setState((prev) => requestGeographyMoveAdvisor(prev))}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-emerald bg-emerald/10 px-5 text-xs font-extrabold text-emerald-800 hover:bg-emerald/20 sm:text-sm"
              >
                <HelpCircle className="size-4 text-emerald" />
                Cố vấn Địa lí (Gợi ý nước đi)
              </button>

              <button
                type="button"
                disabled={
                  state.selectedCellIndex === null ||
                  state.board[state.selectedCellIndex]?.stones <= 0
                }
                onClick={handleConfirmMove}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#f97316] px-7 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Thực hiện nước rải ➔
              </button>
            </div>
          </div>
        )}

        {/* Modal/Khung Câu hỏi Địa lí 10 khi Ăn Quân hoặc Dùng Cố vấn */}
        {(state.phase === "capture_quiz" || state.phase === "advisor_quiz") &&
          currentQuestion && (
            <div
              role="region"
              aria-label="Thử thách câu hỏi Địa lí 10"
              className="space-y-4 rounded-3xl border-2 border-[#f97316] bg-white p-6 shadow-xl"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3.5 py-1 text-xs font-extrabold text-orange-800">
                  <Sparkles className="size-4 text-[#f97316]" />
                  {state.phase === "capture_quiz"
                    ? `Thử thách Địa lí khi ăn ${state.pendingCapturePoints} điểm: Trả lời đúng để nhận điểm thưởng!`
                    : "Cố vấn Địa lí 10: Trả lời đúng để xem gợi ý nước đi tốt nhất!"}
                </span>
              </div>

              <p className="text-base font-extrabold leading-relaxed text-ink sm:text-lg">
                {currentQuestion.content}
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                {currentQuestion.options.map((opt) => {
                  const isSelected = state.selectedOptionId === opt.id;
                  const isRevealed = state.selectedOptionId !== null;
                  const isCorrect = isRevealed && opt.id === currentQuestion.correctOptionId;
                  const isWrong = isRevealed && isSelected && !isCorrect;

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={isRevealed}
                      onClick={() => handleQuizAnswer(opt.id)}
                      className={`flex min-h-14 items-center gap-3 rounded-2xl border p-4 text-left text-sm font-bold transition ${
                        isCorrect
                          ? "border-2 border-emerald bg-emerald/15 text-emerald-950"
                          : isWrong
                            ? "border-2 border-red-500 bg-red-50 text-red-900"
                            : "border-line bg-canvas text-ink hover:border-[#f97316]"
                      }`}
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white font-extrabold text-ink shadow-sm">
                        {opt.id}
                      </span>
                      <span className="min-w-0 flex-1">{opt.text}</span>
                    </button>
                  );
                })}
              </div>

              {state.selectedOptionId !== null && (
                <div className="rounded-2xl border border-line bg-canvas p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-sm font-extrabold text-ink">
                      {state.lastQuizCorrect ? (
                        <>
                          <CheckCircle2 className="size-5 text-emerald" />
                          <span className="text-emerald-700">
                            Chính xác! Bạn nhận được điểm thưởng Địa lí.
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="size-5 text-red-500" />
                          <span className="text-red-600">
                            Chưa chính xác (Đáp án đúng: {currentQuestion.correctOptionId}).
                          </span>
                        </>
                      )}
                    </p>

                    <button
                      type="button"
                      onClick={() => setState((prev) => completeOAnQuanQuizModal(prev))}
                      className="inline-flex min-h-11 items-center rounded-full bg-[#f97316] px-6 text-sm font-extrabold text-white hover:bg-[#ea580c]"
                    >
                      Tiếp tục ván cờ ➔
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-secondary">
                    <strong className="text-ink">Giải thích:</strong>{" "}
                    {currentQuestion.explanation}
                  </p>
                </div>
              )}
            </div>
          )}

        {/* Màn hình Kết thúc ván cờ */}
        {state.phase === "game_over" && (
          <div className="rounded-3xl border border-line bg-white p-8 text-center shadow-card">
            <Trophy className="mx-auto size-14 text-[#f97316]" />
            <h2 className="mt-3 text-2xl font-extrabold text-ink">
              {state.winner === "student"
                ? "BẠN ĐÃ CHIẾN THẮNG VÁN Ô ĂN QUAN ĐỊA LÝ!"
                : state.winner === "draw"
                  ? "VÁN CỜ KẾT THÚC HÒA!"
                  : "ĐỐI THỦ MÁY GIÀNH CHIẾN THẮNG!"}
            </h2>
            <p className="mt-2 text-sm text-secondary">
              Tổng điểm của bạn: <strong className="text-ink">{totalStudentScore}</strong>{" "}
              (Quân cờ: {state.studentCapturedScore} + Thưởng Địa lí:{" "}
              {state.studentGeoBonusScore}) • Điểm của Máy:{" "}
              <strong className="text-ink">{state.aiCapturedScore}</strong>
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => handleRestart(chapterId)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#f97316] px-6 text-sm font-bold text-white hover:bg-[#ea580c]"
              >
                <RotateCcw className="size-4" />
                Chơi ván mới
              </button>
              <button
                type="button"
                onClick={onBack}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-6 text-sm font-bold text-ink hover:bg-canvas"
              >
                Về Trung tâm Game
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
