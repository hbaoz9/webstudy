import type { GameQuizOptionId, GameQuizQuestion } from "../types";
import { buildQuizDeck } from "../data/geo10GameQuestions";

export const MANDARIN_STONE_VALUE = 10;
export const STUDENT_CELL_INDICES = [1, 2, 3, 4, 5] as const;
export const AI_CELL_INDICES = [7, 8, 9, 10, 11] as const;

export type OAnQuanCell = {
  index: number;
  isMandarin: boolean;
  stones: number;
  hasMandarin: boolean;
  label: string;
};

export type SowDirection = "left" | "right";

export type MoveSimulationResult = {
  valid: boolean;
  startIndex: number;
  direction: SowDirection;
  nextBoard: OAnQuanCell[];
  visitedPath: number[];
  relayCount: number;
  capturedCells: number[];
  capturedPoints: number;
  capturedMandarins: number;
  stopReason: "captured" | "mandarin_stop" | "double_empty_stop" | "max_steps";
};

export type OAnQuanPhase =
  | "student_turn"
  | "capture_quiz"
  | "advisor_quiz"
  | "game_over";

export type OAnQuanState = {
  chapterId: string;
  board: OAnQuanCell[];
  studentCapturedScore: number;
  aiCapturedScore: number;
  studentGeoBonusScore: number;
  correctGeoAnswers: number;
  turnCount: number;
  phase: OAnQuanPhase;
  selectedCellIndex: number | null;
  selectedDirection: SowDirection;
  questions: GameQuizQuestion[];
  questionCursor: number;
  selectedOptionId: GameQuizOptionId | null;
  lastQuizCorrect: boolean | null;
  lastMoveSummary: string;
  lastAiMoveSummary: string | null;
  lastStudentSimulation?: MoveSimulationResult | null;
  lastAiSimulation?: MoveSimulationResult | null;
  pendingCapturePoints: number;
  recommendedMove: { cellIndex: number; direction: SowDirection; reason: string } | null;
  winner: "student" | "ai" | "draw" | null;
};

export function createInitialOAnQuanBoard(): OAnQuanCell[] {
  return [
    { index: 0, isMandarin: true, stones: 0, hasMandarin: true, label: "Quan Trái" },
    { index: 1, isMandarin: false, stones: 5, hasMandarin: false, label: "Ô dân 1" },
    { index: 2, isMandarin: false, stones: 5, hasMandarin: false, label: "Ô dân 2" },
    { index: 3, isMandarin: false, stones: 5, hasMandarin: false, label: "Ô dân 3" },
    { index: 4, isMandarin: false, stones: 5, hasMandarin: false, label: "Ô dân 4" },
    { index: 5, isMandarin: false, stones: 5, hasMandarin: false, label: "Ô dân 5" },
    { index: 6, isMandarin: true, stones: 0, hasMandarin: true, label: "Quan Phải" },
    { index: 7, isMandarin: false, stones: 5, hasMandarin: false, label: "Ô máy 7" },
    { index: 8, isMandarin: false, stones: 5, hasMandarin: false, label: "Ô máy 8" },
    { index: 9, isMandarin: false, stones: 5, hasMandarin: false, label: "Ô máy 9" },
    { index: 10, isMandarin: false, stones: 5, hasMandarin: false, label: "Ô máy 10" },
    { index: 11, isMandarin: false, stones: 5, hasMandarin: false, label: "Ô máy 11" },
  ];
}

export function isCellEmpty(cell: OAnQuanCell): boolean {
  return cell.stones <= 0 && !cell.hasMandarin;
}

export function cellPointValue(cell: OAnQuanCell): number {
  return cell.stones + (cell.hasMandarin ? MANDARIN_STONE_VALUE : 0);
}

export function cloneBoard(board: readonly OAnQuanCell[]): OAnQuanCell[] {
  return board.map((cell) => ({ ...cell }));
}

