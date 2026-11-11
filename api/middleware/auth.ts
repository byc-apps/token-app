import { createMiddleware } from "hono/factory";
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth } from "../lib/firebase-admin";
import { getEnv } from "../lib/env";
import { AppError, forbidden, unauthenticated } from "../lib/errors";
import { isAllowedEmail } from "../shared/email";
import { getUserById } from "../services/users";
import type { AppEnv } from "../types";

/**
 * Verifies the Firebase ID token from `Authorization: Bearer <token>`.
 * Server-side re-check of everything the browser claims:
 *  - signature, expiry and REVOCATION
 *  - Google sign-in only
 *  - verified email on the CHRIST domain (strict match)
 */
export async function authenticateToken(header: string | undefined): Promise<DecodedIdToken> {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  if (!match) throw unauthenticated();

  const authClient = adminAuth();

 let decoded: DecodedIdToken;
  try {
    decoded = await authClient.verifyIdToken(match[1], true);
  } catch (err) {
    console.error("token_verify_failed", { code: (err as { code?: string }).code });
    throw new AppError(401, "INVALID_TOKEN", "Your session is invalid or expired. Please sign in again.");
  }

  if (decoded.firebase?.sign_in_provider !== "google.com") {
    throw forbidden("Only Google sign-in is allowed.");
  }
  if (!decoded.email || decoded.email_verified !== true) {
    throw new AppError(403, "EMAIL_NOT_VERIFIED", "Your email address is not verified.");
  }
  if (!isAllowedEmail(decoded.email, getEnv().allowedDomain)) {
    throw new AppError(403, "DOMAIN_NOT_ALLOWED", "Only CHRIST University accounts can use this app.");
  }
  return decoded;
}

/** Requires a valid token AND an existing, active user record. Sets c.var.user. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const decoded = await authenticateToken(c.req.header("authorization"));
  const user = await getUserById(decoded.uid);
  if (!user) {
    throw new AppError(403, "NOT_REGISTERED", "Account not set up yet. Please sign in again.");
  }
  if (user.status !== "active") {
    throw new AppError(403, "ACCOUNT_DISABLED", "This account has been disabled. Contact the App Admin.");
  }
  c.set("user", user);
  await next();
});
