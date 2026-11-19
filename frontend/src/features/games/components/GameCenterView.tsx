import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Award,
  Box,
  CheckCircle2,
  CircleDot,
  Compass,
  Filter,
  Flame,
  Gamepad2,
  History,
  Images,
  Info,
  Play,
  Sparkles,
  Trash2,
  Trophy,
} from "lucide-react";
import Dialog from "../../../components/common/Dialog";
import ContourBackground from "../../../components/common/ContourBackground";
import { geo10Chapters } from "../../../data/geo10Curriculum";
import {
  GAME_CATALOG,
  filterPuzzlesByChapter,
  filterQuestionsByChapter,
} from "../data/geo10GameQuestions";
import type { GameId, GameMetadata, GameProgressMap } from "../types";

function GameArtworkBanner({ gameId }: { gameId: GameId }) {
  switch (gameId) {
    case "millionaire":
      return (
        <div className="relative h-36 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e1040] via-[#311b6e] to-[#0f172a] p-4 text-white">
          <svg viewBox="0 0 320 120" className="absolute inset-0 h-full w-full opacity-90" aria-hidden="true">
            <polygon points="40,0 110,120 160,120 80,0" fill="#a855f7" opacity="0.18" />
            <polygon points="280,0 210,120 160,120 240,0" fill="#38bdf8" opacity="0.18" />
            <circle cx="160" cy="60" r="38" fill="#4c1d95" stroke="#f59e0b" strokeWidth="3" />
            <circle cx="160" cy="60" r="28" fill="none" stroke="#c084fc" strokeWidth="1.5" strokeDasharray="4 3" />
            <polygon points="160,34 167,50 184,52 171,63 175,80 160,71 145,80 149,63 136,52 153,50" fill="#facc15" />
            <rect x="18" y="22" width="58" height="18" rx="9" fill="#7c3aed" stroke="#ddd6fe" strokeWidth="1.5" />
            <text x="47" y="34" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="900">50 : 50</text>
            <rect x="244" y="22" width="58" height="18" rx="9" fill="#d97706" stroke="#fef3c7" strokeWidth="1.5" />
            <text x="273" y="34" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="900">150 TRIỆU</text>
          </svg>
          <div className="relative z-10 flex h-full items-end justify-between">
            <span className="rounded-lg bg-black/45 px-2.5 py-1 text-[11px] font-extrabold text-amber-300 backdrop-blur-sm">
              Sân khấu Gameshow • 4 Trợ giúp
            </span>
            <Trophy className="size-6 text-amber-300 drop-shadow" />
          </div>
        </div>
      );

    case "word-catch":
      return (
        <div className="relative h-36 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#083344] via-[#0e7490] to-[#0f172a] p-4 text-white">
          <svg viewBox="0 0 320 120" className="absolute inset-0 h-full w-full opacity-95" aria-hidden="true">
            <rect x="34" y="18" width="96" height="62" rx="12" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
            <circle cx="66" cy="48" r="14" fill="#facc15" />
            <path d="M78 64 L96 38 L114 64 Z" fill="#10b981" />
            <circle cx="160" cy="49" r="14" fill="#f59e0b" />
            <text x="160" y="55" textAnchor="middle" fill="#0f172a" fontSize="18" fontWeight="900">+</text>
            <rect x="190" y="18" width="96" height="62" rx="12" fill="#0f172a" stroke="#22d3ee" strokeWidth="2" />
            <path d="M214 58 Q238 30 264 58" fill="none" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
            <circle cx="238" cy="44" r="10" fill="#a855f7" />
          </svg>
          <div className="relative z-10 flex h-full items-end justify-between">
            <span className="rounded-lg bg-black/45 px-2.5 py-1 text-[11px] font-extrabold text-cyan-200 backdrop-blur-sm">
              28 Câu đố Liên tưởng 2 Mảnh ghép
            </span>
            <Images className="size-6 text-cyan-200 drop-shadow" />
          </div>
        </div>
      );

    case "penalty-quiz":
      return (
        <div className="relative h-36 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#064e3b] via-[#047857] to-[#052e16] p-4 text-white">
          <svg viewBox="0 0 320 120" className="absolute inset-0 h-full w-full opacity-95" aria-hidden="true">
            <rect x="64" y="14" width="192" height="68" fill="none" stroke="#ffffff" strokeWidth="4" rx="4" />
            <line x1="20" y1="82" x2="300" y2="82" stroke="#86efac" strokeWidth="2" />
            <circle cx="96" cy="36" r="10" fill="#facc15" opacity="0.85" />
            <circle cx="224" cy="36" r="10" fill="#38bdf8" opacity="0.85" />
            <path d="M160 104 Q190 66 220 38" fill="none" stroke="#fde047" strokeWidth="3.5" strokeDasharray="5 4" />
            <circle cx="160" cy="100" r="12" fill="#ffffff" stroke="#0f172a" strokeWidth="2.5" />
          </svg>
          <div className="relative z-10 flex h-full items-end justify-between">
            <span className="rounded-lg bg-black/45 px-2.5 py-1 text-[11px] font-extrabold text-emerald-200 backdrop-blur-sm">
              Sân bóng Tương tác • Nạp lực Cú sút Vàng
            </span>
            <CircleDot className="size-6 text-emerald-200 drop-shadow" />
          </div>
        </div>
      );

    case "o-an-quan":
      return (
        <div className="relative h-36 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#7c2d12] via-[#b45309] to-[#451a03] p-4 text-white">
          <svg viewBox="0 0 320 120" className="absolute inset-0 h-full w-full opacity-95" aria-hidden="true">
            <rect x="34" y="20" width="252" height="66" rx="33" fill="#fef3c7" fillOpacity="0.14" stroke="#fcd34d" strokeWidth="2.5" />
            <line x1="84" y1="20" x2="84" y2="86" stroke="#fcd34d" strokeWidth="2" />
            <line x1="236" y1="20" x2="236" y2="86" stroke="#fcd34d" strokeWidth="2" />
            <line x1="84" y1="53" x2="236" y2="53" stroke="#fcd34d" strokeWidth="2" />
            <circle cx="58" cy="53" r="13" fill="#f59e0b" stroke="#fef3c7" strokeWidth="2" />
            <circle cx="262" cy="53" r="13" fill="#10b981" stroke="#d1fae5" strokeWidth="2" />
            {[104, 134, 164, 194, 218].map((x) => (
              <circle key={x} cx={x} cy="37" r="5" fill="#fde68a" />
            ))}
            {[104, 134, 164, 194, 218].map((x) => (
              <circle key={`b-${x}`} cx={x} cy="69" r="5" fill="#fed7aa" />
            ))}
          </svg>
          <div className="relative z-10 flex h-full items-end justify-between">
            <span className="rounded-lg bg-black/45 px-2.5 py-1 text-[11px] font-extrabold text-amber-200 backdrop-blur-sm">
              Rải quân Từng bước • Cố vấn Địa lí
            </span>
            <Compass className="size-6 text-amber-200 drop-shadow" />
          </div>
        </div>
      );
  }
}

