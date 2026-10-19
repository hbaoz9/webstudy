import type { StudentBadgeTone } from "../../utils/studentPresentation";

const toneClasses: Record<StudentBadgeTone, string> = {
  success: "bg-emerald-50 text-emerald-800",
  warning: "bg-amber-50 text-amber-800",
  neutral: "bg-slate-100 text-slate-700",
  danger: "bg-rose-50 text-rose-800",
  info: "bg-sky-50 text-sky-800",
};

export default function StudentStatusBadge({ label, tone }: { label: string; tone: StudentBadgeTone }) {
  return <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${toneClasses[tone]}`}>{label}</span>;
}
