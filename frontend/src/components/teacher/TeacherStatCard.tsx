import type { LucideIcon } from "lucide-react";

type StatTone = "green" | "slate" | "amber";

type TeacherStatCardProps = {
  label: string;
  value: number | string;
  description: string;
  icon: LucideIcon;
  tone: StatTone;
};

const toneClasses: Record<StatTone, string> = {
  green: "bg-emerald/10 text-emerald",
  slate: "bg-slate-100 text-ink",
  amber: "bg-amber/10 text-amber",
};

export function TeacherStatCard({
  label,
  value,
  description,
  icon: Icon,
  tone,
}: TeacherStatCardProps) {
  return (
    <article className="flex min-h-32 items-center justify-between rounded-2xl border border-line bg-white p-5 shadow-card">
      <div>
        <p className="text-sm font-semibold text-secondary">{label}</p>

        <p className="mt-2 text-3xl font-extrabold text-ink">{value}</p>

        <p className="mt-2 text-xs text-muted">{description}</p>
      </div>

      <span
        className={`grid size-12 place-items-center rounded-full ${toneClasses[tone]}`}
      >
        <Icon className="size-6" />
      </span>
    </article>
  );
}
