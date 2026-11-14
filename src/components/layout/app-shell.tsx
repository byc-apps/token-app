"use client";

import { useAuth } from "@/context/auth-context";
import { TopBar } from "./top-bar";
import { Toast } from "@/components/ui";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, error, clearError } = useAuth();
  return (
    <>
      <TopBar />
      <main className={`app-main page-width${user?.role === "student_faculty" ? " page-width--student" : ""}`}>
        {children}
      </main>
      {error ? <Toast onDismiss={clearError}>{error}</Toast> : null}
    </>
  );
}
