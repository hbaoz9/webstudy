// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  MILLIONAIRE_LADDER,
  advanceMillionaireQuestion,
  answerMillionaireQuestion,
  computeGuaranteedPrize,
  createMillionaireState,
  handleMillionaireTimeout,
  useLifeline5050,
  useLifelineAudiencePoll,
  useLifelineExpertHint,
  useLifelineSwitchQuestion,
  walkAwayMillionaire,
} from "./millionaireEngine";
import {
  advanceWordCatchRound,
  clearUnlockedSlots,
  createWordCatchState,
  normalizeVietnameseChar,
  normalizeVietnamesePhrase,
  removeSlotLetter,
  revealHintLetter,
  selectLetterTile,
  submitWordCatchAnswer,
  tokenizeWordPuzzle,
  typeCharacterIntoSlot,
} from "./wordCatchEngine";
import {
  answerPenaltyQuestion,
  advancePenaltyRound,
  createPenaltyQuizState,
  shootPenaltyBall,
} from "./penaltyEngine";
import {
  answerOAnQuanQuiz,
  completeOAnQuanQuizModal,
  createInitialOAnQuanBoard,
  createOAnQuanState,
  ensureSideHasStones,
  executeStudentOAnQuanMove,
  findBestMoveForSide,
  isGameFinished,
  requestGeographyMoveAdvisor,
  simulateOAnQuanMove,
} from "./oAnQuanEngine";
import { clearGameProgress, loadGameProgress, recordGameResult } from "../gameStorage";
import {
  GEO10_GAME_QUESTIONS,
  GEO10_WORD_PUZZLES,
  getChapterDeckAvailability,
  validateGameQuestionBank,
} from "../data/geo10GameQuestions";

