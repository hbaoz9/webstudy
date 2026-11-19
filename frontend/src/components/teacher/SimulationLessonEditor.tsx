import { useState } from "react";
import type { SimulationLessonBlock } from "../../types/curriculum";
import { SIMULATIONS, getSimulation } from "../../features/simulations/registry";
import { SimulationViewer } from "../../features/simulations/SimulationViewer";

export function SimulationLessonEditor({ value, onChange }: {
  value: SimulationLessonBlock[];
  onChange: (next: SimulationLessonBlock[]) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const visible = SIMULATIONS.filter((model) =>
    `${model.title} ${model.description}`.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")),
  );

  return <section className="mt-6 space-y-4 rounded-2xl border border-line bg-white p-4 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="font-extrabold text-ink">Mô phỏng trong bài học</h3>
        <p className="text-sm text-secondary">Học sinh chỉ thấy mô phỏng khi bài học được công bố cho lớp.</p>
      </div>
      <button type="button" onClick={() => setPickerOpen((open) => !open)}
        className="min-h-11 rounded-xl border border-emerald px-4 text-sm font-bold text-emerald">
        Thêm học liệu → Mô phỏng 2D/3D
      </button>
    </div>
    {pickerOpen && <div className="space-y-3 rounded-xl bg-canvas p-4">
      <label className="block text-sm font-semibold text-ink" htmlFor="simulation-search">Tìm mô phỏng</label>
      <input id="simulation-search" value={query} onChange={(event) => setQuery(event.target.value)}
        className="w-full rounded-lg border border-line bg-white p-3" placeholder="Tên hoặc chủ đề" />
      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map((model) => <div key={model.id} className="rounded-xl border border-line bg-white p-3">
          <strong className="text-sm text-ink">{model.title}</strong>
          <p className="mt-1 line-clamp-2 text-xs text-secondary">{model.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setPreviewId(model.id)} className="rounded-lg border border-line px-3 py-2 text-sm">Xem trước</button>
            <button type="button" disabled={value.some((item) => item.modelId === model.id)}
              onClick={() => onChange([...value, { id: crypto.randomUUID(), modelId: model.id }])}
              className="rounded-lg bg-emerald px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
              {value.some((item) => item.modelId === model.id) ? "Đã thêm" : "Thêm vào bài"}
            </button>
          </div>
        </div>)}
      </div>
      {visible.length === 0 && <p className="text-sm text-secondary">Không tìm thấy mô phỏng phù hợp.</p>}
    </div>}
    {value.map((item, index) => <div key={item.id} className="rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-sm text-ink">{index + 1}. {getSimulation(item.modelId)?.title ?? "Mô phỏng không khả dụng"}</strong>
        <div className="flex flex-wrap gap-2 text-sm">
          <button type="button" onClick={() => setPreviewId(item.modelId)}>Xem trước</button>
          <button type="button" disabled={index === 0} aria-label={`Đưa mô phỏng ${index + 1} lên`}
            onClick={() => { const next = [...value]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange(next); }}>Lên</button>
          <button type="button" disabled={index === value.length - 1} aria-label={`Đưa mô phỏng ${index + 1} xuống`}
            onClick={() => { const next = [...value]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; onChange(next); }}>Xuống</button>
          <button type="button" onClick={() => onChange(value.filter((row) => row.id !== item.id))}>Gỡ</button>
        </div>
      </div>
      <label className="mt-3 block text-sm text-secondary" htmlFor={`simulation-guide-${item.id}`}>Hướng dẫn quan sát (tùy chọn)</label>
      <textarea id={`simulation-guide-${item.id}`} value={item.observationGuide ?? ""} maxLength={2000}
        onChange={(event) => onChange(value.map((row) => row.id === item.id ? { ...row, observationGuide: event.target.value } : row))}
        className="mt-1 min-h-20 w-full rounded-lg border border-line p-3 text-sm" />
    </div>)}
    {previewId && <div className="min-w-0" aria-label="Xem trước mô phỏng">
      <SimulationViewer modelId={previewId} onClose={() => setPreviewId(null)} />
    </div>}
  </section>;
}