/**
 * Với hàng dưới (Học sinh, ô 1..5):
 * - "right" đi sang phải: 1 -> 2 -> 3 -> 4 -> 5 -> 6 (delta = +1)
 * - "left" đi sang trái: 5 -> 4 -> 3 -> 2 -> 1 -> 0 (delta = -1)
 * Với hàng trên (Máy, ô 7..11, hiển thị từ phải qua trái theo vòng tròn):
 * - "right" trên giao diện (về phía Quan Phải 6): delta = -1
 * - "left" trên giao diện (về phía Quan Trái 0): delta = +1
 */
export function getStepDelta(startIndex: number, direction: SowDirection): 1 | -1 {
  const isStudentSide = startIndex >= 1 && startIndex <= 5;
  if (isStudentSide) {
    return direction === "right" ? 1 : -1;
  }
  return direction === "left" ? 1 : -1;
}

export function stepIndex(currentIndex: number, delta: 1 | -1): number {
  return (currentIndex + delta + 12) % 12;
}

export function simulateOAnQuanMove(
  boardInput: readonly OAnQuanCell[],
  startIndex: number,
  direction: SowDirection,
): MoveSimulationResult {
  const board = cloneBoard(boardInput);
  const startCell = board[startIndex];

  if (!startCell || startCell.isMandarin || startCell.stones <= 0) {
    return {
      valid: false,
      startIndex,
      direction,
      nextBoard: board,
      visitedPath: [],
      relayCount: 0,
      capturedCells: [],
      capturedPoints: 0,
      capturedMandarins: 0,
      stopReason: "double_empty_stop",
    };
  }

  const delta = getStepDelta(startIndex, direction);
  let hand = startCell.stones;
  startCell.stones = 0;

  let currentIndex = startIndex;
  const visitedPath: number[] = [];
  let relayCount = 0;
  const capturedCells: number[] = [];
  let capturedPoints = 0;
  let capturedMandarins = 0;
  let stopReason: MoveSimulationResult["stopReason"] = "double_empty_stop";

  const MAX_RELAYS = 40;
  while (hand > 0 && relayCount < MAX_RELAYS) {
    while (hand > 0) {
      currentIndex = stepIndex(currentIndex, delta);
      board[currentIndex].stones += 1;
      hand -= 1;
      visitedPath.push(currentIndex);
    }

    const nextIdx = stepIndex(currentIndex, delta);
    const nextCell = board[nextIdx];

    if (!isCellEmpty(nextCell)) {
      if (nextCell.isMandarin) {
        stopReason = "mandarin_stop";
        break;
      }
      // Rải tiếp từ ô dân kế tiếp
      hand = nextCell.stones;
      nextCell.stones = 0;
      currentIndex = nextIdx;
      relayCount += 1;
      continue;
    }

    // Ô kế tiếp trống -> kiểm tra ô sau đó để ăn quân
    let emptyCheckIdx = nextIdx;
    let captureIdx = stepIndex(emptyCheckIdx, delta);

    if (isCellEmpty(board[captureIdx])) {
      // Hai ô trống liên tiếp -> dừng lượt
      stopReason = "double_empty_stop";
      break;
    }

    // Ăn quân (hỗ trợ ăn liên hoàn nếu sau ô vừa ăn lại là 1 ô trống + 1 ô có quân)
    while (isCellEmpty(board[emptyCheckIdx]) && !isCellEmpty(board[captureIdx])) {
      const target = board[captureIdx];
      capturedPoints += cellPointValue(target);
      if (target.hasMandarin) capturedMandarins += 1;
      capturedCells.push(captureIdx);

      target.stones = 0;
      target.hasMandarin = false;

      emptyCheckIdx = stepIndex(captureIdx, delta);
      captureIdx = stepIndex(emptyCheckIdx, delta);
    }

    stopReason = "captured";
    break;
  }

  if (relayCount >= MAX_RELAYS) {
    stopReason = "max_steps";
  }

  return {
    valid: true,
    startIndex,
    direction,
    nextBoard: board,
    visitedPath,
    relayCount,
    capturedCells,
    capturedPoints,
    capturedMandarins,
    stopReason,
  };
}