describe("Geography 10 V2 Question Bank & Strict Chapter Filtering", () => {
  it("validates 107 multiple-choice questions and 28 associative word puzzles across all 13 chapters and 40 lessons with zero errors or hint leaks", () => {
    const report = validateGameQuestionBank();
    expect(report.valid).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.totalQuestions).toBeGreaterThanOrEqual(104);
    expect(report.totalWordPuzzles).toBeGreaterThanOrEqual(28);
    expect(Object.keys(report.chapterQuestionCounts)).toHaveLength(13);
    expect(Object.keys(report.chapterPuzzleCounts)).toHaveLength(13);

    const uniqueLessonIds = new Set(GEO10_GAME_QUESTIONS.map((q) => q.lessonId));
    expect(uniqueLessonIds.size).toBe(40);

    // Every puzzle has 2 associative visual clues
    for (const puzzle of GEO10_WORD_PUZZLES) {
      expect(puzzle.visualClues).toBeDefined();
      expect(puzzle.visualClues?.length).toBe(2);
    }
    // 104 câu nền (8 câu × 13 chương) + 3 câu kĩ năng cho các bài Thực hành b27, b32, b38
    expect(GEO10_GAME_QUESTIONS.length).toBe(107);
    for (const count of Object.values(report.chapterQuestionCounts)) {
      expect(count).toBeGreaterThanOrEqual(8);
    }
  });

  it("never silently mixes chapters when a single chapter is selected (allowCrossChapterFallback = false by default)", () => {
    const targetChapter = "geo10-kn-c04";
    const quizAvail = getChapterDeckAvailability(targetChapter, 15, "quiz");
    expect(quizAvail.isStrictlySingleChapter).toBe(true);
    expect(quizAvail.availableCount).toBe(8);
    expect(quizAvail.isShortOfStandard).toBe(true);

    const puzzleAvail = getChapterDeckAvailability(targetChapter, 10, "word-catch");
    expect(puzzleAvail.availableCount).toBeGreaterThanOrEqual(2);
    expect(puzzleAvail.isShortOfStandard).toBe(true);

    // Millionaire pure single-chapter mode
    const pureMillionaire = createMillionaireState(targetChapter, Math.random, {
      allowCrossChapterFallback: false,
    });
    expect(pureMillionaire.questions.length).toBe(7);
    expect(pureMillionaire.questions.every((q) => q.chapterId === targetChapter)).toBe(true);
    expect(pureMillionaire.reserveQuestions.every((q) => q.chapterId === targetChapter)).toBe(true);

    // Millionaire explicit cross-chapter supplement mode
    const supplementedMillionaire = createMillionaireState(targetChapter, Math.random, {
      allowCrossChapterFallback: true,
    });
    expect(supplementedMillionaire.questions.length).toBe(15);

    // Word Catch pure single-chapter mode
    const pureWordCatch = createWordCatchState(targetChapter, 10, Math.random, {
      allowCrossChapterFallback: false,
    });
    expect(pureWordCatch.puzzles.every((p) => p.chapterId === targetChapter)).toBe(true);

    // Penalty Quiz pure single-chapter mode (5 rounds <= 8 available)
    const purePenalty = createPenaltyQuizState(targetChapter, 5);
    expect(purePenalty.questions).toHaveLength(5);
    expect(purePenalty.questions.every((q) => q.chapterId === targetChapter)).toBe(true);

    // Ô ăn quan pure single-chapter mode
    const pureOAnQuan = createOAnQuanState(targetChapter);
    expect(pureOAnQuan.questions.every((q) => q.chapterId === targetChapter)).toBe(true);
  });

  it("completes full end-to-end game sessions for Millionaire, Word Catch, and Penalty Quiz", () => {
    // 1. Complete all 15 questions in Millionaire
    let mState = createMillionaireState("all");
    for (let i = 0; i < 15; i++) {
      const q = mState.questions[mState.currentIndex]!;
      mState = answerMillionaireQuestion(mState, q.correctOptionId);
      if (i < 14) {
        mState = advanceMillionaireQuestion(mState);
      }
    }
    expect(mState.status).toBe("won");
    expect(mState.finalPrize).toBe(150000);

    // 2. Complete all rounds in Word Catch
    let wState = createWordCatchState("geo10-kn-c02", 10, Math.random, {
      allowCrossChapterFallback: false,
    });
    const totalPuzzles = wState.puzzles.length;
    for (let r = 0; r < totalPuzzles; r++) {
      const letterTokens = wState.tokens.filter(
        (t): t is Extract<(typeof wState.tokens)[number], { kind: "letter" }> =>
          t.kind === "letter",
      );
      for (const tok of letterTokens) {
        wState = typeCharacterIntoSlot(wState, tok.baseChar);
      }
      wState = submitWordCatchAnswer(wState);
      expect(wState.status).toBe("round_won");
      wState = advanceWordCatchRound(wState);
    }
    expect(wState.status).toBe("game_completed");

    // 3. Complete all 5 rounds in Penalty Quiz
    let pState = createPenaltyQuizState("all", 5);
    for (let r = 0; r < 5; r++) {
      const q = pState.questions[pState.currentRound]!;
      pState = answerPenaltyQuestion(pState, q.correctOptionId);
      pState = shootPenaltyBall(pState, "top-right", () => 0.85);
      pState = advancePenaltyRound(pState);
    }
    expect(pState.phase).toBe("match_finished");
    expect(pState.history).toHaveLength(5);
  });
});

