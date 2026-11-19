import type { QuestionDifficulty } from "../../types/question";

export type GameId =
  | "millionaire"
  | "word-catch"
  | "penalty-quiz"
  | "o-an-quan";

export type GameMetadata = {
  id: GameId;
  slug: GameId;
  title: string;
  badge: string;
  description: string;
  rulesSummary: string[];
  accentColor: string;
  accentBg: string;
  buttonBg: string;
  questionCountLabel: string;
};

export type GameQuizOptionId = "A" | "B" | "C" | "D";

export type GameQuizOption = {
  id: GameQuizOptionId;
  text: string;
};

export type GameQuizQuestion = {
  id: string;
  type: "single_choice";
  chapterId: string;
  lessonId: string;
  difficulty: QuestionDifficulty;
  content: string;
  options: [GameQuizOption, GameQuizOption, GameQuizOption, GameQuizOption];
  correctOptionId: GameQuizOptionId;
  explanation: string;
  expertHint?: string;
};

export type WordIllustrationKind =
  | "halong-karst"
  | "lithosphere-plates"
  | "atmosphere-layers"
  | "ocean-tide"
  | "trade-winds"
  | "urbanization"
  | "feralit-soil"
  | "biosphere"
  | "digital-map"
  | "exogenic-forces"
  | "orographic-rain"
  | "population-pyramid"
  | "prime-meridian"
  | "green-growth"
  | "map-projection"
  | "coriolis-force"
  | "warm-ocean-current"
  | "altitudinal-zonation"
  | "latitudinal-zonation"
  | "economic-structure"
  | "gdp-output"
  | "green-agriculture"
  | "protection-forest"
  | "industrial-park"
  | "renewable-energy"
  | "logistics-supply"
  | "e-commerce";

export type WordPuzzleVisualClue = {
  badge: string;
  title: string;
  caption: string;
  motif:
    | "sun-summer"
    | "dragon-islands"
    | "rock-crystal"
    | "globe-shell"
    | "layers-sky"
    | "shield-earth"
    | "water-drop"
    | "moon-waves"
    | "sail-wind"
    | "merchant-route"
    | "city-towers"
    | "arrow-expand"
    | "red-soil"
    | "fe-al-atoms"
    | "sprout-life"
    | "sphere-harmony"
    | "compass-map"
    | "binary-screen"
    | "rain-cloud"
    | "mountain-barrier"
    | "pyramid-steps"
    | "age-gender-bars"
    | "growth-chart"
    | "eco-leaf"
    | "light-projector"
    | "flat-grid"
    | "spinning-globe"
    | "deflect-arrows"
    | "clock-zero"
    | "time-zones"
    | "magma-core"
    | "uplift-mountain"
    | "ocean-stream"
    | "thermometer-hot"
    | "balance-law"
    | "snow-peak-belts"
    | "sun-angles"
    | "latitude-bands"
    | "gear-system"
    | "three-sectors"
    | "sigma-sum"
    | "factory-goods"
    | "rice-field"
    | "shield-trees"
    | "industrial-gate"
    | "solar-wind"
    | "container-port"
    | "shopping-network";
  accentHex: string;
};

export type WordCatchPuzzle = {
  id: string;
  chapterId: string;
  lessonId: string;
  difficulty: QuestionDifficulty;
  categoryLabel: string;
  answerDisplay: string;
  hint: string;
  explanation: string;
  illustrationKind: WordIllustrationKind;
  visualClues?: [WordPuzzleVisualClue, WordPuzzleVisualClue];
};

export type ChapterDeckAvailability = {
  chapterId: string;
  chapterTitle: string;
  availableCount: number;
  standardRequiredCount: number;
  isStrictlySingleChapter: boolean;
  isShortOfStandard: boolean;
};

export type GameSessionRecord = {
  id: string;
  gameId: GameId;
  score: number;
  maxScore: number;
  won: boolean;
  summary: string;
  chapterId?: string;
  completedAt: string;
};

export type GameDeviceProgress = {
  gameId: GameId;
  highScore: number;
  gamesPlayed: number;
  wins: number;
  lastPlayedAt: string | null;
  recentHistory: GameSessionRecord[];
};

export type GameProgressMap = Record<GameId, GameDeviceProgress>;