export function isGameFinished(board: readonly OAnQuanCell[]): boolean {
  return isCellEmpty(board[0]) && isCellEmpty(board[6]);
}

export function ensureSideHasStones(
  boardInput: readonly OAnQuanCell[],
  side: "student" | "ai",
  currentScore: number,
): { board: OAnQuanCell[]; updatedScore: number; reseeded: boolean } {
  const board = cloneBoard(boardInput);
  const indices = side === "student" ? STUDENT_CELL_INDICES : AI_CELL_INDICES;
  const hasAny = indices.some((idx) => board[idx].stones > 0);
  if (hasAny) {
    return { board, updatedScore: currentScore, reseeded: false };
  }
  for (const idx of indices) {
    board[idx].stones = 1;
  }
  return {
    board,
    updatedScore: currentScore - 5,
    reseeded: true,
  };
}

export function findBestMoveForSide(
  board: readonly OAnQuanCell[],
  side: "student" | "ai",
): { cellIndex: number; direction: SowDirection; scoreEstimate: number; simulation: MoveSimulationResult } | null {
  const indices = side === "student" ? STUDENT_CELL_INDICES : AI_CELL_INDICES;
  const directions: SowDirection[] = ["left", "right"];
  let best: {
    cellIndex: number;
    direction: SowDirection;
    scoreEstimate: number;
    simulation: MoveSimulationResult;
  } | null = null;

  for (const cellIndex of indices) {
    if (board[cellIndex].stones <= 0) continue;
    for (const direction of directions) {
      const sim = simulateOAnQuanMove(board, cellIndex, direction);
      if (!sim.valid) continue;
      // Ưu tiên nước ăn được nhiều điểm + giữ quân bên phần sân mình
      const ownRemaining = indices.reduce((sum, idx) => sum + sim.nextBoard[idx].stones, 0);
      const scoreEstimate = sim.capturedPoints * 10 + sim.capturedMandarins * 15 + ownRemaining * 0.5;
      if (!best || scoreEstimate > best.scoreEstimate) {
        best = { cellIndex, direction, scoreEstimate, simulation: sim };
      }
    }
  }
  return best;
}

function finalizeWhenBothMandarinsEmpty(state: OAnQuanState): OAnQuanState {
  const board = cloneBoard(state.board);
  let studentSweep = 0;
  let aiSweep = 0;

  for (const idx of STUDENT_CELL_INDICES) {
    studentSweep += board[idx].stones;
    board[idx].stones = 0;
  }
  for (const idx of AI_CELL_INDICES) {
    aiSweep += board[idx].stones;
    board[idx].stones = 0;
  }

  const finalStudent = state.studentCapturedScore + studentSweep + state.studentGeoBonusScore;
  const finalAi = state.aiCapturedScore + aiSweep;
  const winner: OAnQuanState["winner"] =
    finalStudent > finalAi ? "student" : finalStudent < finalAi ? "ai" : "draw";

  return {
    ...state,
    board,
    studentCapturedScore: state.studentCapturedScore + studentSweep,
    aiCapturedScore: state.aiCapturedScore + aiSweep,
    phase: "game_over",
    selectedCellIndex: null,
    winner,
    lastMoveSummary: `${state.lastMoveSummary} Hai ô Quan đã hết — thu tàn dân (Học sinh +${studentSweep}, Máy +${aiSweep}).`,
  };
}

