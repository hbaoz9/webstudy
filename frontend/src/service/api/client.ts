const API_BASE_URL = "/api";
const DEFAULT_TIMEOUT_MS = 10000;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiGet<T>(
  endpoint: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ApiError(
        `API request failed: ${response.status}`,
        response.status,
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (controller.signal.aborted) {
      throw new ApiError("API request timed out");
    }

    throw new ApiError(
      error instanceof Error ? error.message : "Network error",
    );
  } finally {
    clearTimeout(timeout);
  }
}

export type HealthResponse = {
  status: "ok";
  service: "webstudy-api";
};

export function checkApiHealth() {
  return apiGet<HealthResponse>("/health");
}
