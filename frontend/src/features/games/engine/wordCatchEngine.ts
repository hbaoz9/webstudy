import type { WordCatchPuzzle } from "../types";
import { buildWordCatchDeck, type DeckBuildOptions } from "../data/geo10GameQuestions";

const VIETNAMESE_CHAR_MAP: Record<string, string> = {
  À: "A", Á: "A", Ả: "A", Ã: "A", Ạ: "A",
  Ă: "A", Ằ: "A", Ắ: "A", Ẳ: "A", Ẵ: "A", Ặ: "A",
  Â: "A", Ầ: "A", Ấ: "A", Ẩ: "A", Ẫ: "A", Ậ: "A",
  Đ: "D",
  È: "E", É: "E", Ẻ: "E", Ẽ: "E", Ẹ: "E",
  Ê: "E", Ề: "E", Ế: "E", Ể: "E", Ễ: "E", Ệ: "E",
  Ì: "I", Í: "I", Ỉ: "I", Ĩ: "I", Ị: "I",
  Ò: "O", Ó: "O", Ỏ: "O", Õ: "O", Ọ: "O",
  Ô: "O", Ồ: "O", Ố: "O", Ổ: "O", Ỗ: "O", Ộ: "O",
  Ơ: "O", Ờ: "O",Ớ: "O", Ở: "O", Ỡ: "O", Ợ: "O",
  Ù: "U", Ú: "U", Ủ: "U", Ũ: "U", Ụ: "U",
  Ư: "U", Ừ: "U", Ứ: "U", Ử: "U", Ữ: "U", Ự: "U",
  Ỳ: "Y", Ý: "Y", Ỷ: "Y", Ỹ: "Y", Ỵ: "Y",
};

const DISTRACTOR_ALPHABET = "ABCDEGHIKLMNOPQRSTUVXY";

export function normalizeVietnameseChar(input: string): string {
  if (!input) return "";
  const upper = input.toUpperCase();
  if (VIETNAMESE_CHAR_MAP[upper]) return VIETNAMESE_CHAR_MAP[upper];
  return upper
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Đ/g, "D")
    .replace(/[^A-Z0-9]/g, "");
}

export function normalizeVietnamesePhrase(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .map((word) =>
      Array.from(word)
        .map((ch) => normalizeVietnameseChar(ch))
        .join(""),
    )
    .filter(Boolean)
    .join(" ");
}

export type WordSlotToken =
  | { kind: "space"; tokenIndex: number }
  | {
      kind: "letter";
      tokenIndex: number;
      slotIndex: number;
      displayChar: string;
      baseChar: string;
    };

export function tokenizeWordPuzzle(answerDisplay: string): WordSlotToken[] {
  const tokens: WordSlotToken[] = [];
  let slotIndex = 0;
  const cleaned = answerDisplay.trim().replace(/\s+/g, " ");
  Array.from(cleaned).forEach((ch, tokenIndex) => {
    if (ch === " ") {
      tokens.push({ kind: "space", tokenIndex });
    } else {
      const displayChar = ch.toUpperCase();
      const baseChar = normalizeVietnameseChar(displayChar) || displayChar;
      tokens.push({
        kind: "letter",
        tokenIndex,
        slotIndex: slotIndex++,
        displayChar,
        baseChar,
      });
    }
  });
  return tokens;
}

export type LetterTile = {
  id: string;
  char: string;
};

export function generateLetterBank(
  answerDisplay: string,
  totalTiles = 15,
  rng: () => number = Math.random,
): LetterTile[] {
  const letterTokens = tokenizeWordPuzzle(answerDisplay).filter(
    (t): t is Extract<WordSlotToken, { kind: "letter" }> => t.kind === "letter",
  );
  const baseChars = letterTokens.map((t) => t.baseChar);
  const countNeeded = Math.max(totalTiles, baseChars.length + 3);
  const distractors: string[] = [];

  while (baseChars.length + distractors.length < countNeeded) {
    const idx = Math.floor(rng() * DISTRACTOR_ALPHABET.length);
    distractors.push(DISTRACTOR_ALPHABET[idx]);
  }

  const allChars = [...baseChars, ...distractors];
  for (let i = allChars.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [allChars[i], allChars[j]] = [allChars[j], allChars[i]];
  }

  return allChars.map((char, index) => ({
    id: `tile-${index}-${char}`,
    char,
  }));
}

export type WordSlotPlacement = {
  tileId: string;
  char: string;
  lockedByHint?: boolean;
};

export type WordCatchRoundStatus = "playing" | "round_won" | "round_lost" | "game_over" | "game_completed";

