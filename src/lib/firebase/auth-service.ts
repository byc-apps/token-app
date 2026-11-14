import {
  signInWithPopup,
  signOut as firebaseSignOut,
  User,
  UserCredential,
} from "firebase/auth";
import { auth, googleProvider } from "./config";

export interface AuthResult {
  success: true;
  user: User;
}

export interface AuthFailure {
  success: false;
  error: string;
}

export async function signInWithGoogleSSO(): Promise<AuthResult | AuthFailure> {
  try {
    const credential: UserCredential = await signInWithPopup(auth, googleProvider);
    return { success: true, user: credential.user };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Sign-in failed.",
    };
  }
}

export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}
