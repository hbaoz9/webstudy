import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { archiveTeacherClassroom, createTeacherClassroom, getTeacherClassroom, getTeacherClassroomRoster, importTeacherClassroomRoster, listTeacherClassrooms, updateTeacherClassroom } from "./classrooms";

const classroom = { id: "class-uuid", name: "10A1", code: "ABC234", academicYear: "2026-2027", description: null,
  coverImage: null, status: "active", createdAt: "2026-10-28T00:00:00Z", studentCount: 0 };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { "Content-Type": "application/json" },
});

describe("Teacher Classroom API contract", () => {
  beforeEach(() => {
    vi.stubGlobal("document", { cookie: "XSRF-TOKEN=test-token" });
    vi.stubGlobal("window", new EventTarget());
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("loads every backend page without local classroom data", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ data: [classroom], meta: { last_page: 2 } }))
      .mockResolvedValueOnce(json({ data: [{ ...classroom, id: "second" }], meta: { last_page: 2 } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listTeacherClassrooms()).resolves.toMatchObject([{ id: "class-uuid" }, { id: "second" }]);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/api/teacher/classrooms?page=1", "/api/teacher/classrooms?page=2"]);
  });

  it("uses the backend ID for detail and sends only allowed creation fields", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ data: classroom }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json({ data: classroom }, 201));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getTeacherClassroom("class-uuid")).resolves.toEqual(classroom);
    await expect(createTeacherClassroom({ name: "10A1", academic_year: "2026-2027", description: null, cover_image_path: null }))
      .resolves.toEqual(classroom);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/teacher/classrooms/class-uuid");
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({
      name: "10A1", academic_year: "2026-2027", description: null, cover_image_path: null,
    });
  });

  it("rejects an API failure rather than returning prototype classrooms", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(listTeacherClassrooms()).rejects.toThrow("Không thể kết nối máy chủ");
  });

  it("updates only supported fields and archives through the backend", async () => {
    const archived = { ...classroom, status: "archived" };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json({ data: classroom }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json({ data: archived }));
    vi.stubGlobal("fetch", fetchMock);

    const input = { name: "10A1", academic_year: "2026-2027", description: "Updated", cover_image_path: null };
    await expect(updateTeacherClassroom(classroom.id, input)).resolves.toEqual(classroom);
    await expect(archiveTeacherClassroom(classroom.id)).resolves.toEqual(archived);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/teacher/classrooms/class-uuid");
    expect(fetchMock.mock.calls[1][1].method).toBe("PUT");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(input);
    expect(fetchMock.mock.calls[3][0]).toBe("/api/teacher/classrooms/class-uuid/archive");
    expect(fetchMock.mock.calls[3][1].method).toBe("POST");
  });

  it("reads only the requested classroom roster page and preserves backend fields", async () => {
    const entry = { id: "entry-1", orderNumber: 1, fullName: "Nguyễn An", studentCode: "10A1-01", linkedUserId: null, status: "not_joined" };
    const fetchMock = vi.fn().mockResolvedValue(json({ data: [entry], meta: { current_page: 2, last_page: 3, total: 201 } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getTeacherClassroomRoster("class/one", 2)).resolves.toEqual({ data: [entry], meta: { current_page: 2, last_page: 3, total: 201 } });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/teacher/classrooms/class%2Fone/roster?page=2");
  });

  it("sends only nonempty roster search and status parameters with safe encoding", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ data: [], meta: { current_page: 1, last_page: 1, total: 0 } }));
    vi.stubGlobal("fetch", fetchMock);

    await getTeacherClassroomRoster("class-uuid");
    await getTeacherClassroomRoster("class-uuid", 2, "  Nguyễn %_!  ", "joined");
    await getTeacherClassroomRoster("class-uuid", 1, "   ", "all");
    await getTeacherClassroomRoster("class-uuid", 3, "HS0150", "not_joined");
    await getTeacherClassroomRoster("class-uuid", 1, "Trần", "conflict");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/teacher/classrooms/class-uuid/roster?page=1");
    const filtered = new URL(fetchMock.mock.calls[1][0], "http://localhost");
    expect([...filtered.searchParams.entries()]).toEqual([
      ["page", "2"], ["search", "Nguyễn %_!"], ["status", "joined"],
    ]);
    expect(fetchMock.mock.calls[2][0]).toBe("/api/teacher/classrooms/class-uuid/roster?page=1");
    expect(new URL(fetchMock.mock.calls[3][0], "http://localhost").searchParams.get("search")).toBe("HS0150");
    expect(new URL(fetchMock.mock.calls[3][0], "http://localhost").searchParams.get("status")).toBe("not_joined");
    expect(new URL(fetchMock.mock.calls[4][0], "http://localhost").searchParams.get("status")).toBe("conflict");
  });

  it.each([401, 403, 404, 500])("does not fall back to prototype roster on HTTP %i", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ message: "Request failed" }, status)));
    await expect(getTeacherClassroomRoster("class-uuid")).rejects.toMatchObject({ status });
  });

  it("posts only contract fields and returns backend import counts", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json({ data: { created: 1, updated: 2 } }));
    vi.stubGlobal("fetch", fetchMock);
    const rows = [{ orderNumber: 1, fullName: "Nguyễn An", studentCode: "10A1-01" }];
    await expect(importTeacherClassroomRoster("class-uuid", rows)).resolves.toEqual({ created: 1, updated: 2 });
    expect(fetchMock.mock.calls[1][0]).toBe("/api/teacher/classrooms/class-uuid/roster/import");
    expect(fetchMock.mock.calls[1][1].method).toBe("POST");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ rows });
  });

  it.each([401, 403, 404, 409, 422])("keeps import failures as API errors on HTTP %i", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json({ message: "Import failed", errors: { "rows.0.studentCode": ["Invalid code"] } }, status)));
    await expect(importTeacherClassroomRoster("class-uuid", [{ orderNumber: 1, fullName: "A", studentCode: "A-1" }]))
      .rejects.toMatchObject({ status });
  });

  it("rejects a network failure without changing local roster data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockRejectedValueOnce(new TypeError("offline")));
    await expect(importTeacherClassroomRoster("class-uuid", [{ orderNumber: 1, fullName: "A", studentCode: "A-1" }]))
      .rejects.toThrow("Không thể kết nối máy chủ");
  });
});
