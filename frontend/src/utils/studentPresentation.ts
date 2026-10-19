import type { StudentAssignmentPhase } from "./studentAssignments";

export function getStudentInitials(name: string | undefined): string {
  const letters = name?.normalize("NFC").trim().split(/\s+/u)
    .map((part) => part.match(/\p{L}/u)?.[0])
    .filter((letter): letter is string => Boolean(letter)) ?? [];
  if (letters.length === 0) return "HS";
  const first = letters[0];
  const last = letters.length > 1 ? letters[letters.length - 1] : "";
  return `${first}${last}`.toLocaleUpperCase("vi");
}

export type StudentBadgeTone = "success" | "warning" | "neutral" | "danger" | "info";

export function getAssignmentBadge(phase: StudentAssignmentPhase): { label: string; tone: StudentBadgeTone } {
  switch (phase) {
    case "graded": return { label: "Đã chấm", tone: "success" };
    case "submitted": return { label: "Đã nộp", tone: "info" };
    case "unavailable": return { label: "Chưa khả dụng", tone: "neutral" };
    case "expired": return { label: "Hết hạn", tone: "warning" };
    case "draft_error": return { label: "Nháp cần kiểm tra", tone: "danger" };
    case "in_progress": return { label: "Đang làm", tone: "info" };
    case "not_started": return { label: "Chưa làm", tone: "neutral" };
  }
}
