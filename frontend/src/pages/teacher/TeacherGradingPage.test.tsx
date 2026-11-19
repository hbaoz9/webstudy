// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeacherGradingPage from "./TeacherGradingPage";
import { getRevision } from "../../service/api/assessments";
import { cancelDistribution, closeDistribution, getDistribution, listDistributionEvents } from "../../service/api/distributions";

vi.mock("../../service/api/assessments", () => ({ getRevision: vi.fn() }));
vi.mock("../../service/api/distributions", () => ({ getDistribution: vi.fn(), listDistributionEvents: vi.fn(),
  cancelDistribution: vi.fn(), closeDistribution: vi.fn() }));
vi.mock("../../components/teacher/TeacherAttemptPanel", () => ({ TeacherAttemptPanel: ({ distribution, activeSection }: {
  distribution: { id: string }; activeSection: string }) => <div data-testid="attempt-workspace">{distribution.id} · {activeSection}</div> }));
vi.mock("../../components/questions/QuestionImage", () => ({ QuestionImageView: () => null }));

let host: HTMLDivElement;
let root: Root;
const distribution = (id: string) => ({ id, classroomId: `class-${id}`, classroomName: `Lớp ${id}`,
  assessmentTitle: `Đề ${id}`, revisionId: `revision-${id}`, status: "open", lifecycleStatus: "active",
  opensAt: "2026-11-01T00:00:00Z", deadlineAt: "2026-12-01T00:00:00Z",
  timeLimitSeconds: 2700, maxAttempts: 2, deadlinePolicy: "HARD_DEADLINE", version: 1 });
const revision = (id: string) => ({ id: `revision-${id}`, revisionNo: 1, title: `Đề ${id}`,
  totalPoints: "10.000000", instructions: "Hướng dẫn", status: "published", questions: [
    { id: `question-${id}`, position: 1, maxPoints: "10.000000", publicContent: { content: `Câu hỏi ${id}` } },
  ] });
function page(entry: string) {
  return createMemoryRouter([{ path: "/teacher/distributions/:distributionId", element: <TeacherGradingPage /> },
    { path: "/teacher/distributions/:distributionId/grade", element: <TeacherGradingPage /> }], { initialEntries: [entry] });
}
async function click(label: string) {
  await act(async () => { [...host.querySelectorAll("button")].find(button => button.textContent === label)?.click(); });
}

describe("teacher distribution detail", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.mocked(getDistribution).mockImplementation(async id => distribution(id) as never);
    vi.mocked(getRevision).mockImplementation(async id => revision(id.replace("revision-", "")) as never);
    vi.mocked(listDistributionEvents).mockResolvedValue({ data: [], meta: { lastPage: 1 } } as never);
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

  it("shows a compact header and only the selected tab", async () => {
    await act(async () => root.render(<RouterProvider router={page("/teacher/distributions/a")} />));
    expect(host.querySelector("h1")?.textContent).toBe("Đề a");
    expect(host.querySelector('[role="tablist"]')?.className).toContain("overflow-x-auto");
    expect(host.textContent).toContain("Lớp a");
    expect(host.textContent).toContain("Tổng điểm 10");
    expect(host.querySelector('[aria-label="Tổng quan đợt giao"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Nội dung đề đã giao"]')).toBeNull();
    expect(host.querySelector('[data-testid="attempt-workspace"]')).toBeNull();
    await click("Nội dung đề");
    expect(host.textContent).toContain("Câu hỏi a");
    expect(host.querySelector('[aria-label="Tổng quan đợt giao"]')).toBeNull();
    await click("Chấm bài");
    expect(host.querySelector('[data-testid="attempt-workspace"]')?.textContent).toBe("a · grading");
    expect(host.textContent).not.toContain("Câu hỏi a");
    await click("Kết quả");
    expect(host.querySelector('[data-testid="attempt-workspace"]')?.textContent).toBe("a · results");
  });

  it("keeps legacy grading links and resets content when switching distributions", async () => {
    const router = page("/teacher/distributions/a/grade");
    await act(async () => root.render(<RouterProvider router={router} />));
    expect(host.querySelector('[data-testid="attempt-workspace"]')?.textContent).toBe("a · grading");
    await act(async () => router.navigate("/teacher/distributions/b"));
    expect(host.querySelector("h1")?.textContent).toBe("Đề b");
    expect(host.querySelector('[data-testid="attempt-workspace"]')).toBeNull();
    await click("Kết quả");
    expect(host.querySelector('[data-testid="attempt-workspace"]')?.textContent).toBe("b · results");
    expect(getDistribution).toHaveBeenCalledWith("b");
  });

  it("confirms a distribution-specific close from header settings", async () => {
    vi.stubGlobal("prompt", vi.fn(() => "Đã hoàn tất"));
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.mocked(closeDistribution).mockResolvedValue({ ...distribution("a"), lifecycleStatus: "closed", status: "closed", version: 2 } as never);
    await act(async () => root.render(<RouterProvider router={page("/teacher/distributions/a")} />));
    await act(async () => { host.querySelector<HTMLButtonElement>('button[aria-label="Cài đặt đợt giao"]')!.click(); });
    expect(host.querySelector('[aria-label="Cài đặt đợt giao"]')).not.toBeNull();
    await click("Ngừng nhận lượt mới");
    expect(closeDistribution).toHaveBeenCalledWith("a", 1, expect.any(String), "Đã hoàn tất");
    expect(cancelDistribution).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Đã ngừng nhận lượt mới.");
  });

  it("toggles settings with the icon and Escape without leaving an empty panel", async () => {
    await act(async () => root.render(<RouterProvider router={page("/teacher/distributions/a")} />));
    const settings = host.querySelector<HTMLButtonElement>('button[aria-label="Cài đặt đợt giao"]')!;
    expect(settings.title).toBe("Cài đặt đợt giao");
    expect(settings.getAttribute("aria-expanded")).toBe("false");
    expect(host.querySelector("#distribution-settings")).toBeNull();
    await click("Chấm bài");
    await act(async () => settings.click());
    expect(settings.getAttribute("aria-expanded")).toBe("true");
    expect(host.querySelector("#distribution-settings")).not.toBeNull();
    await act(async () => settings.click());
    expect(host.querySelector("#distribution-settings")).toBeNull();
    expect(host.querySelector('[data-testid="attempt-workspace"]')?.textContent).toBe("a · grading");
    await act(async () => settings.click());
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(host.querySelector("#distribution-settings")).toBeNull();
    expect(document.activeElement).toBe(settings);
  });
});
