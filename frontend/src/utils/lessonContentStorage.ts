import type { DragImageActivity, ImageLabelActivity, LessonContent, LearningAssetReference } from "../types/curriculum";

export function dragImageActivityError(activity?: DragImageActivity): string | null {
  if (!activity?.backgroundUrl?.trim()) return "Hoạt động cần có ảnh nền.";
  if (activity.kind !== "label_zones") {
    return !Array.isArray(activity.pieces) || !activity.pieces.length || activity.pieces.some((piece) => !piece.label?.trim() || !piece.imageUrl)
      ? "Ảnh kéo thả cần ít nhất một phần tử có tên và hình ảnh." : null;
  }
  if (!Array.isArray(activity.zones) || !Array.isArray(activity.labels) || !activity.zones.length || activity.labels.length !== activity.zones.length) {
    return "Mỗi vùng thả cần có một nhãn chữ tương ứng.";
  }
  const zoneIds = new Set(activity.zones.map((zone) => zone.id));
  const labelIds = new Set(activity.labels.map((label) => label.id));
  if (zoneIds.size !== activity.zones.length || labelIds.size !== activity.labels.length ||
    activity.zones.some((zone) => !zone.id || ![zone.x, zone.y, zone.width, zone.height].every(Number.isFinite) ||
      zone.x < 0 || zone.y < 0 || zone.width < 5 || zone.height < 5 || zone.x + zone.width > 100 || zone.y + zone.height > 100)) {
    return "Vùng thả cần nằm trong ảnh và dùng kích thước theo tỷ lệ hợp lệ.";
  }
  if (activity.labels.some((label) => !label.id || !label.text?.trim() || !zoneIds.has(label.correctZoneId)) ||
    new Set(activity.labels.map((label) => label.correctZoneId)).size !== activity.zones.length) {
    return "Điền đủ nhãn và ghép mỗi nhãn với một vùng đúng khác nhau.";
  }
  if (activity.zones.some((zone, index) => activity.zones.slice(index + 1).some((other) =>
    zone.x < other.x + other.width && zone.x + zone.width > other.x &&
    zone.y < other.y + other.height && zone.y + zone.height > other.y,
  ))) return "Các vùng thả đang chồng nhau. Hãy điều chỉnh vị trí hoặc kích thước.";
  return null;
}

// Fingerprint nội dung để đáp án cũ không áp dụng cho activity đã đổi.
// Chỉ lưu fingerprint ngắn, tránh chép lại ảnh base64 vào bản nháp học sinh.
export function imageLabelSignature(activity: ImageLabelActivity): string {
  const value = JSON.stringify([activity.backgroundUrl, activity.zones, activity.labels]);
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16);
}

export const LESSON_CONTENT_KEY = "webstudy-v1-geo10-lesson-content";
export const LESSON_CONTENT_CHANGED_EVENT = "webstudy-lesson-content-changed";
const LEGACY_KEY = "webstudy-geo10-lesson-content-v1";

type LessonContents = Record<string, LessonContent>;

function parseContents(raw: string | null): LessonContents | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as LessonContents)
      : null;
  } catch {
    return null;
  }
}

export function loadLessonContents(): LessonContents {
  try {
    const current = parseContents(localStorage.getItem(LESSON_CONTENT_KEY));

    if (current && Object.keys(current).length > 0) return current;

    const legacy = parseContents(localStorage.getItem(LEGACY_KEY));
    if (legacy && Object.keys(legacy).length > 0) {
      try {
        localStorage.setItem(LESSON_CONTENT_KEY, JSON.stringify(legacy));
      } catch {}
      return legacy;
    }

    return current ?? {};
  } catch {
    return {};
  }
}

export function saveLessonContents(next: LessonContents): void {
  localStorage.setItem(LESSON_CONTENT_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(LESSON_CONTENT_CHANGED_EVENT));
}

const LEARNING_ASSET_PREFIX = "webstudy-asset://v1/infographic/";

export function readLearningAssetReference(value: unknown): LearningAssetReference | null {
  if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1 ||
    !("kind" in value) || value.kind !== "infographic" || !("assetId" in value) ||
    typeof value.assetId !== "string" || !value.assetId.trim() || /[\u0000-\u001f\u007f]/.test(value.assetId)) return null;
  try { encodeURIComponent(value.assetId); } catch { return null; }
  return { version: 1, kind: "infographic", assetId: value.assetId };
}

export function learningAssetReferenceHref(value: LearningAssetReference): string {
  const reference = readLearningAssetReference(value);
  if (!reference) throw new Error("Tham chiếu học liệu không hợp lệ.");
  // Escape Markdown delimiters too; IDs, including legacy Unicode IDs, stay exact.
  const id = encodeURIComponent(reference.assetId).replace(/[!'()*]/g, char =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${LEARNING_ASSET_PREFIX}${id}`;
}

export function parseLearningAssetReferenceHref(value: unknown): LearningAssetReference | null {
  if (typeof value !== "string" || !value.startsWith(LEARNING_ASSET_PREFIX)) return null;
  const encoded = value.slice(LEARNING_ASSET_PREFIX.length);
  if (!/^[A-Za-z0-9._~%-]+$/.test(encoded)) return null;
  try {
    const reference = readLearningAssetReference({ version: 1, kind: "infographic", assetId: decodeURIComponent(encoded) });
    const canonicalInput = value.replace(/%[a-f0-9]{2}/gi, code => code.toUpperCase());
    return reference && learningAssetReferenceHref(reference) === canonicalInput ? reference : null;
  } catch { return null; }
}

export function learningAssetReferenceMarkdown(value: LearningAssetReference): string {
  return `[Học liệu](${learningAssetReferenceHref(value)})`;
}