export type WordCatchState = {
  chapterId: string;
  allowCrossChapterFallback: boolean;
  puzzles: WordCatchPuzzle[];
  currentIndex: number;
  score: number;
  lives: number;
  maxLives: number;
  status: WordCatchRoundStatus;
  tokens: WordSlotToken[];
  letterCount: number;
  tiles: LetterTile[];
  placements: (WordSlotPlacement | null)[];
  hintsUsedInRound: number;
  feedbackMessage: string | null;
  roundsSolved: number;
};

function setupRoundFields(
  puzzle: WordCatchPuzzle,
  rng: () => number = Math.random,
): Pick<WordCatchState, "tokens" | "letterCount" | "tiles" | "placements" | "hintsUsedInRound" | "feedbackMessage"> {
  const tokens = tokenizeWordPuzzle(puzzle.answerDisplay);
  const letterCount = tokens.filter((t) => t.kind === "letter").length;
  const tiles = generateLetterBank(puzzle.answerDisplay, Math.max(15, letterCount + 4), rng);
  return {
    tokens,
    letterCount,
    tiles,
    placements: Array.from({ length: letterCount }, () => null),
    hintsUsedInRound: 0,
    feedbackMessage: null,
  };
}

export function createWordCatchState(
  chapterId = "all",
  roundCount = 10,
  rng: () => number = Math.random,
  options?: DeckBuildOptions,
): WordCatchState {
  const allowCrossChapterFallback = Boolean(options?.allowCrossChapterFallback);
  const puzzles = buildWordCatchDeck(roundCount, chapterId, rng, {
    allowCrossChapterFallback,
  });
  const first = puzzles[0];
  return {
    chapterId,
    allowCrossChapterFallback,
    puzzles,
    currentIndex: 0,
    score: 0,
    lives: 3,
    maxLives: 3,
    status: "playing",
    roundsSolved: 0,
    ...setupRoundFields(first, rng),
  };
}

export function selectLetterTile(state: WordCatchState, tileId: string): WordCatchState {
  if (state.status !== "playing") return state;
  // Ignore if tile already used
  if (state.placements.some((p) => p?.tileId === tileId)) return state;
  const tile = state.tiles.find((t) => t.id === tileId);
  if (!tile) return state;

  const emptyIdx = state.placements.findIndex((p) => p === null);
  if (emptyIdx === -1) return state;

  const nextPlacements = [...state.placements];
  nextPlacements[emptyIdx] = {
    tileId: tile.id,
    char: tile.char,
  };

  return {
    ...state,
    placements: nextPlacements,
    feedbackMessage: null,
  };
}

export function removeSlotLetter(state: WordCatchState, slotIndex: number): WordCatchState {
  if (state.status !== "playing") return state;
  const current = state.placements[slotIndex];
  if (!current || current.lockedByHint) return state;

  const nextPlacements = [...state.placements];
  nextPlacements[slotIndex] = null;
  return {
    ...state,
    placements: nextPlacements,
    feedbackMessage: null,
  };
}

export function clearUnlockedSlots(state: WordCatchState): WordCatchState {
  if (state.status !== "playing") return state;
  return {
    ...state,
    placements: state.placements.map((p) => (p?.lockedByHint ? p : null)),
    feedbackMessage: null,
  };
}

export function typeCharacterIntoSlot(state: WordCatchState, rawKey: string): WordCatchState {
  if (state.status !== "playing") return state;
  if (rawKey === "Backspace") {
    for (let i = state.placements.length - 1; i >= 0; i--) {
      const item = state.placements[i];
      if (item && !item.lockedByHint) {
        return removeSlotLetter(state, i);
      }
    }
    return state;
  }

  const normalized = normalizeVietnameseChar(rawKey);
  if (!normalized || normalized.length !== 1) return state;

  const usedTileIds = new Set(
    state.placements.filter((p): p is WordSlotPlacement => p !== null).map((p) => p.tileId),
  );
  const matchingTile = state.tiles.find(
    (t) => t.char === normalized && !usedTileIds.has(t.id),
  );
  if (!matchingTile) return state;
  return selectLetterTile(state, matchingTile.id);
}

