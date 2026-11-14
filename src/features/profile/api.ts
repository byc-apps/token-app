import { emailPrefsSchema } from "@shared/schemas";
import type { output } from "zod";
import type {
  EmailPrefsResponse,
  DepartmentsResponse,
  MobileResponse,
  ProfileResponse,
  SettingsResponse,
} from "./types";
import type { ProfileBody } from "@shared/schemas";
import { apiFetch } from "@/lib/api-client";
import { withLoginRetry } from "@/features/auth";

type EmailPrefsPatch = output<typeof emailPrefsSchema>;

export async function getSettings(): Promise<SettingsResponse> {
  return withLoginRetry(() => apiFetch<SettingsResponse>("/settings"));
}

export async function getDepartments(): Promise<DepartmentsResponse> {
  return withLoginRetry(() => apiFetch<DepartmentsResponse>("/departments"));
}

export async function completeProfile(body: ProfileBody): Promise<ProfileResponse> {
  return withLoginRetry(() => apiFetch<ProfileResponse>("/me/profile", {
    method: "PUT",
    body: JSON.stringify(body),
  }));
}

export async function updateMobile(mobile: string): Promise<MobileResponse> {
  return withLoginRetry(() => apiFetch<MobileResponse>("/me/mobile", {
    method: "PATCH",
    body: JSON.stringify({ mobile }),
  }));
}

export async function updateEmailPrefs(prefs: EmailPrefsPatch): Promise<EmailPrefsResponse> {
  return withLoginRetry(() => apiFetch<EmailPrefsResponse>("/me/email-prefs", {
    method: "PATCH",
    body: JSON.stringify(prefs),
  }));
}
