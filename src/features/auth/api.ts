import { ApiError, apiFetch } from "@/lib/api-client";
import type { LoginResponse, MeResponse } from "./types";

export async function login(): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/login", { method: "POST" });
}

export async function getMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>("/me");
}

export async function withLoginRetry<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== "NOT_REGISTERED") throw error;
    await login();
    return request();
  }
}

export async function getMeAfterLogin(): Promise<MeResponse> {
  await login();
  return withLoginRetry(getMe);
}
