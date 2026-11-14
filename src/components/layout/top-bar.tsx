"use client";

import Link from "next/link";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { navigationFor } from "@/config/nav";
import { routes } from "@/config/routes";
import { useAuth } from "@/context/auth-context";
import { Button, CentrePicker, ErrorState, Skeleton } from "@/components/ui";
import { useCentres } from "@/features/centres";
import { ApiError } from "@/lib/api-client";

function centrePage(id: string, pathname: string): string {
  if (pathname.endsWith("/display")) return routes.display(id);
  if (pathname.endsWith("/setup")) return routes.centreSetup(id);
  if (pathname.endsWith("/staff")) return routes.centreStaff(id);
  if (pathname.endsWith("/reports")) return routes.centreReports(id);
  return routes.console(id);
}

export function TopBar() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isMultiCentreAdmin = user?.role === "centre_admin" && user.centreIds.length > 1;
  const [selectedCentreId, setSelectedCentreId] = useState(
    user?.primaryCentreId ?? user?.centreIds[0] ?? "",
  );
  const centresQuery = useCentres(Boolean(isMultiCentreAdmin));
  if (!user) return null;
  const items = navigationFor(user, selectedCentreId || undefined);
  const centreOptions = centresQuery.data?.centres.filter((centre) => user.centreIds.includes(centre.id)) ?? [];
  const centresError = centresQuery.error instanceof ApiError ? centresQuery.error : null;

  return (
    <header className="site-header">
      <div className="page-width site-header__inner">
        <Link className="site-brand" href={routes.home}>BYC ServeQ</Link>
        <nav className="site-nav" aria-label="Main navigation">
          {isMultiCentreAdmin ? (
            <div className="site-centre-picker">
              {centresQuery.isPending ? (
                <Skeleton />
              ) : centresQuery.error ? null : (
                <CentrePicker
                  centres={centreOptions}
                  value={selectedCentreId}
                  onChange={(centreId) => {
                    setSelectedCentreId(centreId);
                    router.push(centrePage(centreId, pathname));
                  }}
                />
              )}
            </div>
          ) : null}
          {items.map((item) => (
            <Link
              key={`${item.label}-${item.href}`}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
          <Button
            variant="ghost"
            size="small"
            aria-label="Sign out"
            onClick={() => void signOut()}
          >
            <LogOut size={16} strokeWidth={1.5} />
            <span>Sign out</span>
          </Button>
        </nav>
      </div>
      {isMultiCentreAdmin && centresQuery.error ? (
        <div className="page-width">
          <ErrorState
            message={centresQuery.error instanceof Error ? centresQuery.error.message : "Could not load centres."}
            error={centresQuery.error}
            status={centresError?.status}
            requestId={centresError?.requestId}
            onRetry={() => void centresQuery.refetch()}
          />
        </div>
      ) : null}
    </header>
  );
}