function runAiTurnInternal(stateAfterStudent: OAnQuanState): OAnQuanState {
  if (isGameFinished(stateAfterStudent.board)) {
    return finalizeWhenBothMandarinsEmpty(stateAfterStudent);
  }

  // Kiểm tra rải lại dân cho Máy nếu 5 ô của Máy trống
  const aiReseed = ensureSideHasStones(
    stateAfterStudent.board,
    "ai",
    stateAfterStudent.aiCapturedScore,
  );
  let workingBoard = aiReseed.board;
  let aiScore = aiReseed.updatedScore;

  const aiChoice = findBestMoveForSide(workingBoard, "ai");
  let aiSummary = "Máy không còn nước đi hợp lệ.";
  let aiSim: MoveSimulationResult | null = null;

  if (aiChoice) {
    const sim = aiChoice.simulation;
    aiSim = sim;
    workingBoard = sim.nextBoard;
    aiScore += sim.capturedPoints;
    const dirLabel = aiChoice.direction === "left" ? "về phía Quan Trái" : "về phía Quan Phải";
    aiSummary =
      sim.capturedPoints > 0
        ? `Máy đi Ô ${aiChoice.cellIndex} (${dirLabel}) và ăn được ${sim.capturedPoints} điểm.`
        : `Máy đi Ô ${aiChoice.cellIndex} (${dirLabel}), không ăn được quân.`;
  }

  const afterAiState: OAnQuanState = {
    ...stateAfterStudent,
    board: workingBoard,
    aiCapturedScore: aiScore,
    lastAiMoveSummary: aiSummary,
    lastAiSimulation: aiSim,
  };

  if (isGameFinished(workingBoard)) {
    return finalizeWhenBothMandarinsEmpty(afterAiState);
  }

  // Kiểm tra rải lại dân cho Học sinh trước lượt kế tiếp
  const studentReseed = ensureSideHasStones(
    afterAiState.board,
    "student",
    afterAiState.studentCapturedScore,
  );

  const defaultCell =
    STUDENT_CELL_INDICES.find((idx) => studentReseed.board[idx].stones > 0) ?? null;

  return {
    ...afterAiState,
    board: studentReseed.board,
    studentCapturedScore: studentReseed.updatedScore,
    phase: "student_turn",
    selectedCellIndex: defaultCell,
  };
}

export function createOAnQuanState(
  chapterId = "all",
  rng: () => number = Math.random,
  allowCrossChapterFallback = false,
): OAnQuanState {
  const questions = buildQuizDeck(20, chapterId, rng, { allowCrossChapterFallback });
  return {
    chapterId,
    board: createInitialOAnQuanBoard(),
    studentCapturedScore: 0,
    aiCapturedScore: 0,
    studentGeoBonusScore: 0,
    correctGeoAnswers: 0,
    turnCount: 0,
    phase: "student_turn",
    selectedCellIndex: 3,
    selectedDirection: "right",
    questions,
    questionCursor: 0,
    selectedOptionId: null,
    lastQuizCorrect: null,
    lastMoveSummary: "Chọn một ô dân bên dưới (Ô 1 – Ô 5) và hướng rải Trái hoặc Phải để bắt đầu!",
    lastAiMoveSummary: null,
    lastStudentSimulation: null,
    lastAiSimulation: null,
    pendingCapturePoints: 0,
    recommendedMove: null,
    winner: null,
  };
}

export function executeStudentOAnQuanMove(
  state: OAnQuanState,
  cellIndex: number,
  direction: SowDirection,
): OAnQuanState {
  if (state.phase !== "student_turn") return state;
  if (!STUDENT_CELL_INDICES.includes(cellIndex as (typeof STUDENT_CELL_INDICES)[number])) {
    return state;
  }

  const sim = simulateOAnQuanMove(state.board, cellIndex, direction);
  if (!sim.valid) return state;

  const dirText = direction === "right" ? "sang Phải" : "sang Trái";
  const nextTurnCount = state.turnCount + 1;
  const nextStudentScore = state.studentCapturedScore + sim.capturedPoints;

  const summary =
    sim.capturedPoints > 0
      ? `Bạn rải Ô dân ${cellIndex} (${dirText}) và ăn được ${sim.capturedPoints} điểm${
          sim.capturedMandarins > 0 ? " (có ăn Quan!)" : ""
        }.`
      : `Bạn rải Ô dân ${cellIndex} (${dirText}), dừng nước đi sau ${sim.relayCount + 1} nhịp.`;

  const updatedState: OAnQuanState = {
    ...state,
    board: sim.nextBoard,
    studentCapturedScore: nextStudentScore,
    turnCount: nextTurnCount,
    selectedCellIndex: cellIndex,
    selectedDirection: direction,
    recommendedMove: null,
    lastMoveSummary: summary,
    lastStudentSimulation: sim,
  };

  // Nếu học sinh ăn được quân -> mở câu hỏi Địa lí 10 để nhận điểm thưởng học thuật!
  if (sim.capturedPoints > 0 && state.questionCursor < state.questions.length) {
    return {
      ...updatedState,
      phase: "capture_quiz",
      pendingCapturePoints: sim.capturedPoints,
      selectedOptionId: null,
      lastQuizCorrect: null,
    };
  }

  return runAiTurnInternal(updatedState);
}

