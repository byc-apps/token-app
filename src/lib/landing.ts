import type { MeUser } from "@/features/auth";
import { routes } from "@/config/routes";

export function landingPath(user: MeUser): string {
  if (user.role === "student_faculty") return routes.home;
  if (user.role === "centre_admin" || user.role === "centre_staff") {
    const centreId = user.primaryCentreId ?? user.centreIds[0];
    return centreId ? routes.console(centreId) : routes.profile;
  }
  return routes.users;
}
