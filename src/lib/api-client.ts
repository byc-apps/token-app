import { auth } from "@/lib/firebase/config";

export interface ApiErrorDetail {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId: string | null = null,
    public readonly details: ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorFromBody(status: number, body: unknown): ApiError {
  const envelope = isRecord(body) && isRecord(body.error) ? body.error : null;
  const details = Array.isArray(envelope?.details)
    ? envelope.details.flatMap((detail): ApiErrorDetail[] => {
        if (!isRecord(detail) || typeof detail.path !== "string" || typeof detail.message !== "string") {
          return [];
        }
        return [{ path: detail.path, message: detail.message }];
      })
    : [];
  return new ApiError(
    status,
    typeof envelope?.code === "string" ? envelope.code : "UNKNOWN",
    typeof envelope?.message === "string" ? envelope.message : "Request failed.",
    typeof envelope?.requestId === "string" ? envelope.requestId : null,
    details,
  );
}

function reportApiError(error: ApiError): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<ApiError>("serveq:api-error", { detail: error }));
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const user = auth.currentUser;
  if (!user) {
    const error = new ApiError(401, "UNAUTHENTICATED", "Not signed in.");
    reportApiError(error);
    throw error;
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
  if (init.body) headers.set("Content-Type", "application/json");

  const response = await fetch(`/api${path}`, { ...init, headers, cache: "no-store" });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (!response.ok) throw new ApiError(response.status, "UNKNOWN", "Request failed.");
    throw new ApiError(response.status, "INVALID_RESPONSE", "The server returned an invalid response.");
  }

  if (!response.ok) {
    const error = errorFromBody(response.status, body);
    reportApiError(error);
    throw error;
  }
  return body as T;
}
