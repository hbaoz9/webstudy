// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import TeacherServerInfographicsPage from "./TeacherServerInfographicsPage";

vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ session: { userId: "teacher-a" } }) }));
const api = vi.hoisted(() => ({ infographicImageUrl: (asset: { imageUrl: string }) => asset.imageUrl,
  listTeacherInfographics: vi.fn(), uploadInfographic: vi.fn(),
  publishInfographic: vi.fn(), listTeacherClassrooms: vi.fn() }));
vi.mock("../../service/api/infographics", () => api);
vi.mock("../../service/api/classrooms", () => ({ listTeacherClassrooms: api.listTeacherClassrooms }));
let root: Root; let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  api.listTeacherClassrooms.mockResolvedValue([{ id: "class-1", name: "10A1", status: "active" }]);
  api.listTeacherInfographics.mockResolvedValue({ data: [{ id: "asset-1", title: "Bản đồ", chapterId: "chapter-1",
    imageUrl: "/api/teacher/infographics/asset-1/file", version: 1, classroomIds: [] }], meta: { lastPage: 1 } });
  api.publishInfographic.mockResolvedValue({ id: "asset-1", title: "Bản đồ", imageUrl: "/api/teacher/infographics/asset-1/file",
    version: 2, classroomIds: ["class-1"] });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.clearAllMocks(); });
it("loads server assets, preserves the local library link and publishes by class", async () => {
  await act(async () => root.render(<MemoryRouter><TeacherServerInfographicsPage /></MemoryRouter>));
  expect(host.textContent).toContain("Bản đồ");
  expect(host.querySelector('a[href="/teacher/infographics/local"]')).not.toBeNull();
  expect(host.querySelector("img")?.getAttribute("src")).toBe("/api/teacher/infographics/asset-1/file");
  await act(async () => { [...host.querySelectorAll("button")].find(button => button.textContent?.includes("Chọn lớp"))?.click(); });
  const check = host.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
  await act(async () => { check.click(); });
  await act(async () => { [...host.querySelectorAll("button")].find(button => button.textContent === "Xác nhận")?.click(); });
  expect(api.publishInfographic).toHaveBeenCalledWith("asset-1", 1, ["class-1"]);
});
it("shows a request error rather than local images or a false empty library", async () => {
  api.listTeacherInfographics.mockRejectedValue(new Error("network"));
  await act(async () => root.render(<MemoryRouter><TeacherServerInfographicsPage /></MemoryRouter>));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Không thể tải thư viện");
  expect(host.textContent).not.toContain("Chưa có ảnh trên máy chủ");
});
