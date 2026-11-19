// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DistributionPanel } from "./DistributionPanel";
import { listTeacherClassrooms } from "../../service/api/classrooms";
import { createDistributions, getDistribution, listDistributionEvents, listDistributions, previewDistribution } from "../../service/api/distributions";

vi.mock("../../service/api/classrooms", () => ({ listTeacherClassrooms: vi.fn() }));
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ session: { userId: "teacher-a" } }) }));
vi.mock("../../service/api/distributions", () => ({
  listDistributions: vi.fn(), previewDistribution: vi.fn(), createDistributions: vi.fn(),
  getDistribution: vi.fn(), listDistributionEvents: vi.fn(), closeDistribution: vi.fn(), cancelDistribution: vi.fn(),
}));

let host: HTMLDivElement;
let root: Root;
function field(label: string) { return [...host.querySelectorAll("label")].find(el => el.textContent?.includes(label))?.querySelector("input,select") as HTMLInputElement | HTMLSelectElement; }
async function change(element: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype, "value")?.set;
    setter?.call(element, value);
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function deadline(value = "2099-11-15T17:00") {
  const [date, time] = value.split("T");
  await change(host.querySelector<HTMLInputElement>('input[aria-label="Ngày Hạn kết thúc"]')!, date);
  await change(host.querySelector<HTMLInputElement>('input[aria-label="Giờ Hạn kết thúc"]')!, time);
}

