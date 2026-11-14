import type { Role } from "@shared/roles";
import type { MeUser } from "@/features/auth";
import { routes } from "./routes";

export interface NavigationItem {
  label: string;
  roles: readonly Role[];
  href: (user: MeUser, selectedCentreId?: string) => string | null;
}

const centreFor = (user: MeUser, selectedCentreId?: string) =>
  selectedCentreId ?? user.primaryCentreId ?? user.centreIds[0] ?? null;

export const navigation: NavigationItem[] = [
  { label: "Home", roles: ["student_faculty"], href: () => routes.home },
  { label: "Book", roles: ["student_faculty"], href: () => routes.book },
  {
    label: "Console",
    roles: ["centre_staff"],
    href: (user, selectedCentreId) => {
      const centreId = centreFor(user, selectedCentreId);
      return centreId ? routes.console(centreId) : null;
    },
  },
  {
    label: "Console",
    roles: ["centre_admin"],
    href: (user, selectedCentreId) => {
      const centreId = centreFor(user, selectedCentreId);
      return centreId ? routes.console(centreId) : null;
    },
  },
  {
    label: "Setup",
    roles: ["centre_admin"],
    href: (user, selectedCentreId) => {
      const centreId = centreFor(user, selectedCentreId);
      return centreId ? routes.centreSetup(centreId) : null;
    },
  },
  {
    label: "Staff",
    roles: ["centre_admin"],
    href: (user, selectedCentreId) => {
      const centreId = centreFor(user, selectedCentreId);
      return centreId ? routes.centreStaff(centreId) : null;
    },
  },
  {
    label: "Reports",
    roles: ["centre_admin"],
    href: (user, selectedCentreId) => {
      const centreId = centreFor(user, selectedCentreId);
      return centreId ? routes.centreReports(centreId) : null;
    },
  },
  { label: "Users", roles: ["campus_authority", "app_admin"], href: () => routes.users },
  { label: "Centres", roles: ["campus_authority", "app_admin"], href: () => routes.centres },
  { label: "Settings", roles: ["campus_authority", "app_admin"], href: () => routes.settings },
  { label: "Reports", roles: ["campus_authority", "app_admin"], href: () => routes.reports },
  { label: "Logs", roles: ["campus_authority", "app_admin"], href: () => routes.logs },
  {
    label: "Profile",
    roles: ["student_faculty", "centre_staff", "centre_admin", "campus_authority", "app_admin"],
    href: () => routes.profile,
  },
];

export function navigationFor(user: MeUser, selectedCentreId?: string): { label: string; href: string }[] {
  return navigation.flatMap((item) => {
    if (!item.roles.includes(user.role)) return [];
    const href = item.href(user, selectedCentreId);
    return href ? [{ label: item.label, href }] : [];
  });
}
