// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TeacherInteractiveVideosPage from "./TeacherInteractiveVideosPage";

vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ session: { userId: "teacher-a", role: "teacher" } }) }));
const api = vi.hoisted(() => ({ listTeacherClassrooms: vi.fn(), listTeacherVideos: vi.fn(), getTeacherVideo: vi.fn(),
  createTeacherVideo: vi.fn(), updateTeacherVideo: vi.fn(), publishTeacherVideo: vi.fn() }));
vi.mock("../../service/api/classrooms", () => ({ listTeacherClassrooms: api.listTeacherClassrooms }));
vi.mock("../../service/api/interactiveVideos", () => api);
vi.mock("../../components/media/InteractiveVideoPlayer", () => ({
  default: () => <p>Video preview</p>, getYouTubeVideoId: (value: string) => value.match(/dQw4w9WgXcQ/)?.[0] ?? null,
}));

const video = { id: "video-1", title: "Video địa lí", youtubeId: "dQw4w9WgXcQ", lessonId: null,
  checkpoints: [], version: 1, status: "draft", classroomIds: [], publications: [],
  publishedAt: null, createdAt: "2026-11-19T00:00:00Z", updatedAt: "2026-11-19T00:00:00Z" };
let root: Root; let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  api.listTeacherClassrooms.mockResolvedValue([{ id: "class-1", name: "10A1", status: "active" }]);
  api.listTeacherVideos.mockResolvedValue({ data: [video], meta: { currentPage: 1, lastPage: 1, total: 1 } });
  api.getTeacherVideo.mockResolvedValue(video);
  api.publishTeacherVideo.mockResolvedValue({ ...video, version: 2, status: "published", classroomIds: ["class-1"],
    publications: [{ id: "publication-1", classroomId: "class-1", snapshot: video, publishedAt: "2026-11-19T00:00:00Z" }] });
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.clearAllMocks(); });
async function render(path: string) {
  await act(async () => root.render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/teacher/videos" element={<TeacherInteractiveVideosPage />} />
    <Route path="/teacher/videos/:videoId" element={<TeacherInteractiveVideosPage />} />
  </Routes></MemoryRouter>));
}

describe("teacher interactive videos", () => {
  it("lists server drafts and keeps local videos behind a separate legacy link", async () => {
    await render("/teacher/videos");
    expect(host.textContent).toContain("Video địa lí");
    expect(host.querySelector('a[href="/teacher/videos/local"]')).not.toBeNull();
    expect(host.querySelector('a[href="/teacher/videos/video-1"]')).not.toBeNull();
  });

  it("preselects the classroom context and publishes only after an explicit confirmation", async () => {
    await render("/teacher/videos/video-1?classId=class-1");
    const selected = host.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(selected?.checked).toBe(true);
    await act(async () => { [...host.querySelectorAll("button")].find(button => button.textContent === "Đăng video cho lớp")?.click(); });
    expect(window.confirm).toHaveBeenCalled();
    expect(api.publishTeacherVideo).toHaveBeenCalledWith("video-1", ["class-1"], 1);
    expect(host.textContent).toContain("Đã đăng video cho lớp");
  });
});
