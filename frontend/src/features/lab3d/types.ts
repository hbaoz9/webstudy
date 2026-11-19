export type Lab3DModelId =
  | "earth-rotation"
  | "earth-layers"
  | "plate-tectonics"
  | "atmosphere-layers";

export type TectonicBoundaryMode = "convergent" | "divergent" | "transform";

export type Lab3DCameraPreset = {
  id: string;
  label: string;
  theta: number;
  phi: number;
  radius: number;
};

export type Lab3DPredictionOption = {
  id: string;
  label: string;
  isCorrect: boolean;
  feedback: string;
};

export type Lab3DLearningActivity = {
  id: string;
  title: string;
  observePrompt: string;
  predictQuestion: string;
  predictions: Lab3DPredictionOption[];
  experimentActionLabel: string;
  experimentPreset: {
    hotspotId?: string;
    speed?: number;
    explodeFactor?: number;
    tectonicMode?: TectonicBoundaryMode;
    showGridLines?: boolean;
    isPaused?: boolean;
    cameraPresetId?: string;
  };
  resultSummary: string;
  scientificExplanation: string;
};

export type Lab3DHotspot = {
  id: string;
  label: string;
  shortTag: string;
  depthOrAltitudeLabel: string;
  temperatureOrStatLabel: string;
  summary: string;
  details: string[];
  colorHex: string;
  svgPos: { x: number; y: number };
};

export type Lab3DModelConfig = {
  id: Lab3DModelId;
  slug: Lab3DModelId;
  title: string;
  subtitle: string;
  chapterId: string;
  lessonId: string;
  lessonTitle: string;
  badge: string;
  accentColor: string;
  description: string;
  scientificSimulationNote: string;
  keyTakeaways: string[];
  observationGuide: string[];
  cameraPresets: Lab3DCameraPreset[];
  learningActivities: Lab3DLearningActivity[];
  hotspots: Lab3DHotspot[];
};
