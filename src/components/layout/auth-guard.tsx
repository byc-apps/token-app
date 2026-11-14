"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@shared/roles";
import { routes } from "@/config/routes";
import { landingPath } from "@/lib/landing";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/context/auth-context";
import { ErrorState, Skeleton } from "@/components/ui";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { firebaseUser, user, loading, error, profileError, retryProfile } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.replace(routes.login);
      return;
    }
    if (!user) return;
    if (
      user.role === "student_faculty" &&
      !user.profileComplete &&
      pathname !== routes.completeProfile &&
      pathname !== routes.profile
    ) {
      router.replace(routes.completeProfile);
    } else if (user.role === "student_faculty" && user.profileComplete && pathname === routes.completeProfile) {
      router.replace(landingPath(user));
    }
  }, [firebaseUser, loading, pathname, router, user]);

  if (loading || !firebaseUser || (!user && !error)) {
    return (
      <main className="page-width app-main">
        <div className="stack">
          <Skeleton className="skeleton--title" />
          <Skeleton />
          <Skeleton />
        </div>
      </main>
    );
  }

  if (!user && error) {
    const typedError = profileError instanceof ApiError ? profileError : null;
    return (
      <main className="page-width app-main">
        <ErrorState
          message={error}
          error={profileError}
          status={typedError?.status}
          requestId={typedError?.requestId}
          onRetry={() => void retryProfile()}
        />
      </main>
    );
  }

  if (!user) return null;
  if (
    user.role === "student_faculty" &&
    !user.profileComplete &&
    pathname !== routes.completeProfile &&
    pathname !== routes.profile
  ) return null;
  if (user.role === "student_faculty" && user.profileComplete && pathname === routes.completeProfile) return null;
  return children;
}

export function RoleGuard({
  roles,
  children,
}: {
  roles: readonly Role[];
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && !roles.includes(user.role)) router.replace(landingPath(user));
  }, [loading, roles, router, user]);

  if (loading || !user || !roles.includes(user.role)) return null;
  return children;
}