export function revealHintLetter(state: WordCatchState): WordCatchState {
  if (state.status !== "playing") return state;
  const letterTokens = state.tokens.filter(
    (t): t is Extract<WordSlotToken, { kind: "letter" }> => t.kind === "letter",
  );

  // Tìm ô đầu tiên chưa được khóa gợi ý
  const targetToken = letterTokens.find((t) => !state.placements[t.slotIndex]?.lockedByHint);
  if (!targetToken) return state;

  const nextPlacements = [...state.placements];
  // Giải phóng tile đang chiếm ô này nếu có
  nextPlacements[targetToken.slotIndex] = null;

  const usedTileIds = new Set(
    nextPlacements.filter((p): p is WordSlotPlacement => p !== null).map((p) => p.tileId),
  );
  const availableTile = state.tiles.find(
    (t) => t.char === targetToken.baseChar && !usedTileIds.has(t.id),
  );

  // Nếu tile đúng đang bị đặt nhầm ở một ô khác chưa khóa, thu hồi nó về ô đúng
  if (!availableTile) {
    const misplacedSlotIdx = nextPlacements.findIndex(
      (p) => p && !p.lockedByHint && p.char === targetToken.baseChar,
    );
    if (misplacedSlotIdx >= 0) {
      const reclaimed = nextPlacements[misplacedSlotIdx]!;
      nextPlacements[misplacedSlotIdx] = null;
      nextPlacements[targetToken.slotIndex] = {
        tileId: reclaimed.tileId,
        char: targetToken.displayChar,
        lockedByHint: true,
      };
    }
  } else {
    nextPlacements[targetToken.slotIndex] = {
      tileId: availableTile.id,
      char: targetToken.displayChar,
      lockedByHint: true,
    };
  }

  return {
    ...state,
    placements: nextPlacements,
    score: Math.max(0, state.score - 20),
    hintsUsedInRound: state.hintsUsedInRound + 1,
    feedbackMessage: `Đã mở chữ cái gợi ý "${targetToken.displayChar}" (-20 điểm).`,
  };
}

export function submitWordCatchAnswer(state: WordCatchState): WordCatchState {
  if (state.status !== "playing") return state;
  if (state.placements.some((p) => p === null)) {
    return {
      ...state,
      feedbackMessage: "Hãy ghép đủ tất cả các ô chữ trước khi nộp câu trả lời!",
    };
  }

  const currentPuzzle = state.puzzles[state.currentIndex];
  if (!currentPuzzle) return state;

  const letterTokens = state.tokens.filter(
    (t): t is Extract<WordSlotToken, { kind: "letter" }> => t.kind === "letter",
  );

  const isCorrect = letterTokens.every((token) => {
    const placed = state.placements[token.slotIndex];
    if (!placed) return false;
    return normalizeVietnameseChar(placed.char) === token.baseChar;
  });

  if (isCorrect) {
    // Hiển thị đầy đủ dấu tiếng Việt trên các ô chữ khi trả lời chính xác
    const accentedPlacements = letterTokens.map((token) => {
      const existing = state.placements[token.slotIndex]!;
      return {
        ...existing,
        char: token.displayChar,
        lockedByHint: true,
      };
    });

    const earnedPoints = Math.max(40, 120 - state.hintsUsedInRound * 20);
    return {
      ...state,
      placements: accentedPlacements,
      score: state.score + earnedPoints,
      roundsSolved: state.roundsSolved + 1,
      status: "round_won",
      feedbackMessage: `Chính xác! Đáp án là "${currentPuzzle.answerDisplay}" (+${earnedPoints} điểm).`,
    };
  }

  const nextLives = state.lives - 1;
  if (nextLives <= 0) {
    return {
      ...state,
      lives: 0,
      status: "game_over",
      feedbackMessage: `Hết mạng! Đáp án đúng của câu này là "${currentPuzzle.answerDisplay}".`,
    };
  }

  return {
    ...state,
    lives: nextLives,
    feedbackMessage: `Chưa chính xác! Bạn còn ${nextLives}/${state.maxLives} mạng. Hãy kiểm tra lại các chữ cái.`,
  };
}

export function skipWordCatchRound(
  state: WordCatchState,
  rng: () => number = Math.random,
): WordCatchState {
  if (state.status !== "playing") return state;
  const nextIndex = state.currentIndex + 1;
  if (nextIndex >= state.puzzles.length) {
    return {
      ...state,
      status: "game_completed",
      feedbackMessage: "Đã hoàn thành tất cả các lượt chơi!",
    };
  }
  return {
    ...state,
    currentIndex: nextIndex,
    status: "playing",
    ...setupRoundFields(state.puzzles[nextIndex], rng),
  };
}

export function advanceWordCatchRound(
  state: WordCatchState,
  rng: () => number = Math.random,
): WordCatchState {
  if (state.status !== "round_won" && state.status !== "round_lost") return state;
  const nextIndex = state.currentIndex + 1;
  if (nextIndex >= state.puzzles.length) {
    return {
      ...state,
      status: "game_completed",
    };
  }
  return {
    ...state,
    currentIndex: nextIndex,
    status: "playing",
    ...setupRoundFields(state.puzzles[nextIndex], rng),
  };
}
