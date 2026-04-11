import { ApiErrorPayload } from "../types/models";

export class ApiError extends Error {
  status: number;
  retryable: boolean;

  constructor(message: string, status: number, retryable = false) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryable = retryable;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string;
  baseUrl: string;
  timeoutMs?: number;
  retries?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildRequestUrl(baseUrl: string, path: string) {
  return `${baseUrl}${path}`;
}

function parseJsonPayload<T>(rawText: string) {
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText) as T;
  } catch (error) {
    console.error("[api] invalid json payload", {
      body: rawText,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function doFetch(path: string, options: RequestOptions) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 15000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const url = buildRequestUrl(options.baseUrl, path);
  const method = options.method ?? "GET";

  try {
    console.info("[api] request", {
      method,
      url,
      timeoutMs,
    });

    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[api] network failure", {
      method,
      url,
      timeoutMs,
      error: errorMessage,
    });
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("Request timed out. Please try again.", 408, true);
    }
    throw new ApiError(
      `Unable to reach server. Please check internet access and backend status (${options.baseUrl}).`,
      0,
      true
    );
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const retries = options.retries ?? 2;
  let attempt = 0;
  const url = buildRequestUrl(options.baseUrl, path);
  const method = options.method ?? "GET";

  while (attempt <= retries) {
    try {
      const response = await doFetch(path, options);
      const isJson = response.headers.get("content-type")?.includes("application/json");
      const rawText = await response.text();
      const payload = isJson ? parseJsonPayload<ApiErrorPayload | T>(rawText) : null;

      if (!response.ok) {
        const fallbackMessage =
          response.status >= 500
            ? "Server is temporarily unavailable. Please retry shortly."
            : `Request failed with status ${response.status}`;
        const message =
          (payload as ApiErrorPayload | null)?.message ?? fallbackMessage;
        const retryable = response.status >= 500 || response.status === 429;
        console.error("[api] response error", {
          method,
          url,
          status: response.status,
          body: rawText,
        });
        throw new ApiError(message, response.status, retryable);
      }

      console.info("[api] response ok", {
        method,
        url,
        status: response.status,
      });
      return payload as T;
    } catch (error) {
      const apiError =
        error instanceof ApiError ? error : new ApiError("Unknown request error.", 0, false);
      const canRetry = apiError.retryable && attempt < retries;
      console.warn("[api] request failed", {
        method,
        url,
        attempt,
        retries,
        status: apiError.status,
        message: apiError.message,
        retrying: canRetry,
      });
      if (!canRetry) {
        throw apiError;
      }
      const backoffMs = 300 * Math.pow(2, attempt);
      await sleep(backoffMs);
      attempt += 1;
    }
  }

  throw new ApiError("Unexpected request state.", 0);
}