describe("Millionaire Geography 10 Engine", () => {
  it("initializes 15 distinct questions and tracks safe milestones accurately", () => {
    const state = createMillionaireState("all");
    expect(state.questions).toHaveLength(15);
    const uniqueIds = new Set(state.questions.map((q) => q.id));
    expect(uniqueIds.size).toBe(15);

    expect(computeGuaranteedPrize(0)).toBe(0);
    expect(computeGuaranteedPrize(4)).toBe(0);
    expect(computeGuaranteedPrize(5)).toBe(2000);
    expect(computeGuaranteedPrize(9)).toBe(2000);
    expect(computeGuaranteedPrize(10)).toBe(22000);
    expect(computeGuaranteedPrize(15)).toBe(150000);
  });

  it("grades correct and wrong answers and applies safe milestone fallback", () => {
    let state = createMillionaireState("all");
    // Advance 5 steps correctly to lock milestone 1 (2,000 pts)
    for (let i = 0; i < 5; i++) {
      const q = state.questions[state.currentIndex]!;
      state = answerMillionaireQuestion(state, q.correctOptionId);
      expect(state.status).toBe("revealed_correct");
      state = advanceMillionaireQuestion(state);
    }
    expect(state.currentIndex).toBe(5);
    expect(state.currentPrize).toBe(MILLIONAIRE_LADDER[4]!.points);
    expect(state.guaranteedPrize).toBe(2000);

    // Answer step 6 wrong -> drops back to guaranteed 2,000 pts
    const q6 = state.questions[state.currentIndex]!;
    const wrongOption = q6.options.find((o) => o.id !== q6.correctOptionId)!;
    const lostState = answerMillionaireQuestion(state, wrongOption.id);
    expect(lostState.status).toBe("lost");
    expect(lostState.finalPrize).toBe(2000);
  });

  it("supports 50:50, classroom poll, expert hint, question switch, walk-away, and timeout", () => {
    let state = createMillionaireState("all");
    const q1 = state.questions[state.currentIndex]!;

    // 50:50 hides 2 wrong options and never hides the correct option
    state = useLifeline5050(state);
    expect(state.lifelinesUsed.fiftyFifty).toBe(true);
    expect(state.hiddenOptionIds).toHaveLength(2);
    expect(state.hiddenOptionIds).not.toContain(q1.correctOptionId);

    // Classroom poll sums to 100% and sets zero for hidden options
    state = useLifelineAudiencePoll(state);
    expect(state.lifelinesUsed.audiencePoll).toBe(true);
    expect(state.audiencePoll).not.toBeNull();
    const sum = Object.values(state.audiencePoll ?? {}).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
    for (const hiddenId of state.hiddenOptionIds) {
      expect(state.audiencePoll?.[hiddenId]).toBe(0);
    }

    // Expert hint provides curriculum guidance
    state = useLifelineExpertHint(state);
    expect(state.lifelinesUsed.expertHint).toBe(true);
    expect(state.expertHintText).toBeTruthy();

    // Switch question replaces current question with a reserve question
    const oldQuestionId = q1.id;
    state = useLifelineSwitchQuestion(state);
    expect(state.lifelinesUsed.switchQuestion).toBe(true);
    expect(state.questions[state.currentIndex]?.id).not.toBe(oldQuestionId);
    expect(state.hiddenOptionIds).toHaveLength(0);

    // Walk away preserves current prize
    const walked = walkAwayMillionaire(state);
    expect(walked.status).toBe("walked_away");

    // Timeout ends game at guaranteed score
    const timedOut = handleMillionaireTimeout(state);
    expect(timedOut.status).toBe("lost");
    expect(timedOut.timeoutLost).toBe(true);
  });
});

describe("Word Catch (Đuổi hình bắt chữ) Engine & Vietnamese Normalization", () => {
  it("normalizes Vietnamese diacritics including Đ/đ accurately", () => {
    expect(normalizeVietnameseChar("Đ")).toBe("D");
    expect(normalizeVietnameseChar("ộ")).toBe("O");
    expect(normalizeVietnamesePhrase("Vịnh Hạ Long")).toBe("VINH HA LONG");
    expect(normalizeVietnamesePhrase("Đô thị hóa")).toBe("DO THI HOA");
    expect(normalizeVietnamesePhrase("Quy luật địa đới")).toBe("QUY LUAT DIA DOI");
  });

  it("tokenizes word puzzle preserving full Vietnamese accents while matching base ASCII letters", () => {
    const tokens = tokenizeWordPuzzle("ĐÔ THỊ HÓA");
    const letterTokens = tokens.filter((t) => t.kind === "letter");
    expect(letterTokens).toHaveLength(8);
    expect(letterTokens[0]?.baseChar).toBe("D");
    expect(letterTokens[0]?.displayChar).toBe("Đ");
  });

  it("handles tile selection, keyboard typing, hint reveal, and submission grading", () => {
    let state = createWordCatchState("all", 5);
    const letterTokens = state.tokens.filter(
      (t): t is Extract<(typeof state.tokens)[number], { kind: "letter" }> => t.kind === "letter",
    );

    // Reveal hint on first slot
    state = revealHintLetter(state);
    expect(state.hintsUsedInRound).toBe(1);
    expect(state.placements[0]?.lockedByHint).toBe(true);
    expect(state.placements[0]?.char).toBe(letterTokens[0]?.displayChar);

    // Type remaining letters via keyboard
    for (let i = 1; i < letterTokens.length; i++) {
      state = typeCharacterIntoSlot(state, letterTokens[i]!.baseChar);
    }

    state = submitWordCatchAnswer(state);
    expect(state.status).toBe("round_won");
    expect(state.score).toBe(100); // 120 - 1*20

    // Advance to next round
    state = advanceWordCatchRound(state);
    expect(state.currentIndex).toBe(1);
    expect(state.status).toBe("playing");

    // Select & remove tile
    const firstTile = state.tiles[0]!;
    state = selectLetterTile(state, firstTile.id);
    expect(state.placements[0]?.char).toBe(firstTile.char);
    state = removeSlotLetter(state, 0);
    expect(state.placements[0]).toBeNull();

    // Clear unlocked slots
    state = selectLetterTile(state, firstTile.id);
    state = clearUnlockedSlots(state);
    expect(state.placements.every((p) => p === null)).toBe(true);
  });

  it("deducts lives on wrong guesses and triggers game_over at 0 lives", () => {
    let state = createWordCatchState("all", 5);

    for (let attempt = 0; attempt < 3; attempt++) {
      state = clearUnlockedSlots(state);
      // Fill all slots with the first available tiles, then force at least one mismatch
      for (const tile of state.tiles) {
        if (state.placements.every((p) => p !== null)) break;
        state = selectLetterTile(state, tile.id);
      }
      // Ensure mismatch by swapping or checking against expected
      const letterTokens = state.tokens.filter(
        (t): t is Extract<(typeof state.tokens)[number], { kind: "letter" }> => t.kind === "letter",
      );
      const accidentallyCorrect = letterTokens.every(
        (tok) => normalizeVietnameseChar(state.placements[tok.slotIndex]?.char ?? "") === tok.baseChar,
      );
      if (accidentallyCorrect) {
        // Swap first two placements
        const copy = [...state.placements];
        [copy[0], copy[1]] = [copy[1]!, copy[0]!];
        state = { ...state, placements: copy };
      }
      state = submitWordCatchAnswer(state);
    }

    expect(state.lives).toBe(0);
    expect(state.status).toBe("game_over");
  });
});

