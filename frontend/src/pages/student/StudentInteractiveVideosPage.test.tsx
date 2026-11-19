// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudentInteractiveVideosPage from "./StudentInteractiveVideosPage";

let userId = "student-a";
vi.mock("../../contexts/AuthContext", () => ({ useAuth: () => ({ session: { userId, role: "student" } }) }));
const api = vi.hoisted(() => ({ listStudentVideos: vi.fn(), getStudentVideo: vi.fn() }));
vi.mock("../../service/api/interactiveVideos", () => api);
vi.mock("../../components/media/InteractiveVideoPlayer", () => ({ default: ({ title }: { title: string }) => <p>Phát: {title}</p> }));

const item = { id: "publication-a", videoId: "video-a", classroomId: "class-a", classroomName: "Lớp A",
  title: "Video đã đăng", youtubeId: "dQw4w9WgXcQ", lessonId: null, checkpoints: [], publishedAt: "2026-11-19T00:00:00Z" };
let root: Root; let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  userId = "student-a"; host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  api.listStudentVideos.mockResolvedValue({ data: [item], meta: { currentPage: 1, lastPage: 1, total: 1 } });
  api.getStudentVideo.mockResolvedValue(item);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.clearAllMocks(); });
async function render(path: string) {
  await act(async () => root.render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/student/videos" element={<StudentInteractiveVideosPage />} />
    <Route path="/student/videos/:publicationId" element={<StudentInteractiveVideosPage />} />
  </Routes></MemoryRouter>));
}

describe("student videos from server publications", () => {
  it("shows only server publications and follows class context", async () => {
    await render("/student/videos?classId=class-a");
    expect(api.listStudentVideos).toHaveBeenCalledWith(1, "class-a");
    expect(host.textContent).toContain("Video đã đăng");
    expect(host.querySelector('a[href="/student/videos/publication-a"]')).not.toBeNull();
    expect(host.querySelector('a[href="/student/videos/local"]')).toBeNull();
  });

  it("does not use a local video when the server request fails", async () => {
    api.listStudentVideos.mockRejectedValue(new Error("offline"));
    localStorage.setItem("webstudy-geo10-teacher-videos-v1", JSON.stringify([{ title: "Video trên thiết bị" }]));
    await render("/student/videos");
    expect(host.textContent).toContain("Không thể tải video");
    expect(host.textContent).not.toContain("Video trên thiết bị");
    expect(host.textContent).not.toContain("Xem video cũ");
  });

  it("removes the previous account's video when the account changes", async () => {
    await render("/student/videos/publication-a");
    api.getStudentVideo.mockRejectedValueOnce(new Error("not available"));
    userId = "student-b";
    await act(async () => root.render(<MemoryRouter initialEntries={["/student/videos/publication-a"]}><Routes>
      <Route path="/student/videos/:publicationId" element={<StudentInteractiveVideosPage />} />
    </Routes></MemoryRouter>));
    expect(host.textContent).not.toContain("Phát: Video đã đăng");
    expect(host.textContent).toContain("Không thể tải video");
  });
});
