import { useState } from "react";
import { Link } from "react-router-dom";
import type { SimulationLessonBlock } from "../../types/curriculum";
import { getSimulation } from "../../features/simulations/registry";
import { SimulationViewer } from "../../features/simulations/SimulationViewer";

export function StudentLessonSimulations({ lessonId, blocks }: {
  lessonId: string;
  blocks: SimulationLessonBlock[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (!blocks.length) return null;

  return <section className="space-y-4" aria-label="Mô phỏng trong bài học">
    <h3 className="font-extrabold text-ink">Khám phá mô phỏng</h3>
    {blocks.map((block) => {
      const model = getSimulation(block.modelId);
      if (!model) return null;
      return <div key={block.id} className="min-w-0 rounded-2xl border border-line bg-white p-4 sm:p-5">
        <h4 className="font-bold text-ink">{model.title}</h4>
        {block.observationGuide && <p className="mt-2 whitespace-pre-wrap text-sm text-secondary">{block.observationGuide}</p>}
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" onClick={() => setOpenId(openId === block.id ? null : block.id)}
            className="min-h-11 rounded-xl bg-emerald px-4 text-sm font-bold text-white">
            {openId === block.id ? "Thu mô phỏng" : "Khám phá mô phỏng"}
          </button>
          <Link to={`/student/3d-lab/${encodeURIComponent(model.id)}?lesson=${encodeURIComponent(lessonId)}`}
            className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-semibold text-ink">
            Mở toàn màn hình
          </Link>
        </div>
        {openId === block.id && <div className="mt-4"><SimulationViewer modelId={model.id} onClose={() => setOpenId(null)} /></div>}
      </div>;
    })}
  </section>;
}