describe("Penalty Quiz Engine", () => {
  it("charges Power Shot on correct quiz answer and advances rounds cleanly", () => {
    let state = createPenaltyQuizState("all", 5);
    const q1 = state.questions[state.currentRound]!;

    // Correct answer -> lastQuizCorrect = true, phase = aiming
    state = answerPenaltyQuestion(state, q1.correctOptionId);
    expect(state.phase).toBe("aiming");
    expect(state.lastQuizCorrect).toBe(true);
    expect(state.correctQuizCount).toBe(1);

    // Deterministic RNG (0.9) so keeper misses and student scores goal
    state = shootPenaltyBall(state, "top-left", () => 0.9);
    expect(state.phase).toBe("round_summary");
    expect(state.lastShotScored).toBe(true);
    expect(state.playerGoals).toBe(1);

    // Advance to round 2
    state = advancePenaltyRound(state);
    expect(state.currentRound).toBe(1);
    expect(state.phase).toBe("question");
  });
});

describe("Ô ăn quan Địa lý Engine", () => {
  it("initializes authentic 12-cell board with 2 Mandarins (10 pts) and 10 dân cells (5 stones)", () => {
    const board = createInitialOAnQuanBoard();
    expect(board).toHaveLength(12);
    expect(board[0]?.isMandarin).toBe(true);
    expect(board[0]?.hasMandarin).toBe(true);
    expect(board[6]?.isMandarin).toBe(true);
    expect(board[6]?.hasMandarin).toBe(true);
    for (const idx of [1, 2, 3, 4, 5, 7, 8, 9, 10, 11]) {
      expect(board[idx]?.stones).toBe(5);
      expect(board[idx]?.hasMandarin).toBe(false);
    }
  });

  it("performs relay sowing and stops when next cell is a Mandarin cell", () => {
    const board = createInitialOAnQuanBoard();
    const sim = simulateOAnQuanMove(board, 1, "left");
    expect(sim.valid).toBe(true);
    expect(sim.relayCount).toBeGreaterThan(0);
    expect(sim.visitedPath.length).toBeGreaterThan(5);
  });

  it("captures stones and Mandarin when the cell after sowing is empty and following cell has stones", () => {
    const board = createInitialOAnQuanBoard();
    // Cell 2 has 2 stones, sowing right lands on 3, 4.
    // Make cell 5 empty, and cell 6 (Mandarin) have 3 stones + Mandarin!
    board[2]!.stones = 2;
    board[5]!.stones = 0;
    board[6]!.stones = 3;
    board[6]!.hasMandarin = true;

    const sim = simulateOAnQuanMove(board, 2, "right");
    expect(sim.stopReason).toBe("captured");
    expect(sim.capturedPoints).toBe(13); // 10 Mandarin + 3 dân stones
    expect(sim.capturedMandarins).toBe(1);
    expect(sim.nextBoard[6]?.stones).toBe(0);
    expect(sim.nextBoard[6]?.hasMandarin).toBe(false);
  });

  it("stops without capture on double empty cells", () => {
    const board = createInitialOAnQuanBoard();
    board[2]!.stones = 1;
    board[4]!.stones = 0;
    board[5]!.stones = 0;

    const sim = simulateOAnQuanMove(board, 2, "right");
    expect(sim.capturedPoints).toBe(0);
    expect(sim.stopReason).toBe("double_empty_stop");
  });

  it("reseeds 5 dân cells (Rải 5 quân) when a player's side becomes completely empty", () => {
    const board = createInitialOAnQuanBoard();
    for (const i of [1, 2, 3, 4, 5]) {
      board[i]!.stones = 0;
    }
    const reseeded = ensureSideHasStones(board, "student", 12);
    expect(reseeded.reseeded).toBe(true);
    expect(reseeded.updatedScore).toBe(7); // 12 - 5
    for (const i of [1, 2, 3, 4, 5]) {
      expect(reseeded.board[i]?.stones).toBe(1);
    }
  });

  it("detects terminal board when both Mandarins are captured", () => {
    const board = createInitialOAnQuanBoard();
    board[0]!.stones = 0;
    board[0]!.hasMandarin = false;
    board[6]!.stones = 0;
    board[6]!.hasMandarin = false;
    expect(isGameFinished(board)).toBe(true);
  });

  it("triggers Geography 10 capture quiz and advisor quiz during gameplay", () => {
    let state = createOAnQuanState("all");
    // Configure board so student move (cell 2, right) captures cell 5
    state.board[2]!.stones = 1;
    state.board[4]!.stones = 0;
    state.board[5]!.stones = 6;

    state = executeStudentOAnQuanMove(state, 2, "right");
    expect(state.phase).toBe("capture_quiz");
    expect(state.pendingCapturePoints).toBe(6);

    const currentQuiz = state.questions[state.questionCursor]!;
    state = answerOAnQuanQuiz(state, currentQuiz.correctOptionId);
    expect(state.lastQuizCorrect).toBe(true);
    expect(state.studentGeoBonusScore).toBeGreaterThanOrEqual(5);

    // Complete modal -> AI runs its turn automatically and returns to student_turn
    state = completeOAnQuanQuizModal(state);
    expect(["student_turn", "game_over"]).toContain(state.phase);

    if (state.phase === "student_turn") {
      const bestForAi = findBestMoveForSide(state.board, "ai");
      expect(bestForAi).not.toBeNull();

      state = requestGeographyMoveAdvisor(state);
      expect(state.phase).toBe("advisor_quiz");
      const advisorQ = state.questions[state.questionCursor]!;
      state = answerOAnQuanQuiz(state, advisorQ.correctOptionId);
      expect(state.recommendedMove).not.toBeNull();
      state = completeOAnQuanQuizModal(state);
      expect(state.phase).toBe("student_turn");
    }
  });
});

describe("Game LocalStorage Persistence (Entertainment-only per student)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores and retrieves personal best scores and play history isolated by user ID", () => {
    const updated1 = recordGameResult("student-101", {
      gameId: "millionaire",
      score: 22000,
      maxScore: 150000,
      won: true,
      summary: "Đạt mốc 10/15 câu",
    });

    expect(updated1.millionaire.gamesPlayed).toBe(1);
    expect(updated1.millionaire.highScore).toBe(22000);
    expect(updated1.millionaire.recentHistory).toHaveLength(1);

    // Higher score updates highScore
    const updated2 = recordGameResult("student-101", {
      gameId: "millionaire",
      score: 85000,
      maxScore: 150000,
      won: true,
      summary: "Đạt mốc 13/15 câu",
    });
    expect(updated2.millionaire.gamesPlayed).toBe(2);
    expect(updated2.millionaire.highScore).toBe(85000);

    // Different student has clean state
    const otherStudent = loadGameProgress("student-202");
    expect(otherStudent.millionaire.gamesPlayed).toBe(0);

    // Clear storage works
    const cleared = clearGameProgress("student-101");
    expect(cleared.millionaire.recentHistory).toHaveLength(0);
  });
});
