import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Crosshair,
  Flame,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import { geo10Chapters } from "../../../data/geo10Curriculum";
import type { GameQuizOptionId } from "../types";
import {
  GOAL_ZONES,
  advancePenaltyRound,
  answerPenaltyQuestion,
  createPenaltyQuizState,
  shootPenaltyBall,
  type GoalZoneId,
  type PenaltyQuizState,
} from "../engine/penaltyEngine";
import { isGameSoundEnabled, playGameSound, setGameSoundEnabled } from "../gameSound";

const ZONE_SVG_COORDS: Record<GoalZoneId, { x: number; y: number }> = {
  "top-left": { x: 245, y: 112 },
  "top-right": { x: 555, y: 112 },
  center: { x: 400, y: 145 },
  "bottom-left": { x: 245, y: 192 },
  "bottom-right": { x: 555, y: 192 },
};

export function PenaltyQuizGameView({
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
  const [state, setState] = useState<PenaltyQuizState>(() =>
    createPenaltyQuizState(initialChapterId, 5),
  );
  const [soundOn, setSoundOn] = useState<boolean>(() => isGameSoundEnabled());
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );
  const [hoveredZone, setHoveredZone] = useState<GoalZoneId | null>(null);
  const [resultRecorded, setResultRecorded] = useState(false);

  const currentQuestion = state.questions[state.currentRound];
  const currentQuestionChapter = currentQuestion
    ? geo10Chapters.find((c) => c.id === currentQuestion.chapterId)
    : undefined;

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setGameSoundEnabled(next);
  };

  useEffect(() => {
    if (resultRecorded) return;
    if (state.phase === "match_finished") {
      setResultRecorded(true);
      const won = state.playerGoals > state.opponentGoals;
      onRecordResult({
        score: state.score,
        maxScore: 1450,
        won,
        summary: `Tỉ số Penalty ${state.playerGoals} - ${state.opponentGoals} (${state.correctQuizCount}/${state.totalRounds} câu Địa lí đúng).`,
        chapterId: state.chapterId !== "all" ? state.chapterId : undefined,
      });
    }
  }, [state, resultRecorded, onRecordResult]);

  const handleRestart = (nextChapterId = chapterId) => {
    setChapterId(nextChapterId);
    setResultRecorded(false);
    setHoveredZone(null);
    setState(createPenaltyQuizState(nextChapterId, 5));
  };

  const handleAnswer = (optionId: GameQuizOptionId) => {
    const next = answerPenaltyQuestion(state, optionId);
    if (next.lastQuizCorrect) {
      playGameSound("correct", soundOn);
    } else {
      playGameSound("wrong", soundOn);
    }
    setState(next);
  };

  const handleShoot = (zoneId: GoalZoneId) => {
    const next = shootPenaltyBall(state, zoneId);
    if (next.lastShotScored) {
      playGameSound("goal", soundOn);
    } else {
      playGameSound("wrong", soundOn);
    }
    setState(next);
  };

  const ballCoords =
    state.phase === "round_summary" && state.lastShotTarget
      ? ZONE_SVG_COORDS[state.lastShotTarget]
      : { x: 400, y: 315 };

  const keeperCoords =
    state.phase === "round_summary" && state.lastKeeperDive
      ? ZONE_SVG_COORDS[state.lastKeeperDive]
      : { x: 400, y: 170 };

  const keeperDiveRotation =
    state.phase === "round_summary" && state.lastKeeperDive
      ? state.lastKeeperDive.includes("left")
        ? -28
        : state.lastKeeperDive.includes("right")
          ? 28
          : 0
      : 0;

  return (
    <div
      className="overflow-hidden rounded-3xl border border-line bg-[#061814] text-white shadow-card"
      data-testid="penalty-quiz-game-view"
    >
      {/* Header điều khiển & Chọn chương */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#04120e] px-4 py-3.5 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3.5 text-sm font-bold text-white hover:bg-white/10"
          >
            <ArrowLeft className="size-4" />
            Quay lại
          </button>
          <div>
            <h1 className="text-base font-extrabold text-white sm:text-xl">
              Penalty Quiz Địa lí 10 — Sân vận động Luân lưu
            </h1>
            <p className="text-xs text-emerald-300">
              Trả lời câu hỏi Địa lí để nạp 100% lực sút ➔ Nhắm thẳng góc khung thành để dứt điểm!
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="penalty-chapter-select">
            Chọn chương Địa lí 10
          </label>
          <select
            id="penalty-chapter-select"
            value={chapterId}
            onChange={(e) => handleRestart(e.target.value)}
            className="min-h-11 rounded-xl border border-white/15 bg-[#0b2921] px-3 text-xs font-bold text-white"
          >
            <option value="all">Tất cả chương Địa lí 10 (5 lượt chuẩn)</option>
            {geo10Chapters.map((c) => (
              <option key={c.id} value={c.id}>
                Chương {c.number}: {c.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setReducedMotion((v) => !v)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-bold text-slate-200 hover:bg-white/10"
          >
            <Sparkles className="size-3.5 text-amber-300" />
            <span className="hidden sm:inline">
              {reducedMotion ? "Chuyển động: Giảm" : "Chuyển động: Đầy đủ"}
            </span>
          </button>

          <button
            type="button"
            onClick={toggleSound}
            aria-label={soundOn ? "Tắt âm thanh" : "Bật âm thanh"}
            className="grid size-11 place-items-center rounded-xl border border-white/15 bg-white/5 text-white hover:bg-white/10"
          >
            {soundOn ? <Volume2 className="size-4 text-emerald-400" /> : <VolumeX className="size-4 text-slate-400" />}
          </button>
        </div>
      </div>

      {/* Bảng Tỉ số Truyền hình (Broadcast Scoreboard HUD) */}
      <div className="grid gap-3 border-b border-emerald-500/20 bg-gradient-to-r from-[#07221b] via-[#0c382c] to-[#07221b] px-4 py-3 sm:grid-cols-3 sm:items-center sm:px-6">
        <div className="flex items-center justify-between gap-3 sm:justify-start">
          <div className="rounded-xl bg-emerald-500/20 px-3 py-1.5 text-left">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
              ĐỘI HỌC SINH
            </p>
            <p className="text-2xl font-black text-white">{state.playerGoals}</p>
          </div>
          <span className="text-sm font-black text-amber-300">VS</span>
          <div className="rounded-xl bg-amber-500/20 px-3 py-1.5 text-right sm:text-left">
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-300">
              THỦ MÔN MÁY
            </p>
            <p className="text-2xl font-black text-white">{state.opponentGoals}</p>
          </div>
        </div>

        {/* 5 đèn lượt sút */}
        <div className="flex flex-col items-center justify-center gap-1">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-200">
            Lượt sút {Math.min(state.currentRound + 1, state.totalRounds)} / {state.totalRounds} • Điểm: {state.score}
          </span>
          <div className="flex items-center gap-2" aria-label="Tiến trình 5 lượt sút">
            {Array.from({ length: state.totalRounds }, (_, idx) => {
              const rec = state.history[idx];
              const isCurrent = idx === state.currentRound && state.phase !== "match_finished";
              return (
                <span
                  key={idx}
                  className={`flex size-7 items-center justify-center rounded-full border text-xs font-black ${
                    rec
                      ? rec.scored
                        ? "border-emerald-300 bg-emerald-500 text-slate-950"
                        : "border-red-300 bg-red-600 text-white"
                      : isCurrent
                        ? "border-amber-300 bg-amber-400 text-slate-950"
                        : "border-white/25 bg-white/10 text-slate-300"
                  }`}
                >
                  {rec ? (rec.scored ? "✓" : "✕") : idx + 1}
                </span>
              );
            })}
          </div>
        </div>

        {/* Thanh Nạp lực Cú sút (Shot Power Meter) */}
        <div className="flex flex-col items-end justify-center">
          <div className="flex w-full max-w-xs items-center justify-between text-xs font-extrabold">
            <span className="flex items-center gap-1 text-amber-300">
              <Flame className="size-4" />
              Lực sút Địa lí:
            </span>
            <span>
              {state.lastQuizCorrect === null
                ? "Trả lời câu hỏi để nạp lực"
                : state.lastQuizCorrect
                  ? "100% CÚ SÚT VÀNG UY LỰC!"
                  : "45% Cú sút giảm lực"}
            </span>
          </div>
          <div className="mt-1.5 h-3 w-full max-w-xs overflow-hidden rounded-full border border-white/20 bg-slate-950">
            <div
              className={`h-full transition-all duration-300 ${
                state.lastQuizCorrect === null
                  ? "w-1/4 bg-slate-500"
                  : state.lastQuizCorrect
                    ? "w-full bg-gradient-to-r from-amber-400 via-yellow-300 to-emerald-400"
                    : "w-[45%] bg-red-500"
              }`}
            />
          </div>
        </div>
      </div>

      {/* TRỌNG TÂM TRẢI NGHIỆM: SÂN VẬN ĐỘNG & KHUNG THÀNH TƯƠNG TÁC LỚN */}
      <div className="p-4 sm:p-6">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border-2 border-emerald-400/35 bg-[#052e16] shadow-2xl">
          <svg
            viewBox="0 0 800 360"
            className="h-[270px] w-full sm:h-[360px]"
            role="img"
            aria-label="Sân vận động Địa lí 10 — Khung thành 5 góc sút, Thủ môn và Cầu thủ"
          >
            <defs>
              <linearGradient id="stadiumSkyV2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#020617" />
                <stop offset="55%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#064e3b" />
              </linearGradient>
              <linearGradient id="turfPitchV2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#065f46" />
                <stop offset="50%" stopColor="#047857" />
                <stop offset="100%" stopColor="#064e3b" />
              </linearGradient>
              <pattern id="goalNetPatternV2" width="16" height="16" patternUnits="userSpaceOnUse">
                <path
                  d="M 16 0 L 0 0 0 16"
                  fill="none"
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth="1.2"
                />
              </pattern>
            </defs>

            {/* Bầu trời & Đèn pha sân vận động */}
            <rect x="0" y="0" width="800" height="215" fill="url(#stadiumSkyV2)" />
            <polygon points="90,0 260,215 360,215 150,0" fill="#38bdf8" opacity="0.1" />
            <polygon points="710,0 540,215 440,215 650,0" fill="#facc15" opacity="0.1" />

            {/* Khán đài cổ vũ & Biển quảng cáo */}
            <rect x="0" y="168" width="800" height="47" fill="#0f172a" />
            <rect x="30" y="182" width="210" height="22" rx="4" fill="#1d4ed8" />
            <text x="135" y="197" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="900">
              WEBSTUDY • ĐỊA LÍ 10
            </text>
            <rect x="560" y="182" width="210" height="22" rx="4" fill="#b45309" />
            <text x="665" y="197" textAnchor="middle" fill="#fef3c7" fontSize="11" fontWeight="900">
              LOẠT SÚT LUÂN LƯU 5 LƯỢT
            </text>

            {/* Mặt cỏ sân vận động với các dải cỏ đan xen */}
            <rect x="0" y="210" width="800" height="150" fill="url(#turfPitchV2)" />
            <polygon points="0,235 800,235 800,265 0,265" fill="#059669" opacity="0.25" />
            <polygon points="0,295 800,295 800,325 0,325" fill="#059669" opacity="0.25" />

            {/* Vạch vôi vòng cấm địa phối cảnh 3D */}
            <line x1="0" y1="212" x2="800" y2="212" stroke="#ffffff" strokeWidth="3.5" />
            <polygon
              points="150,212 650,212 760,360 40,360"
              fill="none"
              stroke="rgba(255,255,255,0.45)"
              strokeWidth="2.5"
            />

            {/* Khung thành 3D & Lưới */}
            <polygon points="195,68 215,86 215,212 195,212" fill="url(#goalNetPatternV2)" stroke="rgba(255,255,255,0.35)" />
            <polygon points="605,68 585,86 585,212 605,212" fill="url(#goalNetPatternV2)" stroke="rgba(255,255,255,0.35)" />
            <rect
              x="195"
              y="68"
              width="410"
              height="144"
              fill="url(#goalNetPatternV2)"
              stroke="#ffffff"
              strokeWidth="8"
              rx="4"
            />

            {/* 5 Hồng tâm góc sút trực tiếp trên khung thành khi ở pha "aiming" */}
            {GOAL_ZONES.map((zone) => {
              const pos = ZONE_SVG_COORDS[zone.id];
              const isHovered = hoveredZone === zone.id;
              const isAiming = state.phase === "aiming";
              return (
                <g
                  key={zone.id}
                  onClick={() => {
                    if (isAiming) handleShoot(zone.id);
                  }}
                  onMouseEnter={() => setHoveredZone(zone.id)}
                  onMouseLeave={() => setHoveredZone(null)}
                  className={isAiming ? "cursor-pointer" : ""}
                >
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={isAiming ? (isHovered ? 32 : 27) : 18}
                    fill={
                      isAiming
                        ? isHovered
                          ? "rgba(250, 204, 21, 0.45)"
                          : "rgba(16, 185, 129, 0.28)"
                        : "rgba(255, 255, 255, 0.08)"
                    }
                    stroke={isAiming ? (isHovered ? "#fde047" : "#34d399") : "rgba(255,255,255,0.22)"}
                    strokeWidth={isAiming ? "3" : "1.5"}
                    strokeDasharray={isAiming && !isHovered ? "5 3" : undefined}
                  />
                  {isAiming && (
                    <text
                      x={pos.x}
                      y={pos.y + 4}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="11"
                      fontWeight="900"
                    >
                      {zone.shortLabel}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Nhân vật Thủ môn (Goalkeeper) có tay, găng tay, tư thế đổ người */}
            <g
              transform={`translate(${keeperCoords.x}, ${keeperCoords.y}) rotate(${keeperDiveRotation})`}
              className={reducedMotion ? "" : "transition-all duration-500 ease-out"}
            >
              {/* Bóng đổ dưới chân thủ môn */}
              <ellipse cx="0" cy="36" rx="26" ry="6" fill="rgba(0,0,0,0.4)" />
              {/* Chân & Quần */}
              <line x1="-8" y1="12" x2="-14" y2="34" stroke="#0f172a" strokeWidth="7" strokeLinecap="round" />
              <line x1="8" y1="12" x2="14" y2="34" stroke="#0f172a" strokeWidth="7" strokeLinecap="round" />
              {/* Thân áo thủ môn */}
              <rect x="-15" y="-14" width="30" height="28" rx="7" fill="#f59e0b" stroke="#0f172a" strokeWidth="2" />
              <text x="0" y="4" textAnchor="middle" fill="#0f172a" fontSize="11" fontWeight="900">
                GK
              </text>
              {/* Tay vươn bắt bóng & Găng tay */}
              <line x1="-15" y1="-6" x2="-36" y2="-20" stroke="#f59e0b" strokeWidth="6" strokeLinecap="round" />
              <line x1="15" y1="-6" x2="36" y2="-20" stroke="#f59e0b" strokeWidth="6" strokeLinecap="round" />
              <circle cx="-38" cy="-22" r="7" fill="#ffffff" stroke="#10b981" strokeWidth="2.5" />
              <circle cx="38" cy="-22" r="7" fill="#ffffff" stroke="#10b981" strokeWidth="2.5" />
              {/* Đầu thủ môn */}
              <circle cx="0" cy="-25" r="11" fill="#fde68a" stroke="#0f172a" strokeWidth="2" />
              <path d="M-11 -28 Q0 -38 11 -28" fill="#1e293b" />
            </g>

            {/* Đường quỹ đạo bóng bay khi sút */}
            {state.phase === "round_summary" && state.lastShotTarget && (
              <path
                d={`M 400 315 Q ${(400 + ballCoords.x) / 2} ${Math.min(180, ballCoords.y - 35)} ${ballCoords.x} ${ballCoords.y}`}
                fill="none"
                stroke={state.lastShotScored ? "#fde047" : "#f87171"}
                strokeWidth="4.5"
                strokeDasharray="8 5"
              />
            )}

            {/* Chấm phạt đền 11m */}
            <ellipse cx="400" cy="322" rx="14" ry="5" fill="#ffffff" opacity="0.85" />

            {/* Cầu thủ Học sinh thực hiện cú sút */}
            <g
              transform={
                state.phase === "round_summary"
                  ? "translate(352, 295) rotate(-14)"
                  : "translate(335, 302)"
              }
              className={reducedMotion ? "" : "transition-all duration-300"}
            >
              <ellipse cx="0" cy="36" rx="22" ry="6" fill="rgba(0,0,0,0.45)" />
              {/* Chân trụ & Chân sút */}
              <line x1="-6" y1="12" x2="-10" y2="34" stroke="#1e293b" strokeWidth="7" strokeLinecap="round" />
              <line
                x1="6"
                y1="12"
                x2={state.phase === "round_summary" ? "28" : "12"}
                y2={state.phase === "round_summary" ? "18" : "34"}
                stroke="#1e293b"
                strokeWidth="7"
                strokeLinecap="round"
              />
              {/* Áo đấu Đỏ sao vàng */}
              <rect x="-14" y="-14" width="28" height="28" rx="7" fill="#dc2626" stroke="#fef08a" strokeWidth="2" />
              <polygon points="0,-7 2,-1 8,-1 3,3 5,9 0,5 -5,9 -3,3 -8,-1 -2,-1" fill="#facc15" />
              {/* Đầu cầu thủ */}
              <circle cx="0" cy="-25" r="11" fill="#fde68a" stroke="#0f172a" strokeWidth="2" />
              <path d="M-11 -27 Q0 -37 11 -27" fill="#0f172a" />
            </g>

            {/* Quả bóng đá */}
            <g
              transform={`translate(${ballCoords.x}, ${ballCoords.y})`}
              className={reducedMotion ? "" : "transition-all duration-500 ease-out"}
            >
              <circle
                cx="0"
                cy="0"
                r={state.phase === "round_summary" ? "13" : "15"}
                fill="#ffffff"
                stroke="#0f172a"
                strokeWidth="2.5"
              />
              <polygon points="0,-7 6,-2 4,6 -4,6 -6,-2" fill="#0f172a" />
              {state.lastQuizCorrect && state.phase === "aiming" && (
                <circle
                  cx="0"
                  cy="0"
                  r="21"
                  fill="none"
                  stroke="#facc15"
                  strokeWidth="2.5"
                  strokeDasharray="4 3"
                />
              )}
            </g>
          </svg>

          {/* Thanh trạng thái ngay dưới khung thành */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#031b10] px-4 py-2.5 text-xs">
            <span className="font-bold text-emerald-200">
              {state.phase === "question" &&
                "Bước 1: Trả lời câu hỏi Địa lí bên dưới để nạp lực sút cho cầu thủ."}
              {state.phase === "aiming" &&
                "Bước 2: Bấm trực tiếp vào 1 trong 5 góc khung thành trên sân (hoặc chọn nút bên dưới) để sút bóng!"}
              {state.phase === "round_summary" &&
                (state.lastShotScored
                  ? "⚽ VÀOOO! Cú sút hiểm hóc đánh bại hoàn toàn thủ môn!"
                  : "🧤 CẢN PHÁ! Thủ môn đối phương đã đoán trúng hướng bóng.")}
              {state.phase === "match_finished" && "🏁 Loạt sút luân lưu 5 lượt đã kết thúc!"}
            </span>
            {currentQuestionChapter && (
              <span className="rounded-full bg-emerald-500/20 px-3 py-0.5 font-extrabold text-emerald-300">
                Chương {currentQuestionChapter.number}: {currentQuestionChapter.title}
              </span>
            )}
          </div>
        </div>

        {/* BẢNG TƯƠNG TÁC THEO TỪNG PHA (Câu hỏi / Chọn góc sút / Kết quả lượt / Kết thúc trận) */}
        <div className="mx-auto mt-5 max-w-4xl">
          {state.phase === "question" && currentQuestion && (
            <div className="space-y-4 rounded-2xl border border-white/15 bg-[#0a271f] p-5 shadow-lg sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-extrabold uppercase text-amber-300">
                  <Sparkles className="size-3.5" />
                  Thử thách nạp lực sút lượt {state.currentRound + 1} / {state.totalRounds}
                </span>
                <span className="text-xs text-slate-300">
                  Trả lời ĐÚNG = Mở khóa Cú sút Vàng (85% ghi bàn +150 đ)
                </span>
              </div>

              <h2 className="text-base font-extrabold leading-relaxed text-white sm:text-lg">
                {currentQuestion.content}
              </h2>

              <div className="grid gap-3 sm:grid-cols-2">
                {currentQuestion.options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleAnswer(opt.id)}
                    className="flex min-h-14 items-center gap-3 rounded-xl border border-white/15 bg-[#061814] p-3.5 text-left text-sm font-semibold text-white transition hover:border-emerald-400 hover:bg-emerald-950/60"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-500/20 font-extrabold text-emerald-300">
                      {opt.id}
                    </span>
                    <span className="flex-1">{opt.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {state.phase === "aiming" && currentQuestion && (
            <div className="space-y-4 rounded-2xl border-2 border-amber-400/50 bg-[#0a271f] p-5 shadow-lg sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {state.lastQuizCorrect ? (
                    <>
                      <CheckCircle2 className="size-5 text-emerald-400" />
                      <span className="text-sm font-extrabold text-emerald-300">
                        Chính xác (+100 đ)! Cầu thủ đã nạp 100% Cú sút Vàng uy lực!
                      </span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="size-5 text-amber-400" />
                      <span className="text-sm font-extrabold text-amber-300">
                        Chưa đúng (Đáp án: {currentQuestion.correctOptionId}). Bạn vẫn được sút nhưng lực bóng giảm!
                      </span>
                    </>
                  )}
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-200">
                  <Crosshair className="size-4" />
                  Chọn góc dứt điểm
                </span>
              </div>

              <p className="text-xs leading-relaxed text-slate-200">
                <strong className="text-white">Giải thích nhanh:</strong> {currentQuestion.explanation}
              </p>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                {GOAL_ZONES.map((zone) => (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => handleShoot(zone.id)}
                    onMouseEnter={() => setHoveredZone(zone.id)}
                    onMouseLeave={() => setHoveredZone(null)}
                    className="flex min-h-14 flex-col items-center justify-center rounded-xl border-2 border-emerald-400/50 bg-emerald-500/20 px-3 py-2 text-xs font-extrabold text-white transition hover:border-amber-300 hover:bg-amber-400 hover:text-slate-950"
                  >
                    <span>⚽ Sút {zone.shortLabel}</span>
                    <span className="mt-0.5 text-[10px] opacity-80">{zone.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {state.phase === "round_summary" && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/15 bg-[#0a271f] p-5 shadow-lg">
              <div className="space-y-1">
                <p className="flex items-center gap-2 text-lg font-black">
                  {state.lastShotScored ? (
                    <>
                      <CheckCircle2 className="size-6 text-emerald-400" />
                      <span className="text-emerald-300">
                        VÀOOO! Bạn đã ghi bàn ở góc{" "}
                        {GOAL_ZONES.find((z) => z.id === state.lastShotTarget)?.label}!
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="size-6 text-red-400" />
                      <span className="text-red-300">
                        CẢN PHÁ! Thủ môn máy đã đổ người đúng góc{" "}
                        {GOAL_ZONES.find((z) => z.id === state.lastKeeperDive)?.label}.
                      </span>
                    </>
                  )}
                </p>
                <p className="text-xs text-slate-300">
                  Lượt đáp trả của đối thủ máy:{" "}
                  <strong className="text-white">
                    {state.lastOpponentScored
                      ? "Đối thủ ghi bàn (+1)"
                      : "Thủ môn đội bạn xuất sắc cản phá thành công!"}
                  </strong>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setState((prev) => advancePenaltyRound(prev))}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-amber-400 px-6 text-sm font-black text-slate-950 transition hover:bg-amber-300"
              >
                {state.currentRound + 1 >= state.totalRounds
                  ? "Xem kết quả chung cuộc ➔"
                  : "Sang lượt sút tiếp theo ➔"}
              </button>
            </div>
          )}

          {state.phase === "match_finished" && (
            <div className="rounded-3xl border-2 border-amber-400/50 bg-[#0a271f] p-8 text-center shadow-xl">
              <Trophy className="mx-auto size-14 text-amber-400" />
              <h2 className="mt-3 text-2xl font-extrabold text-white sm:text-3xl">
                {state.playerGoals > state.opponentGoals
                  ? "CHIẾN THẮNG LOẠT SÚT LUÂN LƯU!"
                  : state.playerGoals === state.opponentGoals
                    ? "TRẬN ĐẤU KẾT THÚC HÒA KỊCH TÍNH!"
                    : "TIẾC QUÁ! HÃY THỬ SỨC LẠI NHÉ!"}
              </h2>
              <p className="mt-2 text-base font-bold text-emerald-300">
                Tỉ số bàn thắng: Học sinh {state.playerGoals} – {state.opponentGoals} Máy • Tổng điểm:{" "}
                {state.score.toLocaleString("vi-VN")} điểm
              </p>
              <p className="mt-1 text-xs text-slate-300">
                Trả lời đúng {state.correctQuizCount}/{state.totalRounds} câu hỏi Địa lí 10.
              </p>

              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => handleRestart(chapterId)}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-emerald-500 px-6 text-sm font-extrabold text-white hover:bg-emerald-400"
                >
                  <RotateCcw className="size-4" />
                  Đá lại trận mới
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 text-sm font-bold text-white hover:bg-white/10"
                >
                  Về Trung tâm Game
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
