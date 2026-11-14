import { apiFetch } from "@/lib/api-client";
import { withLoginRetry } from "@/features/auth";
import type { CentresResponse } from "./types";

export async function getCentres(): Promise<CentresResponse> {
  return withLoginRetry(() => apiFetch<CentresResponse>("/centres"));
}
