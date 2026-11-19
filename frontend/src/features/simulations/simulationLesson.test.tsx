// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SimulationLessonEditor } from "../../components/teacher/SimulationLessonEditor";
import { StudentLessonSimulations } from "../../components/student/StudentLessonSimulations";
import { SIMULATIONS } from "./registry";
import type { SimulationLessonBlock } from "../../types/curriculum";

vi.mock("./SimulationViewer", () => ({
  SimulationViewer: ({ modelId }: { modelId: string }) => <div data-testid="simulation-canvas">{modelId}</div>,
}));

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function click(label: string) {
  const button = [...host.querySelectorAll("button")].find((item) => item.textContent?.trim() === label);
  if (!button) throw new Error(`Missing ${label}`);
  await act(async () => button.click());
}

describe("lesson simulation references", () => {
  it("selects, orders, edits and removes models without copying model data", async () => {
    let blocks: SimulationLessonBlock[] = [];
    const render = async () => act(async () => root.render(<SimulationLessonEditor value={blocks} onChange={(next) => { blocks = next; void render(); }} />));
    await render();
    await click("Thêm học liệu → Mô phỏng 2D/3D");
    await click("Thêm vào bài");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].modelId).toBe(SIMULATIONS[0].id);
    expect(Object.keys(blocks[0]).sort()).toEqual(["id", "modelId"]);
    await click("Thêm vào bài");
    expect(blocks).toHaveLength(2);
    const down = host.querySelector<HTMLButtonElement>('button[aria-label="Đưa mô phỏng 1 xuống"]')!;
    await act(async () => down.click());
    expect(blocks[1].modelId).toBe(SIMULATIONS[0].id);
    await click("Gỡ");
    expect(blocks).toHaveLength(1);
  });

  it("does not mount the viewer until a student opens an attached model", async () => {
    await act(async () => root.render(<MemoryRouter><StudentLessonSimulations lessonId="geo10-kn-b05"
      blocks={[{ id: "one", modelId: SIMULATIONS[0].id, observationGuide: "Quan sát trục quay" }]} /></MemoryRouter>));
    expect(host.textContent).toContain("Quan sát trục quay");
    expect(host.querySelector('[data-testid="simulation-canvas"]')).toBeNull();
    expect(host.querySelector("a")?.getAttribute("href")).toBe(`/student/3d-lab/${SIMULATIONS[0].id}?lesson=geo10-kn-b05`);
    await click("Khám phá mô phỏng");
    expect(host.querySelector('[data-testid="simulation-canvas"]')).not.toBeNull();
  });
});
