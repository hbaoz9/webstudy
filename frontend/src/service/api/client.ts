const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL ?? "").replace(/\/$/, "");
const DEFAULT_TIMEOUT_MS = 10000;

export const AUTH_UNAUTHORIZED_EVENT = "webstudy:auth-unauthorized";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly errors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function csrfToken(): string | null {
  const cookie = document.cookie.split("; ").find((part) => part.startsWith("XSRF-TOKEN="));
  return cookie ? decodeURIComponent(cookie.slice("XSRF-TOKEN=".length)) : null;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, credentials: "include", signal: controller.signal });
  } catch {
    if (controller.signal.aborted) throw new ApiError("Máy chủ phản hồi quá lâu. Vui lòng thử lại.");
    throw new ApiError("Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối và thử lại.");
  } finally {
    clearTimeout(timeout);
  }
}

async function parseResponse<T>(response: Response, announceUnauthorized = true): Promise<T> {
  const payload = await response.json().catch(() => null) as
    | { message?: string; errors?: Record<string, string[]> }
    | null;
  if (!response.ok) {
    if (response.status === 401 && announceUnauthorized) window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
    const fallback = response.status === 419
      ? "Phiên bảo mật đã hết hạn. Vui lòng thử lại."
      : response.status === 403
        ? "Bạn không có quyền thực hiện thao tác này."
        : `Yêu cầu thất bại (${response.status}).`;
    throw new ApiError(payload?.message ?? fallback, response.status, payload?.errors ?? {});
  }
  return payload as T;
}

export async function ensureCsrfCookie(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<void> {
  const response = await fetchWithTimeout(`${BACKEND_URL}/sanctum/csrf-cookie`, {
    method: "GET",
    headers: { Accept: "application/json" },
  }, timeoutMs);
  if (!response.ok) await parseResponse(response);
  if (!csrfToken()) throw new ApiError("Không nhận được CSRF cookie từ máy chủ. Kiểm tra cấu hình domain và session.");
}

export async function apiRequest<T>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
  body?: unknown,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const mutation = method !== "GET";
  const formData = typeof FormData !== "undefined" && body instanceof FormData;
  if (mutation) await ensureCsrfCookie(timeoutMs);

  const send = () => fetchWithTimeout(`${BACKEND_URL}/api${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(mutation ? { "X-XSRF-TOKEN": csrfToken() ?? "" } : {}),
      ...(mutation && !formData ? { "Content-Type": "application/json" } : {}),
    },
    ...(body === undefined ? {} : { body: formData ? body as FormData : JSON.stringify(body) }),
  }, timeoutMs);

  let response = await send();
  if (mutation && response.status === 419) {
    await ensureCsrfCookie(timeoutMs);
    response = await send();
  }
  return parseResponse<T>(response, path !== "/auth/me");
}

export function apiGet<T>(endpoint: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  return apiRequest<T>(endpoint, "GET", undefined, timeoutMs);
}

export type VerificationDocument = {
  blob: Blob;
  contentType: "image/jpeg" | "image/png" | "application/pdf";
};

export async function getVerificationDocument(id: number): Promise<VerificationDocument> {
  const response = await fetchWithTimeout(`${BACKEND_URL}/api/teacher-verifications/${encodeURIComponent(id)}/document`, {
    method: "GET",
    headers: { Accept: "image/jpeg, image/png, application/pdf, application/json" },
  }, DEFAULT_TIMEOUT_MS);
  if (!response.ok) await parseResponse(response);

  const contentType = response.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "image/jpeg" && contentType !== "image/png" && contentType !== "application/pdf") {
    throw new ApiError("Máy chủ trả về định dạng minh chứng không được hỗ trợ.");
  }

  return { blob: await response.blob(), contentType };
}

export type HealthResponse = { status: "ok"; service: "webstudy-api" };

export function checkApiHealth() {
  return apiGet<HealthResponse>("/health");
}
