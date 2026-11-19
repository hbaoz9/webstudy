// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudentGamesPage from "../../pages/student/StudentGamesPage";
import StudentLab3DPage from "../../pages/student/StudentLab3DPage";

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    session: { userId: "student-test-1", role: "student", name: "Học sinh Thực nghiệm" },
    status: "ready",
  }),
}));

vi.mock("../../contexts/StudentAccountContext", () => ({
  useStudentAccount: () => ({
    student: { id: "student-test-1", name: "Học sinh Thực nghiệm" },
    hasStudentProfile: true,
  }),
}));

let root: Root;
let host: HTMLDivElement;

async function renderRoute(initialEntry: string) {
  await act(async () => {
    root.render(
      <MemoryRouter key={initialEntry} initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/student/games" element={<StudentGamesPage />} />
          <Route path="/student/games/:gameId" element={<StudentGamesPage />} />
          <Route path="/student/3d-lab" element={<StudentLab3DPage />} />
          <Route path="/student/3d-lab/:modelId" element={<StudentLab3DPage />} />
        </Routes>
      </MemoryRouter>,
    );
  });
}

describe("StudentGamesPage & StudentLab3DPage UI Integration", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    if (typeof HTMLDialogElement !== "undefined") {
      HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
        this.setAttribute("open", "");
      });
      HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
        this.removeAttribute("open");
      });
    }
    localStorage.clear();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    host.remove();
    vi.restoreAllMocks();
  });

  it("renders Game Center with all 4 Geography 10 games and opens rules modal", async () => {
    await renderRoute("/student/games");
    expect(document.body.textContent).toContain("Ai là triệu phú Địa lý");
    expect(document.body.textContent).toContain("Đuổi hình bắt chữ");
    expect(document.body.textContent).toContain("Penalty Quiz");
    expect(document.body.textContent).toContain("Ô ăn quan Địa lý");

    // Click rules button on first game
    const rulesBtn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Hướng dẫn"),
    );
    expect(rulesBtn).toBeDefined();
    await act(async () => {
      rulesBtn?.click();
    });
    expect(document.querySelector("dialog")?.textContent).toContain("Ai là triệu phú Địa lý");
  });

  it("renders each of the 4 playable games via route parameter", async () => {
    await renderRoute("/student/games/millionaire");
    expect(document.body.textContent).toContain("AI LÀ TRIỆU PHÚ");
    expect(document.body.textContent).toContain("50:50");

    await renderRoute("/student/games/word-catch");
    expect(document.body.textContent).toContain("Đuổi hình bắt chữ");
    expect(document.body.textContent).toContain("Mở 1 chữ");

    await renderRoute("/student/games/penalty-quiz");
    expect(document.body.textContent).toContain("Penalty Quiz");

    await renderRoute("/student/games/o-an-quan");
    expect(document.body.textContent).toContain("Ô Ăn Quan Địa Lý 10");
    expect(document.body.textContent).toContain("Cố vấn Địa lí");
  });

  it("renders 3D Lab Hub with 4 scientific models and filters by chapter", async () => {
    await renderRoute("/student/3d-lab");
    expect(document.body.textContent).toContain("Trái Đất tự quay — Ngày và đêm");
    expect(document.body.textContent).toContain("Cấu tạo bên trong Trái Đất");
    expect(document.body.textContent).toContain("Kiến tạo mảng và núi lửa");
    expect(document.body.textContent).toContain("Các tầng khí quyển");

    // Filter by Khí quyển via select
    const chapterSelect = document.querySelector<HTMLSelectElement>("#lab3d-chapter-filter");
    expect(chapterSelect).not.toBeNull();
    const atmosphereOption = [...(chapterSelect?.options ?? [])].find((o) =>
      o.textContent?.includes("Khí quyển"),
    );
    expect(atmosphereOption).toBeDefined();
    await act(async () => {
      if (chapterSelect && atmosphereOption) {
        chapterSelect.value = atmosphereOption.value;
        chapterSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    expect(document.body.textContent).toContain("Các tầng khí quyển");
    expect(document.body.textContent).not.toContain("Cấu tạo bên trong Trái Đất");
  });

  it("renders 3D Lab Viewer with automatic 2D interactive fallback in non-WebGL environment and switches hotspots", async () => {
    await renderRoute("/student/3d-lab/plate-tectonics");
    expect(document.body.textContent).toContain("Kiến tạo mảng và núi lửa");
    expect(document.body.textContent).toContain("Lưu ý mô phỏng khoa học");
    expect(document.body.textContent).toContain("Chế độ Sơ đồ 2D tương tác");

    // Switch tectonic boundary mode to Phân kì
    const divergentBtn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Phân kì"),
    );
    expect(divergentBtn).toBeDefined();
    await act(async () => {
      divergentBtn?.click();
    });
    expect(document.body.textContent).toContain("Phân kì");

    // Switch hotspot
    const hotspotBtn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Dòng đối lưu nhiệt trong Quyển mềm"),
    );
    expect(hotspotBtn).toBeDefined();
    await act(async () => {
      hotspotBtn?.click();
    });
    expect(document.body.textContent).toContain("Quyển mềm");

    // Verify V2 Interactive Discovery Activity (Quan sát -> Dự đoán -> Thay đổi tham số -> Giải thích)
    const activitySection = document.querySelector("[data-testid='lab3d-learning-activity']");
    expect(activitySection).not.toBeNull();
    expect(activitySection?.textContent).toContain("Hoạt động Khám phá Khoa học");

    const correctPredBtn = [...(activitySection?.querySelectorAll("button") ?? [])].find((b) =>
      b.textContent?.includes("Hai mảng tách xa nhau về hai phía"),
    );
    expect(correctPredBtn).toBeDefined();
    await act(async () => {
      correctPredBtn?.click();
    });
    expect(activitySection?.textContent).toContain("Chính xác!");
    expect(activitySection?.textContent).toContain("Kết quả quan sát trên mô hình");
    expect(activitySection?.textContent).toContain("Giải thích nguyên nhân – hệ quả");
  });

  it("displays explicit single-chapter mode notice in Millionaire when a specific chapter is chosen", async () => {
    await renderRoute("/student/games/millionaire?chapter=geo10-kn-c02");
    expect(document.body.textContent).toContain("không trộn chương khác");
    expect(document.body.textContent).toContain("Mở rộng đủ 15 câu (kèm chương khác)");
  });
});
