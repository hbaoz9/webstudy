import { Suspense, lazy } from "react";
import { getLab3DModelById } from "../lab3d/data/lab3dModels";

const Lab3DViewer = lazy(() =>
  import("../lab3d/components/Lab3DViewer").then((module) => ({ default: module.Lab3DViewer })),
);

export function SimulationViewer({ modelId, onClose }: { modelId: string; onClose: () => void }) {
  const model = getLab3DModelById(modelId);
  if (!model) return <p role="alert">Mô phỏng này hiện không khả dụng.</p>;

  return <Suspense fallback={<p>Đang tải mô phỏng…</p>}>
    <Lab3DViewer model={model} onBack={onClose} embedded />
  </Suspense>;
}
