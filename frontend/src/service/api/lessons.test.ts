import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTeacherLessons, publishTeacherLesson, saveTeacherLessonDraft, withdrawTeacherLesson } from "./lessons";
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