export function GameCenterView({
  progress,
  selectedChapterId,
  onSelectChapterId,
  onLaunchGame,
  onClearHistory,
}: {
  progress: GameProgressMap;
  selectedChapterId: string;
  onSelectChapterId: (chapterId: string) => void;
  onLaunchGame: (gameId: GameId) => void;
  onClearHistory: () => void;
}) {
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [rulesGame, setRulesGame] = useState<GameMetadata | null>(null);

  const allHistory = Object.values(progress)
    .flatMap((entry) => entry.recentHistory)
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));

  const totalGamesPlayed = Object.values(progress).reduce((s, e) => s + e.gamesPlayed, 0);
  const totalWins = Object.values(progress).reduce((s, e) => s + e.wins, 0);
  const exploredGamesCount = Object.values(progress).filter((e) => e.gamesPlayed > 0).length;

  const rankTitle =
    totalWins >= 10
      ? "Đại Kiện tướng Địa lí 10"
      : totalWins >= 5
        ? "Chuyên gia Địa cầu"
        : totalGamesPlayed >= 2
          ? "Nhà Thám hiểm Trẻ"
          : "Tân binh Địa lí 10";

  const chapterQuestionsCount = filterQuestionsByChapter(selectedChapterId).length;
  const chapterPuzzlesCount = filterPuzzlesByChapter(selectedChapterId).length;
  const selectedChapterObj = geo10Chapters.find((c) => c.id === selectedChapterId);

  return (
    <div className="space-y-8" data-testid="game-center-view">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-[#0f1e36] px-6 py-4 text-white shadow-card sm:px-8 sm:py-5">
        <ContourBackground className="absolute inset-0 h-full w-full opacity-15" />
        <div className="relative z-10 grid gap-4 lg:grid-cols-[1.35fr_1fr] lg:items-center">
          <div className="space-y-2">
            <div className="hidden items-center gap-2 rounded-[20px] bg-[#f59e0b] px-4 py-1.5 sm:inline-flex">
              <Sparkles className="size-3.5 text-[#0f1e36]" />
              <span className="text-xs font-extrabold uppercase tracking-wide text-[#0f1e36]">
                HỌC MÀ CHƠI - CHƠI MÀ HỌC • PHIÊN BẢN V2
              </span>
            </div>
            <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">
              Trung Tâm Trò Chơi Địa Lý 10
            </h1>
            <p className="text-sm leading-relaxed text-slate-200 sm:text-base">
              Chinh phục <strong>{filterQuestionsByChapter("all").length} câu trắc nghiệm</strong> và <strong>{filterPuzzlesByChapter("all").length} câu đố hình</strong> qua 13 chương Địa lí 10.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/student/3d-lab"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-5 text-xs font-bold text-white transition hover:bg-emerald-500/30 sm:text-sm"
              >
                <Box className="size-4 text-emerald-300" />
                Mô hình 3D ➔
              </Link>
              <button
                type="button"
                onClick={() => setHistoryModalOpen(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 text-xs font-bold text-white transition hover:bg-white/20 sm:text-sm"
              >
                <History className="size-4 text-amber-300" />
                Nhật ký ({allHistory.length})
              </button>
            </div>
          </div>

          {/* Bảng Thành tựu & Tiến độ Khám phá */}
          <details className="rounded-xl border border-white/15 bg-white/10 p-3 text-sm sm:hidden">
            <summary className="cursor-pointer font-bold">Thành tích khám phá · {exploredGamesCount}/4 trò chơi</summary>
            <p className="mt-2">{rankTitle} · {allHistory.length} lượt chơi</p>
          </details>
          <div className="hidden rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-md sm:block">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-400/20 text-amber-300">
                  <Award className="size-7" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                    Danh hiệu Khám phá trên thiết bị
                  </p>
                  <p className="text-base font-extrabold text-white">{rankTitle}</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-500/25 px-3 py-1 text-xs font-extrabold text-emerald-200">
                {exploredGamesCount}/4 trò chơi
              </span>
            </div>

            <div className="mt-2">
              <div className="mb-1.5 flex items-center justify-between text-xs text-slate-200">
                <span>Tiến độ trải nghiệm 4 trò chơi</span>
                <span className="font-bold text-amber-300">{Math.round((exploredGamesCount / 4) * 100)}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-900/70">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-500"
                  style={{ width: `${Math.max(8, (exploredGamesCount / 4) * 100)}%` }}
                />
              </div>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-950/45 p-2.5">
                <p className="text-[11px] text-slate-300">Tổng lượt chơi</p>
                <p className="mt-0.5 text-base font-black text-white">{totalGamesPlayed}</p>
              </div>
              <div className="rounded-xl bg-slate-950/45 p-2.5">
                <p className="text-[11px] text-slate-300">Chiến thắng</p>
                <p className="mt-0.5 text-base font-black text-emerald-300">{totalWins}</p>
              </div>
              <div className="rounded-xl bg-slate-950/45 p-2.5">
                <p className="text-[11px] text-slate-300">Kho câu hỏi</p>
                <p className="mt-0.5 text-base font-black text-amber-300">{filterQuestionsByChapter("all").length + filterPuzzlesByChapter("all").length} câu</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bộ lọc Chương học minh bạch (không âm thầm trộn chương) */}
      <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-emerald" />
              <h2 className="text-lg font-extrabold text-ink sm:text-xl">
                Chọn phạm vi kiến thức Địa lí 10
              </h2>
            </div>
            <p className="text-xs text-secondary sm:text-sm">
              {selectedChapterObj ? (
                <>
                  Đang lọc chuyên biệt <strong>Chương {selectedChapterObj.number}: {selectedChapterObj.title}</strong> —{" "}
                  <span className="font-bold text-emerald-700">
                    {chapterQuestionsCount} câu trắc nghiệm & {chapterPuzzlesCount} câu đố hình
                  </span>{" "}
                  (Cam kết chỉ lấy đúng câu thuộc chương này, không tự ý trộn chương khác).
                </>
              ) : (
                <>
                  Đang chọn <strong>Toàn bộ chương trình Địa lí 10 (13 chương)</strong> — sẵn sàng{" "}
                  <span className="font-bold text-emerald-700">
                    {chapterQuestionsCount} câu trắc nghiệm & {chapterPuzzlesCount} câu đố hình ảnh
                  </span>.
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="sr-only" htmlFor="game-center-chapter-filter">
              Lọc nội dung theo chương Địa lí 10
            </label>
            <select
              id="game-center-chapter-filter"
              value={selectedChapterId}
              onChange={(e) => onSelectChapterId(e.target.value)}
              className="min-h-11 w-full min-w-0 max-w-full rounded-xl border border-line bg-canvas px-4 text-xs font-bold text-ink shadow-sm sm:w-auto sm:text-sm"
            >
              <option value="all">Tất cả 13 chương Địa lí 10 ({filterQuestionsByChapter("all").length} câu TN • {filterPuzzlesByChapter("all").length} câu đố)</option>
              {geo10Chapters.map((c) => {
                const qCount = filterQuestionsByChapter(c.id).length;
                const pCount = filterPuzzlesByChapter(c.id).length;
                return (
                  <option key={c.id} value={c.id}>
                    Chương {c.number}: {c.title} ({qCount} câu TN • {pCount} câu đố)
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </section>

      {/* Lưới 4 trò chơi với Artwork V2 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-ink sm:text-2xl">
            Danh sách trò chơi tương tác (4)
          </h2>
          <span className="hidden items-center gap-1.5 text-xs font-bold text-secondary sm:inline-flex">
            <Flame className="size-4 text-amber-500" />
            Hỗ trợ đầy đủ Máy tính, Điện thoại & Phím tắt
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {GAME_CATALOG.map((game) => {
            const stats = progress[game.id];
            const hasPlayed = stats.gamesPlayed > 0;

            return (
              <article
                key={game.id}
                data-testid={`game-card-${game.id}`}
                className="group flex flex-col justify-between gap-5 rounded-[24px] border border-line bg-white p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 sm:p-6"
              >
                <div className="space-y-4">
                  {/* Artwork Thumbnail */}
                  <GameArtworkBanner gameId={game.id} />

                  {/* Tiêu đề & Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-extrabold text-ink sm:text-xl">
                          {game.title}
                        </h3>
                        {stats.wins > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-700">
                            <CheckCircle2 className="size-3.5" />
                            Đã thắng {stats.wins} lần
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-secondary sm:text-sm">
                        {game.description}
                      </p>
                    </div>

                    <span
                      className="shrink-0 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider"
                      style={{
                        backgroundColor: game.accentBg,
                        color: game.accentColor,
                      }}
                    >
                      {game.badge}
                    </span>
                  </div>

                  {/* Thống kê kỷ lục cá nhân trên thiết bị */}
                  <div className="grid grid-cols-3 gap-2 rounded-2xl bg-canvas p-3 text-xs">
                    <div>
                      <span className="text-secondary">Quy mô ván:</span>
                      <p className="mt-0.5 font-extrabold text-ink">
                        {selectedChapterId === "all"
                          ? game.questionCountLabel
                          : game.id === "word-catch"
                            ? `${chapterPuzzlesCount} câu đố chương`
                            : game.id === "millionaire"
                              ? `${Math.min(15, Math.max(1, chapterQuestionsCount - 1))} câu chương`
                              : `${Math.min(5, chapterQuestionsCount)} câu chương`}
                      </p>
                    </div>
                    <div>
                      <span className="text-secondary">Kỷ lục thiết bị:</span>
                      <p
                        className="mt-0.5 font-extrabold"
                        style={{ color: game.accentColor }}
                      >
                        {stats.highScore.toLocaleString("vi-VN")} điểm
                      </p>
                    </div>
                    <div>
                      <span className="text-secondary">Trạng thái:</span>
                      <p className="mt-0.5 font-bold text-ink">
                        {hasPlayed ? `Đã chơi ${stats.gamesPlayed} lượt` : "Sẵn sàng khám phá"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Hàng nút hành động */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onLaunchGame(game.id)}
                    className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-sm font-extrabold text-white shadow-sm transition ${game.buttonBg}`}
                  >
                    <Play className="size-4 fill-current" />
                    Chơi ngay
                  </button>

                  <button
                    type="button"
                    onClick={() => setRulesGame(game)}
                    aria-label={`Hướng dẫn luật chơi ${game.title}`}
                    className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-4 text-xs font-bold text-ink transition hover:bg-canvas sm:text-sm"
                  >
                    <Info className="size-4 text-secondary" />
                    <span>Hướng dẫn</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Ghi chú minh bạch về điểm giải trí */}
      <aside className="rounded-2xl border border-line bg-white p-5 text-xs leading-relaxed text-secondary shadow-card sm:text-sm">
        <div className="flex items-start gap-3">
          <Gamepad2 className="mt-0.5 size-5 shrink-0 text-emerald" />
          <div>
            <p className="font-bold text-ink">
              Lưu ý về kỷ lục giải trí và bộ câu hỏi tự luyện Địa lí 10
            </p>
            <p className="mt-1">
              Điểm số và danh hiệu trong Trung tâm Trò chơi được lưu cục bộ trên trình duyệt của bạn nhằm mục đích
              khuyến khích tự ôn tập, <strong>không thay thế điểm bài tập hay bài kiểm tra chính thức</strong> trên lớp.
            </p>
          </div>
        </div>
      </aside>

      {/* Modal Hướng dẫn luật chơi */}
      {rulesGame && (
        <Dialog title={rulesGame.title} onClose={() => setRulesGame(null)}>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span
                className="rounded-full px-3 py-1 text-xs font-extrabold uppercase"
                style={{
                  backgroundColor: rulesGame.accentBg,
                  color: rulesGame.accentColor,
                }}
              >
                Luật chơi & Mẹo chiến thắng
              </span>
            </div>

            <p className="text-sm text-secondary">{rulesGame.description}</p>

            <ul className="space-y-2.5 rounded-2xl bg-canvas p-4 text-sm text-ink">
              {rulesGame.rulesSummary.map((rule, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span
                    className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-xs font-extrabold text-white"
                    style={{ backgroundColor: rulesGame.accentColor }}
                  >
                    {idx + 1}
                  </span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRulesGame(null)}
                className="min-h-11 rounded-xl border border-line px-4 text-sm font-bold text-secondary hover:bg-canvas"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = rulesGame.id;
                  setRulesGame(null);
                  onLaunchGame(target);
                }}
                className={`min-h-11 rounded-xl px-5 text-sm font-extrabold text-white ${rulesGame.buttonBg}`}
              >
                Vào chơi ngay ➔
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Modal Lịch sử & Kỷ lục trên thiết bị */}
      {historyModalOpen && (
        <Dialog
          title="Lịch sử chơi gần đây trên thiết bị"
          onClose={() => setHistoryModalOpen(false)}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {allHistory.length > 0 && (
                <button
                  type="button"
                  onClick={onClearHistory}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 hover:bg-red-100"
                >
                  <Trash2 className="size-3.5" />
                  Xóa lịch sử thiết bị
                </button>
              )}
            </div>

            {allHistory.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-canvas p-8 text-center">
                <p className="text-sm font-bold text-ink">Chưa có lượt chơi nào được lưu</p>
                <p className="mt-1 text-xs text-secondary">
                  Hãy hoàn thành một ván chơi bất kỳ để ghi nhận kỷ lục đầu tiên của bạn!
                </p>
              </div>
            ) : (
              <div className="max-h-80 space-y-2.5 overflow-y-auto pr-1">
                {allHistory.slice(0, 20).map((item) => {
                  const meta = GAME_CATALOG.find((g) => g.id === item.gameId);
                  return (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-canvas px-4 py-3 text-xs sm:text-sm"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-ink">
                            {meta?.title ?? item.gameId}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                              item.won
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {item.won ? "Chiến thắng" : "Hoàn thành"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-secondary">{item.summary}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold text-emerald">
                          {item.score.toLocaleString("vi-VN")} điểm
                        </p>
                        <p className="text-[11px] text-secondary">
                          {new Date(item.completedAt).toLocaleString("vi-VN")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="min-h-11 rounded-xl bg-ink px-5 text-sm font-bold text-white"
              >
                Đóng
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