describe("Distribution control plane", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.mocked(listTeacherClassrooms).mockResolvedValue([{ id: "class-a", name: "10A1", status: "active" }] as never);
    vi.mocked(listDistributions).mockResolvedValue({ data: [], meta: { lastPage: 1, total: 0 } } as never);
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

  it("loads real list and preselects the classroom context", async () => {
    await act(async () => root.render(<MemoryRouter><DistributionPanel revisionId="revision-a" classId="class-a" /></MemoryRouter>));
    expect(listDistributions).toHaveBeenCalledWith(1, "class-a", undefined);
    expect(host.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true);
    expect(host.textContent).toContain("Chưa có bài đã giao");
    expect(createDistributions).not.toHaveBeenCalled();
  });

  it("requests only the current assessment and keeps its form hidden until opened", async () => {
    await act(async () => root.render(<MemoryRouter><DistributionPanel assessmentId="assessment-a" revisionId="revision-a" showForm={false} /></MemoryRouter>));
    expect(listDistributions).toHaveBeenCalledWith(1, undefined, "assessment-a");
    expect(host.querySelector('[aria-label="Cấu hình giao bài"]')).toBeNull();
    await act(async () => root.render(<MemoryRouter><DistributionPanel assessmentId="assessment-a" revisionId="revision-a" showForm /></MemoryRouter>));
    expect(host.querySelector('[aria-label="Cấu hình giao bài"]')).not.toBeNull();
  });

  it("preserves an unsaved schedule while the wizard hides its step", async () => {
    const onDirtyChange = vi.fn();
    await act(async () => root.render(<MemoryRouter><div><DistributionPanel revisionId="revision-a" classId="class-a" onDirtyChange={onDirtyChange} /></div></MemoryRouter>));
    await deadline();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await act(async () => root.render(<MemoryRouter><div className="hidden"><DistributionPanel revisionId="revision-a" classId="class-a" onDirtyChange={onDirtyChange} /></div></MemoryRouter>));
    expect(host.querySelector<HTMLInputElement>('input[aria-label="Giờ Hạn kết thúc"]')?.value).toBe("17:00");
    expect(createDistributions).not.toHaveBeenCalled();
  });

  it("keeps the create action locked when preview says release gate is off", async () => {
    vi.mocked(previewDistribution).mockResolvedValue({ eligible: true, revision: { id: "revision-a", title: "Đề", questionCount: 2, totalPoints: "2" },
      classrooms: [{ id: "class-a", name: "10A1" }], overlaps: [], overlapConfirmationToken: null, creationEnabled: false } as never);
    await act(async () => root.render(<MemoryRouter><DistributionPanel revisionId="revision-a" classId="class-a" /></MemoryRouter>));
    await deadline();
    await change(field("Khi đến hạn"), "HARD_DEADLINE");
    const preview = [...host.querySelectorAll("button")].find(b => b.textContent === "Xem trước lịch giao");
    expect(preview?.disabled).toBe(false);
    await act(async () => preview?.click());
    expect(previewDistribution).toHaveBeenCalledOnce();
    expect(host.textContent).toContain("chưa được mở sử dụng");
    expect(createDistributions).not.toHaveBeenCalled();
  });

  it("requires a separate confirmation and sends the preview overlap token", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    vi.mocked(previewDistribution).mockResolvedValue({ eligible: true, revision: { id: "revision-a", title: "Đề", questionCount: 2, totalPoints: "2" },
      classrooms: [{ id: "class-a", name: "10A1" }], overlaps: [{ id: "old", classroomId: "class-a", opensAt: "2026-11-15T10:00:00Z", deadlineAt: "2026-11-15T18:00:00Z" }],
      overlapConfirmationToken: "token", creationEnabled: true } as never);
    vi.mocked(createDistributions).mockResolvedValue({ batchId: "batch", distributions: [] } as never);
    await act(async () => root.render(<MemoryRouter><DistributionPanel revisionId="revision-a" classId="class-a" /></MemoryRouter>));
    await deadline();
    await change(field("Khi đến hạn"), "HARD_DEADLINE");
    await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "Xem trước lịch giao")?.click());
    expect(host.textContent).toContain("lịch trùng");
    await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "Giao bài")?.click());
    expect(createDistributions).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "Giao bài")?.click());
    expect(createDistributions).toHaveBeenCalledWith(expect.objectContaining({ overlapConfirmationToken: "token" }), expect.any(String));
    confirm.mockRestore();
  });

  it("keeps confirmed creation successful when refreshing the list fails", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const onCreated = vi.fn();
    vi.mocked(listDistributions).mockResolvedValueOnce({ data: [], meta: { lastPage: 1, total: 0 } } as never)
      .mockRejectedValueOnce(new Error("offline"));
    vi.mocked(previewDistribution).mockResolvedValue({ eligible: true, revision: { id: "revision-a", title: "Đề", questionCount: 2, totalPoints: "2" },
      classrooms: [{ id: "class-a", name: "10A1" }], overlaps: [], overlapConfirmationToken: null, creationEnabled: true } as never);
    vi.mocked(createDistributions).mockResolvedValue({ batchId: "batch", distributions: [{ id: "distribution-a" }] } as never);
    await act(async () => root.render(<MemoryRouter><DistributionPanel assessmentId="assessment-a" revisionId="revision-a" classId="class-a" onCreated={onCreated} /></MemoryRouter>));
    await deadline();
    await change(field("Khi đến hạn"), "HARD_DEADLINE");
    await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "Xem trước lịch giao")?.click());
    await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "Giao bài")?.click());
    expect(createDistributions).toHaveBeenCalledOnce();
    expect(onCreated).toHaveBeenCalledOnce();
    expect(host.textContent).toContain("Đã giao bài cho 1 lớp");
    expect(host.textContent).toContain("chưa tải lại được danh sách");
    expect(host.textContent).not.toContain("Chưa xác định được bài đã giao hay chưa");
    confirm.mockRestore();
  });

  it("keeps the same idempotency key and form after an uncertain response", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(previewDistribution).mockResolvedValue({ eligible: true, revision: { id: "revision-a", title: "Đề", questionCount: 2, totalPoints: "2" },
      classrooms: [{ id: "class-a", name: "10A1" }], overlaps: [], overlapConfirmationToken: null, creationEnabled: true } as never);
    vi.mocked(createDistributions).mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ batchId: "batch", distributions: [] } as never);
    await act(async () => root.render(<MemoryRouter><DistributionPanel revisionId="revision-a" classId="class-a" /></MemoryRouter>));
    await deadline();
    await change(field("Khi đến hạn"), "HARD_DEADLINE");
    await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "Xem trước lịch giao")?.click());
    await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "Giao bài")?.click());
    expect(host.querySelector<HTMLInputElement>('input[aria-label="Giờ Hạn kết thúc"]')?.value).toBe("17:00");
    expect(host.querySelector<HTMLInputElement>('input[aria-label="Ngày Hạn kết thúc"]')?.disabled).toBe(true);
    await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "Giao bài")?.click());
    expect(createDistributions).toHaveBeenCalledTimes(2);
    expect(vi.mocked(createDistributions).mock.calls[0][1]).toBe(vi.mocked(createDistributions).mock.calls[1][1]);
    confirm.mockRestore();
  });

  it("accepts precise 24-hour time and sends an offset-safe ISO instant", async () => {
    vi.mocked(previewDistribution).mockResolvedValue({ eligible: true, revision: { id: "revision-a", title: "Đề", questionCount: 2, totalPoints: "2" },
      classrooms: [{ id: "class-a", name: "10A1" }], overlaps: [], overlapConfirmationToken: null, creationEnabled: false } as never);
    await act(async () => root.render(<MemoryRouter><DistributionPanel revisionId="revision-a" classId="class-a" /></MemoryRouter>));
    await deadline("2099-11-15T25:99");
    await change(field("Khi đến hạn"), "HARD_DEADLINE");
    const preview = [...host.querySelectorAll("button")].find(b => b.textContent === "Xem trước lịch giao");
    expect(preview?.disabled).toBe(true);
    await deadline("2099-11-15T17:35");
    expect(preview?.disabled).toBe(false);
    await act(async () => preview?.click());
    expect(previewDistribution).toHaveBeenCalledWith(expect.objectContaining({
      deadlineAt: new Date(2099, 10, 15, 17, 35).toISOString(),
    }));
  });

  it("renders compact distribution rows linking to separate details without inline grading", async () => {
    const distribution = { id: "distribution-a", classroomId: "class-a", assessmentTitle: "Đề Địa lí", classroomName: "10A1",
      status: "open", lifecycleStatus: "active", opensAt: "2099-11-01T00:00:00Z", deadlineAt: "2099-11-15T00:00:00Z",
      timeLimitSeconds: 2700, maxAttempts: 1, version: 1 };
    vi.mocked(listDistributions).mockResolvedValue({ data: [distribution], meta: { lastPage: 1, total: 1 } } as never);
    vi.mocked(getDistribution).mockResolvedValue(distribution as never);
    vi.mocked(listDistributionEvents).mockResolvedValue({ data: [], meta: { lastPage: 1 } } as never);
    await act(async () => root.render(<MemoryRouter><DistributionPanel /></MemoryRouter>));
    expect(host.querySelector<HTMLAnchorElement>('a[href="/teacher/distributions/distribution-a"]')?.textContent).toBe("Xem chi tiết");
    expect(host.textContent).toContain("Đề Địa lí");
    expect(host.textContent).toContain("10A1");
    expect(host.textContent).toContain("Hạn");
    expect(host.querySelector("li")?.className).toContain("sm:grid-cols-[minmax(0,1fr)_auto]");
    expect(host.querySelector("li")?.className).toContain("min-w-0");
    expect(host.textContent).not.toContain("Cài đặt & Thao tác nâng cao của đợt giao");
  });
});