export function requestGeographyMoveAdvisor(state: OAnQuanState): OAnQuanState {
  if (state.phase !== "student_turn") return state;
  if (state.questionCursor >= state.questions.length) return state;
  return {
    ...state,
    phase: "advisor_quiz",
    selectedOptionId: null,
    lastQuizCorrect: null,
  };
}

export function answerOAnQuanQuiz(
  state: OAnQuanState,
  optionId: GameQuizOptionId,
): OAnQuanState {
  if (state.phase !== "capture_quiz" && state.phase !== "advisor_quiz") return state;
  const currentQuestion = state.questions[state.questionCursor];
  if (!currentQuestion) return state;

  const isCorrect = optionId === currentQuestion.correctOptionId;

  if (state.phase === "advisor_quiz") {
    const best = findBestMoveForSide(state.board, "student");
    const recommendation =
      isCorrect && best
        ? {
            cellIndex: best.cellIndex,
            direction: best.direction,
            reason:
              best.simulation.capturedPoints > 0
                ? `Nên chọn Ô dân ${best.cellIndex} rải sang ${
                    best.direction === "right" ? "Phải" : "Trái"
                  } để ăn ngay ${best.simulation.capturedPoints} điểm!`
                : `Nên chọn Ô dân ${best.cellIndex} rải sang ${
                    best.direction === "right" ? "Phải" : "Trái"
                  } để giữ thế chủ động trên sân nhà.`,
          }
        : null;

    return {
      ...state,
      selectedOptionId: optionId,
      lastQuizCorrect: isCorrect,
      correctGeoAnswers: state.correctGeoAnswers + (isCorrect ? 1 : 0),
      studentGeoBonusScore: state.studentGeoBonusScore + (isCorrect ? 3 : 0),
      recommendedMove: recommendation,
      selectedCellIndex: recommendation ? recommendation.cellIndex : state.selectedCellIndex,
      selectedDirection: recommendation ? recommendation.direction : state.selectedDirection,
    };
  }

  // capture_quiz
  const bonusPoints = isCorrect ? Math.max(5, Math.round(state.pendingCapturePoints * 0.5)) : 0;
  return {
    ...state,
    selectedOptionId: optionId,
    lastQuizCorrect: isCorrect,
    correctGeoAnswers: state.correctGeoAnswers + (isCorrect ? 1 : 0),
    studentGeoBonusScore: state.studentGeoBonusScore + bonusPoints,
  };
}

export function completeOAnQuanQuizModal(state: OAnQuanState): OAnQuanState {
  if (state.phase === "advisor_quiz") {
    return {
      ...state,
      phase: "student_turn",
      questionCursor: (state.questionCursor + 1) % state.questions.length,
      selectedOptionId: null,
      lastQuizCorrect: null,
    };
  }

  if (state.phase === "capture_quiz") {
    const advancedCursorState: OAnQuanState = {
      ...state,
      questionCursor: (state.questionCursor + 1) % state.questions.length,
      pendingCapturePoints: 0,
      selectedOptionId: null,
      lastQuizCorrect: null,
    };
    return runAiTurnInternal(advancedCursorState);
  }

  return state;
}
