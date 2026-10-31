import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStudentLesson, getStudentLessons, getTeacherLessons, publishTeacherLesson, saveTeacherLessonDraft, withdrawTeacherLesson } from "./lessons";
import type { StudentLessonDetail, StudentLessonSummary } from "./lessons";
import type { LessonContent } from "../../types/curriculum";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const content: LessonContent = { lessonId: "geo10-kn-b07", objectives: [], keyPoints: [], explanation: "Text", sections: [], status: "draft", updatedAt: "2026-10-30T00:00:00Z" };
const row = { id: content.lessonId, status: "draft", draftContent: content, publishedContent: null, classroomIds: [] };

describe("Teacher Lessons API", () => {
  beforeEach(() => {
    vi.stubGlobal("document", { cookie: "XSRF-TOKEN=test-token" });
    vi.stubGlobal("window", new EventTarget());
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("loads the server catalog and returns an API error without prototype fallback", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ data: [row] })).mockRejectedValueOnce(new TypeError("offline"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getTeacherLessons()).resolves.toEqual([row]);
    await expect(getTeacherLessons()).rejects.toThrow();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/teacher/lessons");
  });

  it("sends only content and selected classroom IDs to the expected mutation endpoints", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(json({ data: row }))
      .mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(json({ data: row }))
      .mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(json({ data: row }));
    vi.stubGlobal("fetch", fetchMock);
    await saveTeacherLessonDraft(content.lessonId, content);
    await publishTeacherLesson(content.lessonId, ["class-1"]);
    await withdrawTeacherLesson(content.lessonId);
    const mutations = fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/"));
    expect(mutations.map(([url, init]) => [url, init.method])).toEqual([
      ["/api/teacher/lessons/geo10-kn-b07/draft", "PUT"],
      ["/api/teacher/lessons/geo10-kn-b07/publish", "POST"],
      ["/api/teacher/lessons/geo10-kn-b07/withdraw", "POST"],
    ]);
    expect(JSON.parse(mutations[0][1].body)).toEqual({ content });
    expect(JSON.parse(mutations[1][1].body)).toEqual({ classroomIds: ["class-1"] });
    expect(mutations[2][1].body).toBeUndefined();
  });
});

describe("Student Lessons API", () => {
  const summary: StudentLessonSummary = {
    id: "geo10-kn-b07", number: 7, title: "Bài 7",
    chapterId: "geo10-kn-c03", chapterNumber: 3, chapterTitle: "Thạch quyển",
    partId: "geo10-kn-p02", partNumber: 2, partTitle: "Địa lí tự nhiên",
    publishedAt: "2026-10-31T08:00:00+00:00",
  };
  const snapshot: StudentLessonDetail["content"] = {
    lessonId: summary.id, status: "published", updatedAt: "2026-10-31T08:00:00Z",
    objectives: ["Mục tiêu"], keyPoints: ["Điểm chính"], explanation: "Nội dung",
    explanationFormat: "markdown", diagramLayout: "mindMap", diagramDisplay: { source: "auto" },
    sections: [{
      id: "s1", title: "Mục 1", content: "Chi tiết", contentFormat: "markdown",
      keyPoints: ["Ý chính"], imageMode: "drag_drop", imageUrl: "https://example.test/map.png",
      videoUrl: "https://youtu.be/abcdefghijk", dragImageActivity: {
        kind: "image_pieces", backgroundUrl: "https://example.test/background.png",
        pieces: [{ id: "p1", label: "Nhãn", imageUrl: "https://example.test/piece.png" }],
      },
    }],
  };

  beforeEach(() => {
    vi.stubGlobal("document", { cookie: "" });
    vi.stubGlobal("window", new EventTarget());
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("loads the exact list metadata and empty state with credentialed GET requests", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ data: [summary] })).mockResolvedValueOnce(json({ data: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getStudentLessons()).resolves.toEqual([summary]);
    await expect(getStudentLessons()).resolves.toEqual([]);
    expect(typeof summary.id).toBe("string");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/api/student/lessons", "/api/student/lessons"]);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init).toMatchObject({ method: "GET", credentials: "include", headers: { Accept: "application/json" } });
      expect(init.body).toBeUndefined();
    }
  });

  it("loads a string curriculum ID and preserves the complete published snapshot", async () => {
    const detail: StudentLessonDetail = { ...summary, content: snapshot };
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(json({ data: detail })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getStudentLesson("geo10-kn-b07")).resolves.toEqual(detail);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/student/lessons/geo10-kn-b07");
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
    await getStudentLesson("geo10-kn-b07/other");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/student/lessons/geo10-kn-b07%2Fother");
  });

  it.each([401, 403, 404])("propagates HTTP %i without returning prototype data", async (status) => {
    const fetchMock = vi.fn().mockResolvedValue(json({ message: "Denied" }, status));
    vi.stubGlobal("fetch", fetchMock);
    const storage = { getItem: vi.fn() };
    vi.stubGlobal("localStorage", storage);

    await expect(getStudentLessons()).rejects.toMatchObject({ status });
    await expect(getStudentLesson(summary.id)).rejects.toMatchObject({ status });
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("propagates network errors without local content fallback", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("offline"));
    vi.stubGlobal("fetch", fetchMock);
    const storage = { getItem: vi.fn() };
    vi.stubGlobal("localStorage", storage);

    await expect(getStudentLessons()).rejects.toThrow();
    await expect(getStudentLesson(summary.id)).rejects.toThrow();
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
