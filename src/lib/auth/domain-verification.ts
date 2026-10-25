/**
 * Christ University Domain Verification Utility
 * 
 * Enforces authentication domain rules allowing any sub-domain ending with 
 * christuniversity.in (e.g., @student.christuniversity.in, @christuniversity.in).
 */

export const CHRIST_UNIVERSITY_DOMAIN = "christuniversity.in";

export const AUTH_ERROR_MESSAGES = {
  DOMAIN_UNAUTHORIZED:
    "Access Restricted: Only Christ University accounts (@christuniversity.in or valid subdomains such as @student.christuniversity.in) are permitted. Please switch to your official university Google account.",
  NO_EMAIL:
    "Authentication Failed: No email address was returned by Google SSO. Please ensure your account has a primary email configured.",
  SIGN_IN_FAILED:
    "Failed to complete Google SSO sign-in. Please try again or check your internet connection.",
  AUTH_POPUP_CLOSED:
    "Sign-in popup was closed before completing authentication. Please click sign-in to try again.",
  CONFIG_ERROR_FIREBASE:
    "This domain(URL) is not authorized in the Firebase console."
};

/**
 * Validates whether an email address belongs to Christ University or any of its valid subdomains.
 * Examples allowed:
 * - user@christuniversity.in
 * - student@student.christuniversity.in
 * - scholar@res.christuniversity.in
 * - student@bba.christuniversity.in
 * 
 * Rejections:
 * - user@gmail.com
 * - attacker@fakechristuniversity.in
 * - attacker@christuniversity.in.attacker.com
 * - user@christuniversity.org
 */
export function isChristUniversityEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") {
    return false;
  }

  const trimmed = email.trim().toLowerCase();
  
  // Basic email pattern check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return false;
  }

  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex === -1) return false;

  const domain = trimmed.slice(atIndex + 1);

  // Exact match with christuniversity.in OR any subdomain ending with .christuniversity.in
  return domain === CHRIST_UNIVERSITY_DOMAIN || domain.endsWith(`.${CHRIST_UNIVERSITY_DOMAIN}`);
}

/**
 * Extracts student or faculty user details from email domain
 */
export function getUserRoleFromEmail(email: string): "student" | "faculty" | "admin" | "staff" {
  const lower = email.toLowerCase().trim();
  if (lower.startsWith("admin.") || lower.startsWith("ssc.admin@")) {
    return "admin";
  }
  if (lower.includes("@student.christuniversity.in")) {
    return "student";
  }
  return "faculty"; // Default university staff/faculty for @christuniversity.in
}
