import type { IdFormats } from "@shared/ids";
import type { BookingSettings } from "@shared/schemas";
import type { MeUser } from "@/features/auth";

export type SettingsResponse = {
  idFormats: IdFormats;
  booking: BookingSettings;
};

export type Department = {
  id: string;
  name: string;
  code: string;
  tokenPrefix: string;
  active?: boolean;
};

export type DepartmentsResponse = { departments: Department[] };
export type ProfileResponse = { user: MeUser };
export type MobileResponse = { user: MeUser };
export type EmailPrefsResponse = { user: MeUser };
