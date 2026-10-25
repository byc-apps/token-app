import {
  signInWithPopup,
  signOut as firebaseSignOut,
  User,
  UserCredential,
} from "firebase/auth";
import { auth, googleProvider } from "./config";
import {
  isChristUniversityEmail,
  AUTH_ERROR_MESSAGES, // Cleanly imported from your central file
} from "../auth/domain-verification";

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
  isChristDomain?: boolean;
}

/**
 * Initiates Google SSO login and strictly verifies that the account belongs
 * to Christ University or one of its valid subdomains.
 */
export async function signInWithGoogleSSO(): Promise<AuthResult> {
  try {
    const credential: UserCredential = await signInWithPopup(auth, googleProvider);
    const user = credential.user;

    if (!user.email) {
      await firebaseSignOut(auth);
      return {
        success: false,
        error: AUTH_ERROR_MESSAGES.NO_EMAIL,
        isChristDomain: false,
      };
    }

    // Verify Christ University domain (allows any sub-domain ending with christuniversity.in)
    const isValidDomain = isChristUniversityEmail(user.email);

    if (!isValidDomain) {
      // Reject and immediately invalidate the session
      await firebaseSignOut(auth);
      return {
        success: false,
        error: AUTH_ERROR_MESSAGES.DOMAIN_UNAUTHORIZED,
        isChristDomain: false,
      };
    }

    return {
      success: true,
      user,
      isChristDomain: true,
    };
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    
    // 1. Handle Firebase domain authorization errors (e.g. Codespaces preview URL missing)
    if (err.code === "auth/unauthorized-domain") {
      console.error("Error: This domain is not authorized in the Firebase console.");
      return {
        success: false,
        error: AUTH_ERROR_MESSAGES.CONFIG_ERROR_FIREBASE,
      };
    }

    // 2. Handle when user closes the Google authentication modal manually
    if (err.code === "auth/popup-closed-by-user") {
      return {
        success: false,
        error: AUTH_ERROR_MESSAGES.AUTH_POPUP_CLOSED,
      };
    }

    // 3. Fallback generic error handler
    return {
      success: false,
      error: err.message || AUTH_ERROR_MESSAGES.SIGN_IN_FAILED,
    };
  }
}

/**
 * Sign out current authenticated user
 */
export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}
