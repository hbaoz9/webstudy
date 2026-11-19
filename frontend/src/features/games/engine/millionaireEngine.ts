import type { GameQuizOptionId, GameQuizQuestion } from "../types";
import {
  buildMillionaireQuestionDeck,
  type DeckBuildOptions,
} from "../data/geo10GameQuestions";

export type MillionaireStep = {
  step: number;
  label: string;
  points: number;
  isMilestone: boolean;
};

export const MILLIONAIRE_LADDER: MillionaireStep[] = [
  { step: 1, label: "200k", points: 200, isMilestone: false },
  { step: 2, label: "400k", points: 400, isMilestone: false },
  { step: 3, label: "600k", points: 600, isMilestone: false },
  { step: 4, label: "1 Triệu", points: 1000, isMilestone: false },
  { step: 5, label: "2 Triệu", points: 2000, isMilestone: true },
  { step: 6, label: "3 Triệu", points: 3000, isMilestone: false },
  { step: 7, label: "6 Triệu", points: 6000, isMilestone: false },
  { step: 8, label: "10 Triệu", points: 10000, isMilestone: false },
  { step: 9, label: "14 Triệu", points: 14000, isMilestone: false },
  { step: 10, label: "22 Triệu", points: 22000, isMilestone: true },
  { step: 11, label: "40 Triệu", points: 40000, isMilestone: false },
  { step: 12, label: "60 Triệu", points: 60000, isMilestone: false },
  { step: 13, label: "80 Triệu", points: 80000, isMilestone: false },
  { step: 14, label: "100 Triệu", points: 100000, isMilestone: false },
  { step: 15, label: "150 Triệu", points: 150000, isMilestone: true },
];

export const MILLIONAIRE_QUESTION_TIME_SECONDS = 30;

export type MillionaireStatus =
  | "playing"
  | "revealed_correct"
  | "won"
  | "lost"
  | "walked_away";

export type MillionaireLifelines = {
  fiftyFifty: boolean;
  expertHint: boolean;
  audiencePoll: boolean;
  switchQuestion: boolean;
};

export type MillionaireState = {
  chapterId: string;
  allowCrossChapterFallback: boolean;
  questions: GameQuizQuestion[];
  reserveQuestions: GameQuizQuestion[];
  currentIndex: number;
  status: MillionaireStatus;
  selectedOptionId: GameQuizOptionId | null;
  hiddenOptionIds: GameQuizOptionId[];
  audiencePoll: Record<GameQuizOptionId, number> | null;
  expertHintText: string | null;
  lifelinesUsed: MillionaireLifelines;
  currentPrize: number;
  guaranteedPrize: number;
  finalPrize: number;
  timeRemaining: number;
  timeoutLost: boolean;
};

export function computeGuaranteedPrize(completedStepsCount: number, totalSteps = 15): number {
  if (totalSteps < 15 && totalSteps > 0) {
    if (completedStepsCount >= totalSteps) {
      return MILLIONAIRE_LADDER[Math.min(14, totalSteps - 1)].points;
    }
    const midMilestone = Math.max(3, Math.floor(totalSteps / 2));
    if (completedStepsCount >= midMilestone) {
      return MILLIONAIRE_LADDER[midMilestone - 1].points;
    }
    return 0;
  }
  if (completedStepsCount >= 15) return MILLIONAIRE_LADDER[14].points;
  if (completedStepsCount >= 10) return MILLIONAIRE_LADDER[9].points;
  if (completedStepsCount >= 5) return MILLIONAIRE_LADDER[4].points;
  return 0;
}

export function formatMillionairePrize(points: number): string {
  if (points <= 0) return "0 điểm";
  const matched = MILLIONAIRE_LADDER.find((item) => item.points === points);
  return matched ? `${matched.label} (${points.toLocaleString("vi-VN")} đ)` : `${points.toLocaleString("vi-VN")} đ`;
}

export function createMillionaireState(
  chapterId = "all",
  rng: () => number = Math.random,
  options?: DeckBuildOptions,
): MillionaireState {
  const allowCrossChapterFallback = Boolean(options?.allowCrossChapterFallback);
  const { mainQuestions, reserveQuestions } = buildMillionaireQuestionDeck(chapterId, rng, {
    allowCrossChapterFallback,
  });
  return {
    chapterId,
    allowCrossChapterFallback,
    questions: mainQuestions,
    reserveQuestions,
    currentIndex: 0,
    status: "playing",
    selectedOptionId: null,
    hiddenOptionIds: [],
    audiencePoll: null,
    expertHintText: null,
    lifelinesUsed: {
      fiftyFifty: false,
      expertHint: false,
      audiencePoll: false,
      switchQuestion: false,
    },
    currentPrize: 0,
    guaranteedPrize: 0,
    finalPrize: 0,
    timeRemaining: MILLIONAIRE_QUESTION_TIME_SECONDS,
    timeoutLost: false,
  };
}

export function answerMillionaireQuestion(
  state: MillionaireState,
  optionId: GameQuizOptionId,
): MillionaireState {
  if (state.status !== "playing") return state;
  if (state.hiddenOptionIds.includes(optionId)) return state;

  const currentQuestion = state.questions[state.currentIndex];
  if (!currentQuestion) return state;

  const isCorrect = optionId === currentQuestion.correctOptionId;
  const stepInfo = MILLIONAIRE_LADDER[state.currentIndex];

  if (isCorrect) {
    const completedCount = state.currentIndex + 1;
    const nextPrize = stepInfo ? stepInfo.points : state.currentPrize;
    const nextGuaranteed = computeGuaranteedPrize(completedCount, state.questions.length);
    const isFinalQuestion = completedCount >= state.questions.length;

    return {
      ...state,
      selectedOptionId: optionId,
      status: isFinalQuestion ? "won" : "revealed_correct",
      currentPrize: nextPrize,
      guaranteedPrize: nextGuaranteed,
      finalPrize: nextPrize,
      timeoutLost: false,
    };
  }

  const safePrize = computeGuaranteedPrize(state.currentIndex, state.questions.length);
  return {
    ...state,
    selectedOptionId: optionId,
    status: "lost",
    finalPrize: safePrize,
    timeoutLost: false,
  };
}

