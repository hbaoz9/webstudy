// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import StudentInfographicsPage from "./StudentInfographicsPage";

vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ session: { userId: "student-a" } }) }));
const api = vi.hoisted(() => ({ infographicImageUrl: (asset: { imageUrl: string }) => asset.imageUrl,
  listStudentInfographics: vi.fn() }));
vi.mock("../../service/api/infographics", () => api);
let root: Root; let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.clearAllMocks(); });
it("shows only publications returned by the student API", async () => {
  api.listStudentInfographics.mockResolvedValue({ data: [{ id: "asset-1", title: "Bản đồ công bố", classroomName: "10A1",
    classroomId: "class-1", imageUrl: "/api/student/infographics/asset-1/file" }], meta: { lastPage: 1 } });
  await act(async () => root.render(<MemoryRouter><StudentInfographicsPage /></MemoryRouter>));
  expect(host.textContent).toContain("Bản đồ công bố");
  expect(host.querySelector("img")?.getAttribute("src")).toBe("/api/student/infographics/asset-1/file");
});
it("keeps API failure separate from an empty publication list", async () => {
  api.listStudentInfographics.mockRejectedValue(new Error("network"));
  await act(async () => root.render(<MemoryRouter><StudentInfographicsPage /></MemoryRouter>));
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  expect(host.textContent).not.toContain("Chưa có infographic nào");
});
