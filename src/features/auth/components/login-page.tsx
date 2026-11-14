"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { landingPath } from "@/lib/landing";
import { ApiError } from "@/lib/api-client";
import { Button, ErrorState } from "@/components/ui";

export function LoginPage({ initialError }: { initialError?: string }) {
  const { user, loading, error, profileError, signInWithGoogle, clearError } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace(landingPath(user));
  }, [loading, router, user]);

  async function handleSignIn() {
    setSigningIn(true);
    clearError();
    await signInWithGoogle();
    setSigningIn(false);
  }

  const typedError = profileError instanceof ApiError ? profileError : null;
  const visibleError = error ?? (signingIn ? null : initialError);

  return (
    <main className="page-width page-width--student app-main">
      <section className="stack" style={{ maxWidth: 420, paddingTop: 40 }}>
        <h1 className="page-title">BYC ServeQ</h1>
        <p>Service tokens for CHRIST (Deemed to be University), Yeshwanthpur Campus.</p>
        <p className="text-muted">Use your CHRIST University email.</p>
        {visibleError ? (
          <ErrorState
            message={visibleError}
            error={profileError}
            status={typedError?.status}
            requestId={typedError?.requestId}
          />
        ) : null}
        <Button
          size="student"
          fullWidth
          disabled={loading || signingIn}
          onClick={() => void handleSignIn()}
        >
          {signingIn ? "Signing in" : "Sign in with Google"}
        </Button>
      </section>
    </main>
  );
}
