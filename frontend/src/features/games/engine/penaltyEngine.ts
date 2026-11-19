import type { GameQuizOptionId, GameQuizQuestion } from "../types";
import { buildQuizDeck } from "../data/geo10GameQuestions";

export type GoalZoneId =
  | "top-left"
  | "top-right"
  | "center"
  | "bottom-left"
  | "bottom-right";

export type GoalZoneInfo = {
  id: GoalZoneId;
  label: string;
  shortLabel: string;
  xPercent: number;
  yPercent: number;
};

export const GOAL_ZONES: GoalZoneInfo[] = [
  { id: "top-left", label: "Góc cao trái", shortLabel: "Cao Trái", xPercent: 22, yPercent: 28 },
  { id: "top-right", label: "Góc cao phải", shortLabel: "Cao Phải", xPercent: 78, yPercent: 28 },
  { id: "center", label: "Chính giữa khung thành", shortLabel: "Giữa", xPercent: 50, yPercent: 48 },
  { id: "bottom-left", label: "Góc thấp trái", shortLabel: "Thấp Trái", xPercent: 22, yPercent: 74 },
  { id: "bottom-right", label: "Góc thấp phải", shortLabel: "Thấp Phải", xPercent: 78, yPercent: 74 },
];

export type PenaltyShotRecord = {
  round: number;
  questionId: string;
  quizCorrect: boolean;
  targetZone: GoalZoneId;
  keeperZone: GoalZoneId;
  scored: boolean;
  opponentScored: boolean;
};

export type PenaltyPhase =
  | "question"
  | "aiming"
  | "round_summary"
  | "match_finished";

export type PenaltyQuizState = {
  chapterId: string;
  questions: GameQuizQuestion[];
  totalRounds: number;
  currentRound: number; // 0-indexed (0..4)
  phase: PenaltyPhase;
  selectedOptionId: GameQuizOptionId | null;
  lastQuizCorrect: boolean | null;
  lastShotTarget: GoalZoneId | null;
  lastKeeperDive: GoalZoneId | null;
  lastShotScored: boolean | null;
  lastOpponentScored: boolean | null;
  playerGoals: number;
  opponentGoals: number;
  correctQuizCount: number;
  score: number;
  history: PenaltyShotRecord[];
};

export function createPenaltyQuizState(
  chapterId = "all",
  totalRounds = 5,
  rng: () => number = Math.random,
): PenaltyQuizState {
  const questions = buildQuizDeck(totalRounds, chapterId, rng);
  return {
    chapterId,
    questions,
    totalRounds,
    currentRound: 0,
    phase: "question",
    selectedOptionId: null,
    lastQuizCorrect: null,
    lastShotTarget: null,
    lastKeeperDive: null,
    lastShotScored: null,
    lastOpponentScored: null,
    playerGoals: 0,
    opponentGoals: 0,
    correctQuizCount: 0,
    score: 0,
    history: [],
  };
}

export function answerPenaltyQuestion(
  state: PenaltyQuizState,
  optionId: GameQuizOptionId,
): PenaltyQuizState {
  if (state.phase !== "question") return state;
  const currentQuestion = state.questions[state.currentRound];
  if (!currentQuestion) return state;

  const isCorrect = optionId === currentQuestion.correctOptionId;
  return {
    ...state,
    selectedOptionId: optionId,
    lastQuizCorrect: isCorrect,
    correctQuizCount: state.correctQuizCount + (isCorrect ? 1 : 0),
    score: state.score + (isCorrect ? 100 : 0),
    phase: "aiming",
  };
}

export function shootPenaltyBall(
  state: PenaltyQuizState,
  targetZone: GoalZoneId,
  rng: () => number = Math.random,
): PenaltyQuizState {
  if (state.phase !== "aiming") return state;
  const currentQuestion = state.questions[state.currentRound];
  if (!currentQuestion) return state;

  const quizCorrect = Boolean(state.lastQuizCorrect);
  const allZoneIds = GOAL_ZONES.map((z) => z.id);
  const otherZones = allZoneIds.filter((id) => id !== targetZone);

  let keeperZone: GoalZoneId;
  let scored: boolean;

  if (quizCorrect) {
    // Khi trả lời ĐÚNG câu hỏi Địa lí: cú sút căng & hiểm, 85% đánh lừa thủ môn
    const keeperGuessesRight = rng() < 0.15;
    keeperZone = keeperGuessesRight
      ? targetZone
      : otherZones[Math.floor(rng() * otherZones.length)];
    scored = !keeperGuessesRight;
  } else {
    // Khi trả lời SAI: cú sút nhẹ, thủ môn có 70% bắt bài đúng góc
    const keeperGuessesRight = rng() < 0.7;
    keeperZone = keeperGuessesRight
      ? targetZone
      : otherZones[Math.floor(rng() * otherZones.length)];
    scored = !keeperGuessesRight;
  }

  // Lượt sút của đối thủ máy: nếu học sinh trả lời đúng câu hỏi, thủ môn đội nhà cản phá tốt hơn
  const opponentScored = quizCorrect ? rng() < 0.45 : rng() < 0.75;

  const shotBonus = scored ? (quizCorrect ? 150 : 60) : 0;
  const record: PenaltyShotRecord = {
    round: state.currentRound + 1,
    questionId: currentQuestion.id,
    quizCorrect,
    targetZone,
    keeperZone,
    scored,
    opponentScored,
  };

  return {
    ...state,
    phase: "round_summary",
    lastShotTarget: targetZone,
    lastKeeperDive: keeperZone,
    lastShotScored: scored,
    lastOpponentScored: opponentScored,
    playerGoals: state.playerGoals + (scored ? 1 : 0),
    opponentGoals: state.opponentGoals + (opponentScored ? 1 : 0),
    score: state.score + shotBonus,
    history: [...state.history, record],
  };
}

export function advancePenaltyRound(state: PenaltyQuizState): PenaltyQuizState {
  if (state.phase !== "round_summary") return state;
  const nextRound = state.currentRound + 1;
  if (nextRound >= state.totalRounds) {
    const winBonus = state.playerGoals > state.opponentGoals ? 200 : 0;
    return {
      ...state,
      phase: "match_finished",
      score: state.score + winBonus,
    };
  }

  return {
    ...state,
    currentRound: nextRound,
    phase: "question",
    selectedOptionId: null,
    lastQuizCorrect: null,
    lastShotTarget: null,
    lastKeeperDive: null,
    lastShotScored: null,
    lastOpponentScored: null,
  };
}
