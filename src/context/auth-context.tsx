"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onIdTokenChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { signInWithGoogleSSO, signOutUser, AuthResult } from "@/lib/firebase/auth-service";
import { isChristUniversityEmail, getUserRoleFromEmail } from "@/lib/auth/domain-verification";

interface CustomClaims {
  centerId?: string;
  role?: string;
  admin?: boolean;
  [key: string]: unknown;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  customClaims: CustomClaims | null;
  role: "student" | "faculty" | "admin" | "guest";
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customClaims, setCustomClaims] = useState<CustomClaims | null>(null);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (currentUser) => {
      if (currentUser) {
        if (!isChristUniversityEmail(currentUser.email)) {
          // Invalidate unauthorized session
          await signOutUser();
          setUser(null);
          setCustomClaims(null);
          setError("Access restricted: Only Christ University emails are allowed.");
          setLoading(false);
          return;
        }

        try {
          const idTokenResult = await currentUser.getIdTokenResult();
          setCustomClaims((idTokenResult.claims as CustomClaims) || {});
        } catch {
          setCustomClaims({});
        }
        setUser(currentUser);
      } else {
        setUser(null);
        setCustomClaims(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignIn = async (): Promise<AuthResult> => {
    setError(null);
    setLoading(true);
    const result = await signInWithGoogleSSO();
    if (!result.success) {
      setError(result.error || "Authentication failed");
    }
    setLoading(false);
    return result;
  };

  const handleSignOut = async (): Promise<void> => {
    await signOutUser();
    setUser(null);
    setCustomClaims(null);
    setError(null);
  };

  const role = user?.email
    ? (customClaims?.role as "student" | "faculty" | "admin") || getUserRoleFromEmail(user.email)
    : "guest";

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        customClaims,
        role,
        signInWithGoogle: handleSignIn,
        signOut: handleSignOut,
        clearError: () => setError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
