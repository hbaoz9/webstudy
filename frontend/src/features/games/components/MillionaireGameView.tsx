import { useCallback, useEffect, useRef, useState } from "react";
import {
  Award,
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
  Phone,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Users,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import { geo10Chapters } from "../../../data/geo10Curriculum";
import { getChapterDeckAvailability } from "../data/geo10GameQuestions";
import type { GameQuizOptionId } from "../types";
import {
  MILLIONAIRE_LADDER,
  advanceMillionaireQuestion,
  answerMillionaireQuestion,
  createMillionaireState,
  formatMillionairePrize,
  handleMillionaireTimeout,
  useLifeline5050,
  useLifelineAudiencePoll,
  useLifelineExpertHint,
  useLifelineSwitchQuestion,
  walkAwayMillionaire,
  type MillionaireState,
} from "../engine/millionaireEngine";
import { isGameSoundEnabled, playGameSound, setGameSoundEnabled } from "../gameSound";

export function MillionaireGameView({
  initialChapterId = "all",
  playerName = "Học sinh",
  onBack,
  onRecordResult,
}: {
  initialChapterId?: string;
  playerName?: string;
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
  const [allowCrossChapter, setAllowCrossChapter] = useState(false);
  const [state, setState] = useState<MillionaireState>(() =>
    createMillionaireState(initialChapterId, Math.random, {
      allowCrossChapterFallback: false,
    }),
  );
  const [soundOn, setSoundOn] = useState<boolean>(() => isGameSoundEnabled());
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );
  const [lockingOptionId, setLockingOptionId] = useState<GameQuizOptionId | null>(null);
  const [showLadderMobile, setShowLadderMobile] = useState(false);
  const [resultRecorded, setResultRecorded] = useState(false);
  const lockTimerRef = useRef<number | null>(null);

  const totalSteps = state.questions.length;
  const activeLadder = MILLIONAIRE_LADDER.slice(0, totalSteps);
  const currentQuestion = state.questions[state.currentIndex];
  const currentStepInfo = activeLadder[state.currentIndex] ?? MILLIONAIRE_LADDER[0];
  const availability = getChapterDeckAvailability(chapterId, 15, "quiz");

  useEffect(() => {
    return () => {
      if (lockTimerRef.current !== null) {
        window.clearTimeout(lockTimerRef.current);
      }
    };
  }, []);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setGameSoundEnabled(next);
  };

  // Đếm ngược thời gian khi đang ở trạng thái "playing" và chưa khóa đáp án
  useEffect(() => {
    if (state.status !== "playing" || lockingOptionId !== null) return;
    const timer = window.setInterval(() => {
      setState((prev) => {
        if (prev.status !== "playing") return prev;
        if (prev.timeRemaining <= 1) {
          playGameSound("wrong", soundOn);
          return handleMillionaireTimeout(prev);
        }
        return { ...prev, timeRemaining: prev.timeRemaining - 1 };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state.status, state.currentIndex, soundOn, lockingOptionId]);

  // Ghi nhận kỷ lục thiết bị khi kết thúc ván
  useEffect(() => {
    if (resultRecorded) return;
    if (
      state.status === "won" ||
      state.status === "lost" ||
      state.status === "walked_away"
    ) {
      setResultRecorded(true);
      const answeredCount =
        state.status === "won"
          ? totalSteps
          : state.currentIndex;
      const summary =
        state.status === "won"
          ? `Chinh phục trọn vẹn ${totalSteps}/${totalSteps} câu hỏi Triệu phú Địa lý!`
          : state.status === "walked_away"
            ? `Dừng cuộc chơi an toàn tại câu ${state.currentIndex + 1} (${answeredCount}/${totalSteps} câu đúng).`
            : `Dừng bước ở câu ${state.currentIndex + 1} (${answeredCount}/${totalSteps} câu đúng).`;
      onRecordResult({
        score: state.finalPrize,
        maxScore: activeLadder[activeLadder.length - 1]?.points ?? MILLIONAIRE_LADDER[14].points,
        won: state.status === "won",
        summary,
        chapterId: state.chapterId !== "all" ? state.chapterId : undefined,
      });
    }
  }, [state, resultRecorded, onRecordResult, totalSteps, activeLadder]);

  const commitAnswer = useCallback(
    (optionId: GameQuizOptionId) => {
      setLockingOptionId(null);
      setState((prev) => {
        const next = answerMillionaireQuestion(prev, optionId);
        if (next.status === "won") {
          playGameSound("victory", soundOn);
        } else if (next.status === "revealed_correct") {
          playGameSound("correct", soundOn);
        } else if (next.status === "lost") {
          playGameSound("wrong", soundOn);
        }
        return next;
      });
    },
    [soundOn],
  );

  const handleSelectOption = useCallback(
    (optionId: GameQuizOptionId) => {
      if (state.status !== "playing" || lockingOptionId !== null) return;
      if (state.hiddenOptionIds.includes(optionId)) return;

      const isJsdom = typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent);
      if (reducedMotion || isJsdom) {
        commitAnswer(optionId);
        return;
      }

      setLockingOptionId(optionId);
      lockTimerRef.current = window.setTimeout(() => {
        commitAnswer(optionId);
      }, 360);
    },
    [state.status, state.hiddenOptionIds, lockingOptionId, reducedMotion, commitAnswer],
  );

  // Hỗ trợ phím tắt A/B/C/D hoặc 1/2/3/4
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
        return;
      }
      if (state.status === "playing" && lockingOptionId === null) {
        const key = event.key.toUpperCase();
        if (key === "A" || key === "1") handleSelectOption("A");
        else if (key === "B" || key === "2") handleSelectOption("B");
        else if (key === "C" || key === "3") handleSelectOption("C");
        else if (key === "D" || key === "4") handleSelectOption("D");
      } else if (state.status === "revealed_correct" && event.key === "Enter") {
        setState((prev) => advanceMillionaireQuestion(prev));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state.status, lockingOptionId, handleSelectOption]);

  const handleRestart = (
    nextChapterId = chapterId,
    nextAllowCrossChapter = allowCrossChapter,
  ) => {
    if (lockTimerRef.current !== null) {
      window.clearTimeout(lockTimerRef.current);
    }
    setLockingOptionId(null);
    setChapterId(nextChapterId);
    setAllowCrossChapter(nextAllowCrossChapter);
    setResultRecorded(false);
    setState(
      createMillionaireState(nextChapterId, Math.random, {
        allowCrossChapterFallback: nextAllowCrossChapter,
      }),
    );
  };

  const chapterLabel =
    chapterId === "all"
      ? "Toàn bộ chương trình Địa lí 10"
      : geo10Chapters.find((c) => c.id === chapterId)?.title ?? "Địa lí 10";

  const currentQuestionChapter = currentQuestion
    ? geo10Chapters.find((c) => c.id === currentQuestion.chapterId)
    : undefined;

  const isMilestoneJustReached =
    state.status === "revealed_correct" &&
    (state.currentIndex + 1 === 5 ||
      state.currentIndex + 1 === 10 ||
      (totalSteps < 15 && state.currentIndex + 1 === Math.max(3, Math.floor(totalSteps / 2))));

  return (
    <div
      className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#070b19] via-[#111235] to-[#090d1d] text-white shadow-card"
      data-testid="millionaire-game-view"
    >
      {/* Đèn sân khấu Gameshow (Spotlight Beams) */}
      {!reducedMotion && (
        <svg
          viewBox="0 0 1200 500"
          className="pointer-events-none absolute inset-x-0 top-0 h-80 w-full opacity-35"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="stageBeamLeft" x1="0" y1="0" x2="0.6" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="stageBeamRight" x1="1" y1="0" x2="0.4" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points="180,0 520,500 760,500 320,0" fill="url(#stageBeamLeft)" />
          <polygon points="1020,0 680,500 440,500 880,0" fill="url(#stageBeamRight)" />
        </svg>
      )}

      {/* Thanh điều khiển phía trên */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#090f1e]/75 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-sm font-bold text-slate-200 transition hover:bg-white/10"
          >
            <ArrowLeft className="size-4" />
            Về Trung tâm Game
          </button>
          <span className="hidden text-xs font-semibold text-slate-300 sm:inline">
            Chủ đề: {chapterLabel}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="millionaire-chapter-select">
            Chọn chương Địa lí 10
          </label>
          <select
            id="millionaire-chapter-select"
            value={chapterId}
            onChange={(e) => handleRestart(e.target.value, false)}
            className="min-h-11 rounded-xl border border-white/15 bg-[#1e293b] px-3 text-xs font-bold text-white"
          >
            <option value="all">Tất cả chương Địa lí 10 (15 câu chuẩn)</option>
            {geo10Chapters.map((c) => (
              <option key={c.id} value={c.id}>
                Chương {c.number}: {c.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowLadderMobile((v) => !v)}
            className="inline-flex min-h-11 items-center rounded-xl border border-amber/40 bg-amber/15 px-3 text-xs font-bold text-amber lg:hidden"
          >
            {showLadderMobile ? "Ẩn tháp điểm" : `Tháp điểm (${currentStepInfo?.label ?? ""})`}
          </button>

          <button
            type="button"
            onClick={() => setReducedMotion((v) => !v)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-bold text-slate-200 hover:bg-white/10"
          >
            <Sparkles className="size-3.5 text-amber-300" />
            <span className="hidden sm:inline">
              {reducedMotion ? "Hiệu ứng: Giảm" : "Hiệu ứng: Đầy đủ"}
            </span>
          </button>

          <button
            type="button"
            onClick={toggleSound}
            aria-label={soundOn ? "Tắt âm thanh" : "Bật âm thanh"}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-bold text-slate-200 hover:bg-white/10"
          >
            {soundOn ? <Volume2 className="size-4 text-emerald" /> : <VolumeX className="size-4 text-slate-400" />}
            <span className="hidden sm:inline">{soundOn ? "Âm thanh: Bật" : "Âm thanh: Tắt"}</span>
          </button>
        </div>
      </div>

      {/* Thông báo minh bạch khi chọn 1 chương đơn lẻ (không âm thầm trộn chương) */}
      {availability.isShortOfStandard && (
        <div
          role="region"
          aria-label="Tùy chọn chế độ câu hỏi theo chương"
          className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-amber-400/25 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-100 sm:px-6"
        >
          <p>
            <strong>{availability.chapterTitle}</strong> hiện có{" "}
            <strong>{availability.availableCount} câu hỏi</strong>.{" "}
            {!allowCrossChapter
              ? `Đang chơi chế độ Chuyên đề thuần túy (${totalSteps} câu thuộc đúng chương này + 1 câu dự phòng đổi câu, không trộn chương khác).`
              : "Đang bật chế độ mở rộng: ưu tiên câu thuộc chương đã chọn và bổ sung câu từ chương khác để đủ 15 nấc thang."}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleRestart(chapterId, !allowCrossChapter)}
              className="rounded-lg border border-amber-300/50 bg-amber-400/20 px-3 py-1 font-extrabold text-amber-200 transition hover:bg-amber-400/30"
            >
              {!allowCrossChapter
                ? "Mở rộng đủ 15 câu (kèm chương khác)"
                : `Chỉ lấy câu thuộc chương này (${Math.max(1, availability.availableCount - 1)} câu)`}
            </button>
          </div>
        </div>
      )}

      <div className="relative z-10 flex flex-col lg:flex-row">
        {/* Cột trái: Tháp giải thưởng + Quyền trợ giúp */}
        <aside
          aria-label="Tháp điểm và quyền trợ giúp"
          className={`${
            showLadderMobile ? "flex" : "hidden lg:flex"
          } w-full shrink-0 flex-col justify-between gap-6 border-b border-white/10 bg-[#090f1e]/55 p-5 sm:p-7 lg:w-[340px] lg:border-b-0 lg:border-r`}
        >
          <div className="space-y-3">
            <h1 className="text-lg font-extrabold tracking-wide text-white">
              AI LÀ TRIỆU PHÚ
            </h1>
            <div className="inline-flex items-center gap-1.5 rounded-xl border border-[#f59e0b] bg-[#f59e0b]/15 px-3 py-1">
              <span className="text-[11px] font-bold uppercase text-[#f59e0b]">
                PHIÊN BẢN ĐỊA LÍ 10 ({totalSteps} CÂU)
              </span>
            </div>
          </div>

          {/* Các bậc từ cao xuống thấp */}
          <ol className="flex flex-col-reverse gap-1 text-sm" aria-label={`Thang điểm ${totalSteps} câu hỏi`}>
            {activeLadder.map((item, idx) => {
              const isCurrent = idx === state.currentIndex && state.status !== "won";
              const isPassed = idx < state.currentIndex || state.status === "won";
              const isStepMilestone =
                totalSteps === 15
                  ? item.isMilestone
                  : idx + 1 === totalSteps || idx + 1 === Math.max(3, Math.floor(totalSteps / 2));

              return (
                <li
                  key={item.step}
                  className={`flex items-center justify-between rounded-lg px-3.5 py-1.5 transition ${
                    isCurrent
                      ? "bg-[#f59e0b] font-extrabold text-[#0f1e36] shadow-md"
                      : isPassed
                        ? "bg-emerald/15 text-emerald-300"
                        : "text-slate-400"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`font-extrabold ${
                        isCurrent
                          ? "text-[#0f1e36]"
                          : isStepMilestone
                            ? "text-[#10b981]"
                            : "text-slate-400"
                      }`}
                    >
                      {item.step}
                    </span>
                    <span>•</span>
                  </span>
                  <span
                    className={`font-bold ${
                      isCurrent
                        ? "text-[#0f1e36]"
                        : isStepMilestone
                          ? "text-white"
                          : "text-slate-400"
                    }`}
                  >
                    {item.label}
                  </span>
                </li>
              );
            })}
          </ol>

          {/* Quyền trợ giúp */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Quyền trợ giúp
            </p>
            <div className="grid grid-cols-4 gap-2.5">
              <button
                type="button"
                disabled={state.status !== "playing" || lockingOptionId !== null || state.lifelinesUsed.fiftyFifty}
                onClick={() => {
                  playGameSound("lifeline", soundOn);
                  setState((prev) => useLifeline5050(prev));
                }}
                title="50:50 — Loại bỏ 2 phương án sai"
                className="flex h-14 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-xs font-extrabold text-white transition hover:border-amber hover:bg-amber/20 disabled:cursor-not-allowed disabled:opacity-35"
              >
                50:50
              </button>

              <button
                type="button"
                disabled={state.status !== "playing" || lockingOptionId !== null || state.lifelinesUsed.expertHint}
                onClick={() => {
                  playGameSound("lifeline", soundOn);
                  setState((prev) => useLifelineExpertHint(prev));
                }}
                aria-label="Gợi ý chuyên gia Địa lí"
                title="Gợi ý chuyên gia Địa lí"
                className="flex h-14 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:border-amber hover:bg-amber/20 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Phone className="size-5" />
              </button>

              <button
                type="button"
                disabled={state.status !== "playing" || lockingOptionId !== null || state.lifelinesUsed.audiencePoll}
                onClick={() => {
                  playGameSound("lifeline", soundOn);
                  setState((prev) => useLifelineAudiencePoll(prev));
                }}
                aria-label="Hỏi ý kiến lớp học (mô phỏng)"
                title="Hỏi ý kiến lớp học (mô phỏng)"
                className="flex h-14 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:border-amber hover:bg-amber/20 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Users className="size-5" />
              </button>

              <button
                type="button"
                disabled={
                  state.status !== "playing" ||
                  lockingOptionId !== null ||
                  state.lifelinesUsed.switchQuestion ||
                  state.reserveQuestions.length === 0
                }
                onClick={() => {
                  playGameSound("lifeline", soundOn);
                  setState((prev) => useLifelineSwitchQuestion(prev));
                }}
                aria-label="Đổi câu hỏi khác"
                title="Đổi câu hỏi khác"
                className="flex h-14 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:border-amber hover:bg-amber/20 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <RefreshCw className="size-5" />
              </button>
            </div>
          </div>
        </aside>

        {/* Sân khấu chính */}
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-7 p-5 sm:p-8 lg:p-10">
          {/* Spotlight & Thông tin câu hỏi hiện tại */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="relative flex size-24 items-center justify-center rounded-full border-2 border-amber-400/40 bg-gradient-to-b from-amber-500/20 to-purple-900/40 shadow-[0_0_40px_rgba(245,158,11,0.25)] sm:size-28">
              <Award className="size-12 text-[#f59e0b] sm:size-14" />
              {state.status === "playing" && (
                <span
                  aria-label={`Thời gian còn lại ${state.timeRemaining} giây`}
                  className={`absolute -bottom-2 rounded-full border px-3 py-0.5 text-xs font-extrabold ${
                    state.timeRemaining <= 8
                      ? "border-red-400 bg-red-600 text-white"
                      : "border-amber bg-[#0f1e36] text-amber"
                  }`}
                >
                  {state.timeRemaining}s
                </span>
              )}
            </div>
            <p className="mt-2 text-sm font-bold uppercase tracking-wider text-[#f59e0b]">
              BẠN ĐANG Ở CÂU HỎI SỐ {state.currentIndex + 1} / {totalSteps} • MỨC THƯỞNG:{" "}
              {currentStepInfo?.label}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1">
                <ShieldCheck className="size-3.5 text-emerald" />
                Mốc bảo toàn: {formatMillionairePrize(state.guaranteedPrize)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1">
                Điểm tích lũy: {formatMillionairePrize(state.currentPrize)}
              </span>
              {currentQuestionChapter && (
                <span className="inline-flex items-center gap-1 rounded-full border border-purple-400/30 bg-purple-500/15 px-3 py-1 text-purple-200">
                  Chương {currentQuestionChapter.number}: {currentQuestionChapter.title}
                </span>
              )}
            </div>
          </div>

          {/* Trạng thái đang chơi hoặc vừa trả lời */}
          {currentQuestion && state.status !== "won" && state.status !== "walked_away" && (
            <>
              {/* Khung câu hỏi viền vàng sân khấu */}
              <div className="rounded-[22px] border-2 border-[#f59e0b] bg-gradient-to-b from-[#1e1b4b]/85 to-[#0f172a]/90 p-6 shadow-[0px_0px_35px_0px_rgba(245,158,11,0.18)] sm:p-8">
                <p className="text-center text-lg font-extrabold leading-relaxed text-white sm:text-[21px]">
                  Câu hỏi {state.currentIndex + 1}: {currentQuestion.content}
                </p>
              </div>

              {/* Thông báo hồi hộp khi khóa phương án */}
              {lockingOptionId && (
                <div
                  role="status"
                  className="rounded-xl border border-amber-400 bg-amber-500/20 px-4 py-2.5 text-center text-xs font-extrabold uppercase tracking-wider text-amber-200"
                >
                  🔒 Đã khóa phương án {lockingOptionId}... Đang chờ công bố kết quả!
                </div>
              )}

              {/* Khung kết quả quyền trợ giúp */}
              {(state.expertHintText || state.audiencePoll) && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {state.expertHintText && (
                    <div
                      role="status"
                      className="rounded-2xl border border-amber/40 bg-amber/10 p-4 text-sm text-amber-100"
                    >
                      <p className="flex items-center gap-2 font-extrabold text-[#f59e0b]">
                        <HelpCircle className="size-4 shrink-0" />
                        Cố vấn chuyên gia Địa lí 10:
                      </p>
                      <p className="mt-1.5 leading-relaxed">{state.expertHintText}</p>
                    </div>
                  )}

                  {state.audiencePoll && (
                    <div
                      role="status"
                      className="rounded-2xl border border-emerald/40 bg-emerald/10 p-4 text-sm text-emerald-100"
                    >
                      <p className="font-extrabold text-emerald-300">
                        Khảo sát ý kiến lớp học (mô phỏng tham khảo):
                      </p>
                      <div className="mt-2.5 grid grid-cols-4 gap-2 text-center text-xs font-bold">
                        {(["A", "B", "C", "D"] as const).map((optId) => (
                          <div key={optId} className="rounded-lg bg-[#090f1e]/60 p-2">
                            <span className="text-[#f59e0b]">{optId}: </span>
                            <span>{state.audiencePoll?.[optId] ?? 0}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Lưới 4 phương án A, B, C, D */}
              <div className="grid gap-4 sm:grid-cols-2">
                {currentQuestion.options.map((option) => {
                  const isHidden = state.hiddenOptionIds.includes(option.id);
                  const isLocking = lockingOptionId === option.id;
                  const isSelected = state.selectedOptionId === option.id || isLocking;
                  const isRevealed =
                    state.status === "revealed_correct" || state.status === "lost";
                  const isCorrectOption =
                    isRevealed && option.id === currentQuestion.correctOptionId;
                  const isWrongSelection =
                    state.status === "lost" && isSelected && !isCorrectOption;

                  let cardStyle =
                    "border-white/15 bg-[#1e293b]/90 hover:border-[#f59e0b] hover:bg-[#26354d]";
                  if (isLocking) {
                    cardStyle =
                      "border-2 border-amber-400 bg-amber-500/30 text-white shadow-[0_0_20px_rgba(245,158,11,0.35)]";
                  } else if (isCorrectOption) {
                    cardStyle =
                      "border-2 border-emerald-400 bg-emerald-500/30 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]";
                  } else if (isWrongSelection) {
                    cardStyle = "border-2 border-red-500 bg-red-500/25 text-white";
                  } else if (isSelected) {
                    cardStyle = "border-[#f59e0b] bg-[#1e293b]";
                  }

                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={state.status !== "playing" || lockingOptionId !== null || isHidden}
                      onClick={() => handleSelectOption(option.id)}
                      className={`flex min-h-16 items-center gap-4 rounded-[16px] border p-4 text-left transition sm:p-5 ${cardStyle} ${
                        isHidden ? "invisible pointer-events-none" : ""
                      }`}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-base font-extrabold text-[#f59e0b]">
                        {option.id}.
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-bold leading-snug text-white sm:text-base">
                        {option.text}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Giải thích đáp án & điều hướng câu tiếp theo */}
              {(state.status === "revealed_correct" || state.status === "lost") && (
                <div
                  role="region"
                  aria-label="Giải thích kiến thức"
                  className={`rounded-2xl border p-5 ${
                    state.status === "revealed_correct"
                      ? "border-emerald/50 bg-emerald/15"
                      : "border-red-400/50 bg-red-950/40"
                  }`}
                >
                  {isMilestoneJustReached && (
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-400 px-3.5 py-1 text-xs font-black uppercase text-slate-950">
                      🏆 Chúc mừng! Bạn đã chinh phục Mốc bảo toàn điểm an toàn!
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-base font-extrabold">
                      {state.status === "revealed_correct" ? (
                        <>
                          <CheckCircle2 className="size-5 text-emerald-400" />
                          <span className="text-emerald-300">
                            Chính xác! Bạn đạt mốc {currentStepInfo?.label}.
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="size-5 text-red-400" />
                          <span className="text-red-300">
                            {state.timeoutLost
                              ? "Hết thời gian suy nghĩ!"
                              : `Tiếc quá! Đáp án đúng là ${currentQuestion.correctOptionId}.`}
                          </span>
                        </>
                      )}
                    </p>

                    {state.status === "revealed_correct" ? (
                      <button
                        type="button"
                        onClick={() => setState((prev) => advanceMillionaireQuestion(prev))}
                        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#f59e0b] px-6 text-sm font-extrabold text-[#0f1e36] hover:bg-amber-400"
                      >
                        Câu hỏi tiếp theo ➔
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRestart(chapterId, allowCrossChapter)}
                        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-emerald px-6 text-sm font-extrabold text-white hover:bg-emerald-600"
                      >
                        <RotateCcw className="size-4" />
                        Chơi ván mới
                      </button>
                    )}
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-slate-200">
                    <strong className="text-white">Giải thích Địa lí 10:</strong>{" "}
                    {currentQuestion.explanation}
                  </p>
                  {state.status === "lost" && (
                    <p className="mt-2 text-xs font-bold text-amber">
                      Điểm nhận được theo mốc an toàn:{" "}
                      {formatMillionairePrize(state.finalPrize)}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Màn hình Chiến thắng hoặc Dừng cuộc chơi nhận thưởng */}
          {(state.status === "won" || state.status === "walked_away") && (
            <div className="my-auto rounded-3xl border-2 border-[#f59e0b] bg-[#1e1b4b]/80 p-8 text-center shadow-xl">
              <Award className="mx-auto size-16 text-[#f59e0b]" />
              <h2 className="mt-4 text-2xl font-extrabold text-white sm:text-3xl">
                {state.status === "won"
                  ? "CHÚC MỪNG TRIỆU PHÚ ĐỊA LÝ 10!"
                  : "BẢO TOÀN ĐIỂM THƯỞNG THÀNH CÔNG!"}
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                {state.status === "won"
                  ? `Bạn đã trả lời chính xác tuyệt đối cả ${totalSteps}/${totalSteps} câu hỏi Địa lí 10!`
                  : `Bạn đã quyết định dừng cuộc chơi tại câu hỏi số ${state.currentIndex + 1}.`}
              </p>
              <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-amber/40 bg-[#090f1e]/70 p-4">
                <p className="text-xs font-bold uppercase text-slate-400">
                  Tổng điểm kỷ lục đạt được
                </p>
                <p className="mt-1 text-2xl font-extrabold text-[#f59e0b]">
                  {formatMillionairePrize(state.finalPrize)}
                </p>
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => handleRestart(chapterId, allowCrossChapter)}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#f59e0b] px-7 text-sm font-extrabold text-[#0f1e36] hover:bg-amber-400"
                >
                  <RotateCcw className="size-4" />
                  Chơi lại ván mới
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/20 px-6 text-sm font-bold text-white hover:bg-white/10"
                >
                  Về Trung tâm Game
                </button>
              </div>
            </div>
          )}

          {/* Footer sân khấu */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
            <button
              type="button"
              disabled={
                (state.status !== "playing" && state.status !== "revealed_correct") ||
                lockingOptionId !== null ||
                state.currentPrize <= 0
              }
              onClick={() => setState((prev) => walkAwayMillionaire(prev))}
              className="min-h-11 rounded-[20px] border border-white/15 px-5 py-2 text-sm font-semibold text-[#ef4444] transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Dừng cuộc chơi &amp; Bảo toàn điểm
            </button>
            <p className="text-xs text-slate-400 sm:text-sm">
              Người chơi: {playerName} | Phím tắt: A, B, C, D hoặc 1–4
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
