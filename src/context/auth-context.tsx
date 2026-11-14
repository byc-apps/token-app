"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/config";
import { signInWithGoogleSSO, signOutUser } from "@/lib/firebase/auth-service";
import { ApiError } from "@/lib/api-client";
import { routes } from "@/config/routes";
import { authKeys, getMeAfterLogin, useMe, type MeUser } from "@/features/auth";

interface AuthContextType {
  firebaseUser: User | null;
  user: MeUser | null;
  profileError: unknown;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  retryProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Sign-in failed.";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const router = useRouter();
  const profileQuery = useMe(firebaseUser?.uid);
  const refetchProfile = profileQuery.refetch;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setFirebaseUser(currentUser);
      setAuthReady(true);
      if (!currentUser) queryClient.removeQueries({ queryKey: authKeys.all });
    });
    return unsubscribe;
  }, [queryClient]);

  useEffect(() => {
    function handleApiError(event: Event) {
      if (!(event instanceof CustomEvent) || !(event.detail instanceof ApiError)) return;
      const { code, message } = event.detail;
      if (code === "PROFILE_INCOMPLETE") {
        router.replace(routes.profile);
      } else if (code === "INVALID_TOKEN" || code === "UNAUTHENTICATED" || code === "ACCOUNT_DISABLED") {
        const loginUrl = `${routes.login}?error=${encodeURIComponent(message)}`;
        void signOutUser().then(
          () => router.replace(loginUrl),
          (error: unknown) => router.replace(`${routes.login}?error=${encodeURIComponent(`${message} ${messageOf(error)}`)}`),
        );
      }
    }

    window.addEventListener("serveq:api-error", handleApiError);
    return () => window.removeEventListener("serveq:api-error", handleApiError);
  }, [router]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    const result = await signInWithGoogleSSO();
    if (!result.success) {
      setAuthError(result.error);
      return;
    }

    try {
      await queryClient.fetchQuery({
        queryKey: authKeys.me(result.user.uid),
        queryFn: getMeAfterLogin,
        staleTime: 0,
      });
    } catch (error) {
      setAuthError(messageOf(error));
    }
  }, [queryClient]);

  const signOut = useCallback(async () => {
    try {
      await signOutUser();
      setAuthError(null);
    } catch (error) {
      setAuthError(messageOf(error));
    }
  }, []);

  const retryProfile = useCallback(async () => {
    await refetchProfile();
  }, [refetchProfile]);

  const value: AuthContextType = {
    firebaseUser,
    user: profileQuery.data?.user ?? null,
    profileError: profileQuery.error,
    loading: !authReady || Boolean(firebaseUser && profileQuery.isPending),
    error: authError ?? (profileQuery.error instanceof Error ? profileQuery.error.message : null),
    signInWithGoogle,
    signOut,
    clearError: () => setAuthError(null),
    retryProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
