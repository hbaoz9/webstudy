export type CurriculumPart = {
  id: string;
  number: number;
  title: string;
};

export type CurriculumChapter = {
  id: string;
  partId: string;
  number: number;
  title: string;
};

export type CurriculumLesson = {
  id: string;
  chapterId: string;
  number: number;
  title: string;
};

export type DragImagePiece = {
  id: string;
  label: string;
  imageUrl: string;
};

export type ImageDropZone = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ImageLabelActivity = {
  kind: "label_zones";
  backgroundUrl: string;
  pieces: DragImagePiece[];
  zones: ImageDropZone[];
  labels: { id: string; text: string; correctZoneId: string }[];
};

export type DragImageActivity = ImageLabelActivity | {
  kind?: "image_pieces";
  backgroundUrl: string;
  pieces: DragImagePiece[];
};

export type LessonTextFormat = "markdown";

// Stored inside the lesson body; no Blob or temporary URL is copied into it.
export type LearningAssetReference = {
  version: 1;
  kind: "infographic";
  assetId: string;
};

export type LessonSection = {
  id: string;
  title: string;
  content: string;
  contentFormat?: LessonTextFormat;
  keyPoints: string[];
  imageUrl?: string;
  imageCaption?: string;
  imageMode?: "static" | "drag_drop";
  dragImageActivity?: DragImageActivity;
  videoUrl?: string;
};

export type LessonContent = {
  lessonId: string;
  objectives: string[];
  keyPoints: string[];
  explanation: string;
  explanationFormat?: LessonTextFormat;
  sections?: LessonSection[];
  status: "draft" | "published";
  updatedAt: string;
  // Keep a saved teacher draft alongside the content visible to students.
  draft?: Omit<LessonContent, "draft">;
  diagramLayout?: "mindMap" | "logicalStructure" | "organizationStructure";
  diagramDisplay?:
    | { source: "auto" }
    | { source: "uploaded"; infographicId: string };
};
