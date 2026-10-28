import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_UNAUTHORIZED_EVENT, ApiError, apiGet, apiRequest, getVerificationDocument } from "./client";

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

describe("Sanctum API client", () => {
  beforeEach(() => {
    vi.stubGlobal("document", { cookie: "XSRF-TOKEN=test%3Dtoken" });
    vi.stubGlobal("window", new EventTarget());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("gets the CSRF cookie and sends credentials and token for registration", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json({ data: { id: 1, role: "student" } }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const response = await apiRequest<{ data: { role: string } }>("/auth/register", "POST", {
      role: "student", name: "Student", email: "student@example.com",
      password: "password123", password_confirmation: "password123",
    });

    expect(response.data.role).toBe("student");
    expect(fetchMock.mock.calls[0][0]).toBe("/sanctum/csrf-cookie");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/auth/register");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "POST", credentials: "include",
      headers: { "X-XSRF-TOKEN": "test=token", Accept: "application/json" },
    });
  });

  it("surfaces login validation errors without a successful result", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json({ message: "Invalid credentials", errors: { email: ["Invalid credentials"] } }, 422)));

    await expect(apiRequest("/auth/login", "POST", { email: "student@example.com", password: "wrong" }))
      .rejects.toMatchObject({ status: 422, errors: { email: ["Invalid credentials"] } });
  });

  it("refreshes CSRF once after a 419 response", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json({ message: "CSRF mismatch" }, 419))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json({ message: "Logged out." }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/auth/logout", "POST")).resolves.toEqual({ message: "Logged out." });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("announces an expired session after a protected 401", async () => {
    const unauthorized = vi.fn();
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, unauthorized);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ message: "Unauthenticated." }, 401)));

    await expect(apiGet("/student/classrooms")).rejects.toMatchObject({ status: 401 });
    expect(unauthorized).toHaveBeenCalledOnce();
    await expect(apiGet("/auth/me")).rejects.toMatchObject({ status: 401 });
    expect(unauthorized).toHaveBeenCalledOnce();
  });

  it("reports a network failure without inventing an authenticated response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(apiGet("/auth/me")).rejects.toBeInstanceOf(ApiError);
    await expect(apiGet("/auth/me")).rejects.toThrow("Không thể kết nối máy chủ");
  });

  it("uploads a real file as multipart without forcing a JSON content type", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json({ data: { status: "pending" } }, 201));
    vi.stubGlobal("fetch", fetchMock);
    const body = new FormData();
    body.append("document", new Blob(["proof"], { type: "application/pdf" }), "proof.pdf");

    await apiRequest("/teacher/verification", "POST", body);

    expect(fetchMock.mock.calls[1][1].body).toBe(body);
    expect(fetchMock.mock.calls[1][1].headers).toMatchObject({ "X-XSRF-TOKEN": "test=token" });
    expect(fetchMock.mock.calls[1][1].headers).not.toHaveProperty("Content-Type");
  });

  it.each(["image/jpeg", "image/png", "application/pdf"])("loads a private %s document as a blob", async (contentType) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("proof", { headers: { "Content-Type": contentType } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getVerificationDocument(12);

    expect(result.contentType).toBe(contentType);
    expect(await result.blob.text()).toBe("proof");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/teacher-verifications/12/document");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: "include", method: "GET" });
  });

  it("handles private document authorization errors and rejects unexpected content", async () => {
    const unauthorized = vi.fn();
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, unauthorized);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ message: "Unauthenticated." }, 401))
      .mockResolvedValueOnce(json({ message: "Forbidden." }, 403))
      .mockResolvedValueOnce(new Response("<html />", { headers: { "Content-Type": "text/html" } })));

    await expect(getVerificationDocument(1)).rejects.toMatchObject({ status: 401 });
    expect(unauthorized).toHaveBeenCalledOnce();
    await expect(getVerificationDocument(1)).rejects.toMatchObject({ status: 403 });
    await expect(getVerificationDocument(1)).rejects.toThrow("định dạng minh chứng không được hỗ trợ");
  });
});