export function handleMillionaireTimeout(state: MillionaireState): MillionaireState {
  if (state.status !== "playing") return state;
  const safePrize = computeGuaranteedPrize(state.currentIndex, state.questions.length);
  return {
    ...state,
    status: "lost",
    timeRemaining: 0,
    finalPrize: safePrize,
    timeoutLost: true,
  };
}

export function advanceMillionaireQuestion(state: MillionaireState): MillionaireState {
  if (state.status !== "revealed_correct") return state;
  const nextIndex = state.currentIndex + 1;
  if (nextIndex >= state.questions.length) {
    return {
      ...state,
      status: "won",
      finalPrize: state.currentPrize,
    };
  }
  return {
    ...state,
    currentIndex: nextIndex,
    status: "playing",
    selectedOptionId: null,
    hiddenOptionIds: [],
    audiencePoll: null,
    expertHintText: null,
    timeRemaining: MILLIONAIRE_QUESTION_TIME_SECONDS,
    timeoutLost: false,
  };
}

export function walkAwayMillionaire(state: MillionaireState): MillionaireState {
  if (state.status !== "playing" && state.status !== "revealed_correct") return state;
  return {
    ...state,
    status: "walked_away",
    finalPrize: state.currentPrize,
  };
}

export function useLifeline5050(
  state: MillionaireState,
  rng: () => number = Math.random,
): MillionaireState {
  if (state.status !== "playing" || state.lifelinesUsed.fiftyFifty) return state;
  const currentQuestion = state.questions[state.currentIndex];
  if (!currentQuestion) return state;

  const wrongOptions = currentQuestion.options
    .map((o) => o.id)
    .filter((id) => id !== currentQuestion.correctOptionId && !state.hiddenOptionIds.includes(id));

  // Shuffle wrong options and remove 2
  const shuffled = [...wrongOptions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const toHide = shuffled.slice(0, 2);

  return {
    ...state,
    hiddenOptionIds: [...state.hiddenOptionIds, ...toHide],
    lifelinesUsed: {
      ...state.lifelinesUsed,
      fiftyFifty: true,
    },
  };
}

export function useLifelineAudiencePoll(
  state: MillionaireState,
  rng: () => number = Math.random,
): MillionaireState {
  if (state.status !== "playing" || state.lifelinesUsed.audiencePoll) return state;
  const currentQuestion = state.questions[state.currentIndex];
  if (!currentQuestion) return state;

  const visibleIds = currentQuestion.options
    .map((o) => o.id)
    .filter((id) => !state.hiddenOptionIds.includes(id));

  const poll: Record<GameQuizOptionId, number> = { A: 0, B: 0, C: 0, D: 0 };
  const correctShare = 54 + Math.floor(rng() * 22); // 54% - 75%
  poll[currentQuestion.correctOptionId] = correctShare;

  let remaining = 100 - correctShare;
  const wrongVisible = visibleIds.filter((id) => id !== currentQuestion.correctOptionId);

  wrongVisible.forEach((id, idx) => {
    if (idx === wrongVisible.length - 1) {
      poll[id] = remaining;
    } else {
      const share = Math.floor(rng() * (remaining + 1));
      poll[id] = share;
      remaining -= share;
    }
  });

  return {
    ...state,
    audiencePoll: poll,
    lifelinesUsed: {
      ...state.lifelinesUsed,
      audiencePoll: true,
    },
  };
}

export function useLifelineExpertHint(state: MillionaireState): MillionaireState {
  if (state.status !== "playing" || state.lifelinesUsed.expertHint) return state;
  const currentQuestion = state.questions[state.currentIndex];
  if (!currentQuestion) return state;

  const hintText =
    currentQuestion.expertHint ||
    `Gợi ý kiến thức: Hãy chú ý mối liên hệ bản chất trong câu hỏi (${currentQuestion.explanation.split(".")[0]}).`;

  return {
    ...state,
    expertHintText: hintText,
    lifelinesUsed: {
      ...state.lifelinesUsed,
      expertHint: true,
    },
  };
}

export function useLifelineSwitchQuestion(state: MillionaireState): MillionaireState {
  if (
    state.status !== "playing" ||
    state.lifelinesUsed.switchQuestion ||
    state.reserveQuestions.length === 0
  ) {
    return state;
  }

  const currentQuestion = state.questions[state.currentIndex];
  if (!currentQuestion) return state;

  const sameDiffIdx = state.reserveQuestions.findIndex(
    (q) => q.difficulty === currentQuestion.difficulty,
  );
  const pickIdx = sameDiffIdx >= 0 ? sameDiffIdx : 0;
  const replacement = state.reserveQuestions[pickIdx];
  const nextReserve = state.reserveQuestions.filter((_, i) => i !== pickIdx);
  const nextQuestions = [...state.questions];
  nextQuestions[state.currentIndex] = replacement;

  return {
    ...state,
    questions: nextQuestions,
    reserveQuestions: nextReserve,
    selectedOptionId: null,
    hiddenOptionIds: [],
    audiencePoll: null,
    expertHintText: null,
    timeRemaining: MILLIONAIRE_QUESTION_TIME_SECONDS,
    lifelinesUsed: {
      ...state.lifelinesUsed,
      switchQuestion: true,
    },
  };
}
