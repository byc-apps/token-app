/**
 * Strict university-domain check. Accepts `christuniversity.in` and any real
 * sub-domain (`x.christuniversity.in`). Rejects look-alikes such as
 * `evilchristuniversity.in` or `christuniversity.in.evil.com`.
 */
export const DEFAULT_ALLOWED_DOMAIN = "christuniversity.in";

const EMAIL_SHAPE = /^[^\s@/]+@[^\s@/]+$/;

export function isAllowedEmail(
  email: string | null | undefined,
  baseDomain: string = DEFAULT_ALLOWED_DOMAIN,
): boolean {
  if (!email) return false;
  const value = email.trim().toLowerCase();
  if (!EMAIL_SHAPE.test(value)) return false;
  const domain = value.slice(value.lastIndexOf("@") + 1);
  const base = baseDomain.trim().toLowerCase();
  return domain === base || domain.endsWith(`.${base}`);
}
