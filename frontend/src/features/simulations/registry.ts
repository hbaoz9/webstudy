import { LAB3D_MODELS } from "../lab3d/data/lab3dModels";

// The registry references the existing model definitions; it does not copy their scenes.
export const SIMULATIONS = LAB3D_MODELS.map((model) => ({
  id: model.id,
  kind: "3d" as const,
  title: model.title,
  description: model.description,
  chapterId: model.chapterId,
  lessonId: model.lessonId,
}));

export function getSimulation(id: string) {
  return SIMULATIONS.find((simulation) => simulation.id === id);
}
