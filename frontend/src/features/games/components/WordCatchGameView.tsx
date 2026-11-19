import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Eraser,
  Heart,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
} from "lucide-react";
import { geo10Chapters } from "../../../data/geo10Curriculum";
import { getChapterDeckAvailability } from "../data/geo10GameQuestions";
import {
  advanceWordCatchRound,
  clearUnlockedSlots,
  createWordCatchState,
  removeSlotLetter,
  revealHintLetter,
  selectLetterTile,
  skipWordCatchRound,
  submitWordCatchAnswer,
  typeCharacterIntoSlot,
  type WordCatchState,
} from "../engine/wordCatchEngine";
import { isGameSoundEnabled, playGameSound, setGameSoundEnabled } from "../gameSound";
import { WordPuzzleIllustration } from "./WordPuzzleIllustration";

export function WordCatchGameView({
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
  const [allowCrossChapter, setAllowCrossChapter] = useState(false);
  const [state, setState] = useState<WordCatchState>(() =>
    createWordCatchState(initialChapterId, 10, Math.random, {
      allowCrossChapterFallback: false,
    }),
  );
  const [soundOn, setSoundOn] = useState<boolean>(() => isGameSoundEnabled());
  const [resultRecorded, setResultRecorded] = useState(false);

  const currentPuzzle = state.puzzles[state.currentIndex];
  const availability = getChapterDeckAvailability(chapterId, 10, "word-catch");
  const usedTileIds = new Set(
    state.placements.filter((p) => p !== null).map((p) => p!.tileId),
  );

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setGameSoundEnabled(next);
  };

  // Hỗ trợ bàn phím trên máy tính (gõ chữ cái, Backspace, Enter)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
        return;
      }
      if (state.status === "playing") {
        if (event.key === "Enter") {
          event.preventDefault();
          setState((prev) => {
            const next = submitWordCatchAnswer(prev);
            if (next.status === "round_won") playGameSound("correct", soundOn);
            else if (next.lives < prev.lives) playGameSound("wrong", soundOn);
            return next;
          });
        } else if (event.key === "Backspace" || event.key.length === 1) {
          setState((prev) => typeCharacterIntoSlot(prev, event.key));
        }
      } else if (state.status === "round_won" && event.key === "Enter") {
        setState((prev) => advanceWordCatchRound(prev));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.status, soundOn]);

  // Lưu kỷ lục thiết bị khi hoàn thành hoặc hết mạng
  useEffect(() => {
    if (resultRecorded) return;
    if (state.status === "game_completed" || state.status === "game_over") {
      setResultRecorded(true);
      onRecordResult({
        score: state.score,
        maxScore: state.puzzles.length * 120,
        won: state.status === "game_completed" && state.roundsSolved > 0,
        summary: `Giải đúng ${state.roundsSolved}/${state.puzzles.length} từ khóa Địa lí 10.`,
        chapterId: state.chapterId !== "all" ? state.chapterId : undefined,
      });
    }
  }, [state, resultRecorded, onRecordResult]);

  const handleRestart = (
    nextChapterId = chapterId,
    nextAllowCrossChapter = allowCrossChapter,
  ) => {
    setChapterId(nextChapterId);
    setAllowCrossChapter(nextAllowCrossChapter);
    setResultRecorded(false);
    setState(
      createWordCatchState(nextChapterId, 10, Math.random, {
        allowCrossChapterFallback: nextAllowCrossChapter,
      }),
    );
  };

  return (
    <div
      className="overflow-hidden rounded-3xl border border-line bg-[#f8fafc] shadow-card"
      data-testid="word-catch-game-view"
    >
      {/* Stage Header (theo Figma 2:1621) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] bg-white px-4 py-4 sm:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-3 text-sm font-bold text-ink hover:bg-canvas"
          >
            <ArrowLeft className="size-4" />
            Quay lại
          </button>
          <h1 className="text-base font-extrabold text-[#0f1e36] sm:text-lg">
            Đuổi hình bắt chữ Địa lý
          </h1>
          <span className="rounded-xl bg-[#ecfeff] px-3 py-1 text-xs font-bold text-[#06b6d4]">
            Lượt {Math.min(state.currentIndex + 1, state.puzzles.length)}/{state.puzzles.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="sr-only" htmlFor="word-catch-chapter-select">
            Chọn chương Địa lí 10
          </label>
          <select
            id="word-catch-chapter-select"
            value={chapterId}
            onChange={(e) => handleRestart(e.target.value, false)}
            className="min-h-11 rounded-xl border border-line bg-canvas px-3 text-xs font-bold text-ink"
          >
            <option value="all">Tất cả chương Địa lí 10 (10 câu / ván)</option>
            {geo10Chapters.map((c) => (
              <option key={c.id} value={c.id}>
                Chương {c.number}: {c.title}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 text-sm font-bold text-[#0f1e36]">
            <Star className="size-4 fill-[#f59e0b] text-[#f59e0b]" />
            <span>Điểm: {state.score}</span>
          </div>

          <div className="flex items-center gap-2 text-sm font-bold text-[#0f1e36]">
            <Heart className="size-4 fill-red-500 text-red-500" />
            <span>
              Mạng: {state.lives}/{state.maxLives}
            </span>
          </div>

          <button
            type="button"
            onClick={toggleSound}
            aria-label={soundOn ? "Tắt âm thanh" : "Bật âm thanh"}
            className="grid size-11 place-items-center rounded-xl border border-line bg-white text-ink hover:bg-canvas"
          >
            {soundOn ? <Volume2 className="size-4 text-emerald" /> : <VolumeX className="size-4 text-slate-400" />}
          </button>
        </div>
      </div>

      {/* Thông báo minh bạch khi chọn 1 chương đơn lẻ */}
      {availability.isShortOfStandard && (
        <div
          role="region"
          aria-label="Chế độ câu đố theo chương"
          className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-200 bg-cyan-50 px-4 py-2.5 text-xs text-cyan-950 sm:px-8"
        >
          <p>
            <strong>{availability.chapterTitle}</strong> có{" "}
            <strong>{availability.availableCount} câu đố hình ảnh</strong>.{" "}
            {!allowCrossChapter
              ? `Đang chơi chế độ Chuyên đề (${state.puzzles.length} câu đố thuần 100% thuộc chương này, không trộn chương khác).`
              : "Đang bật chế độ mở rộng: ưu tiên câu đố thuộc chương đã chọn và bổ sung câu từ chương khác để đủ 10 lượt."}
          </p>
          <button
            type="button"
            onClick={() => handleRestart(chapterId, !allowCrossChapter)}
            className="rounded-lg border border-cyan-400 bg-white px-3 py-1 font-extrabold text-cyan-800 shadow-sm transition hover:bg-cyan-100"
          >
            {!allowCrossChapter
              ? "Mở rộng đủ 10 câu (kèm chương khác)"
              : `Chỉ chơi câu thuộc chương này (${availability.availableCount} câu)`}
          </button>
        </div>
      )}

      {/* Play Area (theo Figma 2:1633) */}
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-6 sm:px-8 sm:py-10">
        {state.status !== "game_completed" && state.status !== "game_over" && currentPuzzle ? (
          <>
            {/* Khung hình ảnh Địa lí 10 (theo Figma 2:1634) */}
            <div className="w-full space-y-2.5 rounded-[24px] border border-[#e2e8f0] bg-white p-3 shadow-sm sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-3 py-1 text-xs font-extrabold text-cyan-800">
                  {currentPuzzle.categoryLabel}
                </span>
                <span className="text-xs font-bold text-secondary">
                  Từ khóa gồm {state.letterCount} chữ cái
                </span>
              </div>
              <WordPuzzleIllustration
                kind={currentPuzzle.illustrationKind}
                puzzle={currentPuzzle}
              />
            </div>

            {/* Hộp Gợi ý màu vàng nhạt (theo Figma 2:1636) */}
            <div className="flex w-full items-start gap-3 rounded-[16px] bg-[#fef3c7] px-5 py-3.5 text-[#0f1e36]">
              <Lightbulb className="mt-0.5 size-5 shrink-0 text-[#d97706]" />
              <p className="text-sm font-bold leading-relaxed sm:text-[15px]">
                Gợi ý: {currentPuzzle.hint}
              </p>
            </div>

            {/* Dãy ô chữ ghép từ (theo Figma 2:1639) */}
            <div
              className="flex flex-wrap items-center justify-center gap-2"
              aria-label="Các ô chữ trả lời"
            >
              {state.tokens.map((token) => {
                if (token.kind === "space") {
                  return (
                    <div
                      key={`space-${token.tokenIndex}`}
                      aria-hidden="true"
                      className="h-12 w-4 sm:h-14 sm:w-6"
                    />
                  );
                }

                const placed = state.placements[token.slotIndex];
                const isFilled = Boolean(placed);
                return (
                  <button
                    key={`slot-${token.slotIndex}`}
                    type="button"
                    disabled={!isFilled || Boolean(placed?.lockedByHint) || state.status !== "playing"}
                    onClick={() => {
                      playGameSound("click", soundOn);
                      setState((prev) => removeSlotLetter(prev, token.slotIndex));
                    }}
                    aria-label={
                      placed
                        ? `Ô chữ ${token.slotIndex + 1}: ${placed.char}${
                            placed.lockedByHint ? " (đã khóa gợi ý)" : ", bấm để gỡ"
                          }`
                        : `Ô chữ ${token.slotIndex + 1}: trống`
                    }
                    className={`flex h-[50px] w-[42px] items-center justify-center rounded-[8px] border-2 text-xl font-extrabold transition sm:h-[56px] sm:w-[48px] sm:text-2xl ${
                      isFilled
                        ? "border-[#10b981] bg-[#ecfdf5] text-[#10b981]"
                        : "border-[#e2e8f0] bg-white text-[#0f1e36]"
                    }`}
                  >
                    {placed?.char ?? ""}
                  </button>
                );
              })}
            </div>

            {/* Thông báo phản hồi hoặc Giải thích khi giải đúng */}
            {state.feedbackMessage && (
              <div
                role="status"
                className={`w-full rounded-2xl border p-4 text-sm font-bold ${
                  state.status === "round_won"
                    ? "border-emerald bg-emerald/10 text-emerald-900"
                    : "border-amber-300 bg-amber-50 text-ink"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    {state.status === "round_won" && (
                      <CheckCircle2 className="size-5 text-emerald" />
                    )}
                    {state.feedbackMessage}
                  </span>

                  {state.status === "round_won" && (
                    <button
                      type="button"
                      onClick={() => setState((prev) => advanceWordCatchRound(prev))}
                      className="inline-flex min-h-11 items-center rounded-full bg-emerald px-5 text-sm font-extrabold text-white hover:bg-emerald-600"
                    >
                      Câu tiếp theo ➔
                    </button>
                  )}
                </div>

                {state.status === "round_won" && (
                  <p className="mt-2 font-normal leading-relaxed text-secondary">
                    <strong className="text-ink">Kiến thức Địa lí 10:</strong>{" "}
                    {currentPuzzle.explanation}
                  </p>
                )}
              </div>
            )}

            {/* Bảng chữ cái gợi ý (theo Figma 2:1662) */}
            {state.status === "playing" && (
              <div
                className="flex w-full flex-wrap items-center justify-center gap-2.5 rounded-[16px] border border-[#e2e8f0] bg-white p-4 sm:gap-3 sm:p-6"
                aria-label="Bảng chữ cái để chọn"
              >
                {state.tiles.map((tile) => {
                  const used = usedTileIds.has(tile.id);
                  return (
                    <button
                      key={tile.id}
                      type="button"
                      disabled={used}
                      onClick={() => {
                        playGameSound("click", soundOn);
                        setState((prev) => selectLetterTile(prev, tile.id));
                      }}
                      aria-label={`Chọn chữ ${tile.char}`}
                      className={`flex size-[44px] items-center justify-center rounded-[8px] border text-lg font-bold transition ${
                        used
                          ? "cursor-not-allowed border-slate-100 bg-slate-100 text-slate-300 opacity-40"
                          : "border-[#e2e8f0] bg-[#f8fafc] text-[#1e293b] hover:border-[#06b6d4] hover:bg-[#ecfeff] active:scale-95"
                      }`}
                    >
                      {tile.char}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Thanh công cụ trợ giúp & Nộp câu trả lời (theo Figma 2:1693) */}
            {state.status === "playing" && (
              <div className="flex w-full flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    playGameSound("lifeline", soundOn);
                    setState((prev) => revealHintLetter(prev));
                  }}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-[20px] border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 sm:text-sm"
                >
                  <Sparkles className="size-4 text-amber-600" />
                  Mở 1 chữ cái (-20đ)
                </button>

                <button
                  type="button"
                  onClick={() => setState((prev) => clearUnlockedSlots(prev))}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-[20px] border border-[#e2e8f0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] hover:bg-slate-50 sm:text-sm"
                >
                  <Eraser className="size-4" />
                  Xóa chữ đã điền
                </button>

                <button
                  type="button"
                  onClick={() => setState((prev) => skipWordCatchRound(prev))}
                  className="inline-flex min-h-11 items-center rounded-[20px] border border-[#e2e8f0] bg-white px-6 py-2.5 text-sm font-semibold text-[#475569] hover:bg-slate-50"
                >
                  Bỏ qua câu này
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setState((prev) => {
                      const next = submitWordCatchAnswer(prev);
                      if (next.status === "round_won") playGameSound("correct", soundOn);
                      else if (next.lives < prev.lives) playGameSound("wrong", soundOn);
                      return next;
                    });
                  }}
                  className="inline-flex min-h-11 items-center rounded-[20px] bg-[#06b6d4] px-8 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#0891b2]"
                >
                  Nộp câu trả lời
                </button>
              </div>
            )}
          </>
        ) : (
          /* Màn hình tổng kết ván chơi */
          <div className="w-full rounded-3xl border border-line bg-white p-8 text-center shadow-card">
            <h2 className="text-2xl font-extrabold text-ink">
              {state.status === "game_completed"
                ? "Hoàn thành Đuổi hình bắt chữ Địa lý!"
                : "Trò chơi kết thúc — Bạn đã hết mạng!"}
            </h2>
            <p className="mt-2 text-sm text-secondary">
              Bạn đã giải mã thành công{" "}
              <strong className="text-ink">
                {state.roundsSolved}/{state.puzzles.length}
              </strong>{" "}
              thuật ngữ Địa lí 10.
            </p>
            {state.feedbackMessage && (
              <p className="mt-2 text-sm font-semibold text-red-600">
                {state.feedbackMessage}
              </p>
            )}
            <div className="mx-auto mt-6 max-w-xs rounded-2xl border border-cyan-200 bg-[#ecfeff] p-4">
              <p className="text-xs font-bold uppercase text-cyan-800">Tổng điểm đạt được</p>
              <p className="mt-1 text-3xl font-extrabold text-[#06b6d4]">{state.score}</p>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => handleRestart(chapterId)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#06b6d4] px-6 text-sm font-bold text-white hover:bg-[#0891b2]"
              >
                <RotateCcw className="size-4" />
                Chơi lại ván mới
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
