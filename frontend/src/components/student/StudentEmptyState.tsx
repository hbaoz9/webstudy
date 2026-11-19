import { ArrowRight, Compass } from "lucide-react";
import { Link } from "react-router-dom";

export function StudentEmptyState({ title, description, to, action }: {
  title: string; description: string; to?: string; action?: string;
}) {
  return <section className="relative overflow-hidden rounded-3xl border border-line bg-white px-6 py-10 shadow-card sm:px-10">
    <div aria-hidden="true" className="absolute -right-12 -top-12 size-44 rounded-full border-[24px] border-emerald/10" />
    <div className="relative max-w-lg">
      <span className="inline-grid size-12 place-items-center rounded-2xl bg-emerald/10 text-emerald"><Compass className="size-6" /></span>
      <h2 className="mt-5 text-xl font-extrabold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-secondary">{description}</p>
      {to && action && <Link to={to} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald px-5 py-2 text-sm font-bold text-white hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald">
        {action}<ArrowRight className="size-4" />
      </Link>}
    </div>
  </section>;
}
