import type { GameDeviceProgress, GameId, GameProgressMap, GameSessionRecord } from "./types";

const STORAGE_PREFIX = "webstudy-game-progress-v1";
const MAX_HISTORY_PER_GAME = 15;

export const GAME_IDS: GameId[] = [
  "millionaire",
  "word-catch",
  "penalty-quiz",
  "o-an-quan",
];

export function gameProgressStorageKey(userId = "guest"): string {
  const safeId = userId.trim() || "guest";
  return `${STORAGE_PREFIX}:${encodeURIComponent(safeId)}`;
}

export function createEmptyGameProgress(): GameProgressMap {
  return {
    millionaire: {
      gameId: "millionaire",
      highScore: 0,
      gamesPlayed: 0,
      wins: 0,
      lastPlayedAt: null,
      recentHistory: [],
    },
    "word-catch": {
      gameId: "word-catch",
      highScore: 0,
      gamesPlayed: 0,
      wins: 0,
      lastPlayedAt: null,
      recentHistory: [],
    },
    "penalty-quiz": {
      gameId: "penalty-quiz",
      highScore: 0,
      gamesPlayed: 0,
      wins: 0,
      lastPlayedAt: null,
      recentHistory: [],
    },
    "o-an-quan": {
      gameId: "o-an-quan",
      highScore: 0,
      gamesPlayed: 0,
      wins: 0,
      lastPlayedAt: null,
      recentHistory: [],
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sanitizeRecord(raw: unknown, expectedGameId: GameId): GameSessionRecord | null {
  if (!isObject(raw)) return null;
  const id = typeof raw.id === "string" && raw.id ? raw.id : null;
  const score = typeof raw.score === "number" && Number.isFinite(raw.score) ? Math.max(0, Math.round(raw.score)) : null;
  const maxScore = typeof raw.maxScore === "number" && Number.isFinite(raw.maxScore) ? Math.max(0, Math.round(raw.maxScore)) : 0;
  const won = typeof raw.won === "boolean" ? raw.won : false;
  const summary = typeof raw.summary === "string" ? raw.summary.slice(0, 240) : "";
  const completedAt = typeof raw.completedAt === "string" ? raw.completedAt : "";
  const chapterId = typeof raw.chapterId === "string" && raw.chapterId ? raw.chapterId : undefined;
  if (!id || score === null || !completedAt) return null;
  return {
    id,
    gameId: expectedGameId,
    score,
    maxScore,
    won,
    summary,
    chapterId,
    completedAt,
  };
}

function sanitizeGameEntry(raw: unknown, gameId: GameId): GameDeviceProgress {
  const fallback = createEmptyGameProgress()[gameId];
  if (!isObject(raw)) return fallback;
  const highScore = typeof raw.highScore === "number" && Number.isFinite(raw.highScore)
    ? Math.max(0, Math.round(raw.highScore))
    : 0;
  const gamesPlayed = typeof raw.gamesPlayed === "number" && Number.isFinite(raw.gamesPlayed)
    ? Math.max(0, Math.round(raw.gamesPlayed))
    : 0;
  const wins = typeof raw.wins === "number" && Number.isFinite(raw.wins)
    ? Math.max(0, Math.round(raw.wins))
    : 0;
  const lastPlayedAt = typeof raw.lastPlayedAt === "string" && raw.lastPlayedAt ? raw.lastPlayedAt : null;
  const recentHistory = Array.isArray(raw.recentHistory)
    ? raw.recentHistory
        .map((item) => sanitizeRecord(item, gameId))
        .filter((item): item is GameSessionRecord => item !== null)
        .slice(0, MAX_HISTORY_PER_GAME)
    : [];

  return {
    gameId,
    highScore,
    gamesPlayed,
    wins,
    lastPlayedAt,
    recentHistory,
  };
}

export function loadGameProgress(userId = "guest"): GameProgressMap {
  const empty = createEmptyGameProgress();
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(gameProgressStorageKey(userId));
    if (!raw) return empty;
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed)) return empty;
    return {
      millionaire: sanitizeGameEntry(parsed.millionaire, "millionaire"),
      "word-catch": sanitizeGameEntry(parsed["word-catch"], "word-catch"),
      "penalty-quiz": sanitizeGameEntry(parsed["penalty-quiz"], "penalty-quiz"),
      "o-an-quan": sanitizeGameEntry(parsed["o-an-quan"], "o-an-quan"),
    };
  } catch {
    return empty;
  }
}

export function recordGameResult(
  userId: string | undefined,
  input: Omit<GameSessionRecord, "id" | "completedAt"> & { completedAt?: string },
): GameProgressMap {
  const current = loadGameProgress(userId);
  const entry = current[input.gameId];
  const completedAt = input.completedAt ?? new Date().toISOString();
  const safeScore = Math.max(0, Math.round(input.score));
  const newRecord: GameSessionRecord = {
    id: `${input.gameId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    gameId: input.gameId,
    score: safeScore,
    maxScore: Math.max(0, Math.round(input.maxScore)),
    won: input.won,
    summary: input.summary,
    chapterId: input.chapterId,
    completedAt,
  };

  const updatedEntry: GameDeviceProgress = {
    gameId: input.gameId,
    highScore: Math.max(entry.highScore, safeScore),
    gamesPlayed: entry.gamesPlayed + 1,
    wins: entry.wins + (input.won ? 1 : 0),
    lastPlayedAt: completedAt,
    recentHistory: [newRecord, ...entry.recentHistory].slice(0, MAX_HISTORY_PER_GAME),
  };

  const next: GameProgressMap = {
    ...current,
    [input.gameId]: updatedEntry,
  };

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(gameProgressStorageKey(userId), JSON.stringify(next));
    } catch {
      // Trò chơi vẫn hoạt động bình thường nếu trình duyệt chặn localStorage.
    }
  }

  return next;
}

export function clearGameProgress(userId = "guest"): GameProgressMap {
  const empty = createEmptyGameProgress();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(gameProgressStorageKey(userId));
    } catch {
      // Ignore storage error
    }
  }
  return empty;
}
