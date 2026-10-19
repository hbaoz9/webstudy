import type { ReactNode } from "react";

export default function StudentPageHeader({ title, description }: { title: ReactNode; description: ReactNode }) {
  return <header>
    <h1 className="text-2xl font-extrabold text-ink">{title}</h1>
    <p className="mt-2 text-sm text-secondary">{description}</p>
  </header>;
}
