import type { UserWithId } from "@shared/schemas";

export type MeUser = UserWithId & { profileComplete: boolean };
export type MeResponse = { user: MeUser };
export type LoginResponse = { user: MeUser; created: boolean };
