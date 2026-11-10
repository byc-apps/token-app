import { z } from "zod";
import { DEFAULT_ALLOWED_DOMAIN } from "../shared/email";

const envSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().min(1),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  ALLOWED_EMAIL_DOMAIN: z.string().min(1).default(DEFAULT_ALLOWED_DOMAIN),
  BOOTSTRAP_ADMIN_EMAILS: z.string().default(""),
});

export interface ServerEnv {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  allowedDomain: string;
  bootstrapAdmins: string[];
}

let cached: ServerEnv | undefined;

/** Validated lazily so `next build` works without secrets. Never logs values. */
export function getEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid server environment: ${names}`);
  }
  const e = parsed.data;
  cached = {
    projectId: e.FIREBASE_PROJECT_ID,
    clientEmail: e.FIREBASE_CLIENT_EMAIL,
    privateKey: e.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    allowedDomain: e.ALLOWED_EMAIL_DOMAIN.trim().toLowerCase(),
    bootstrapAdmins: e.BOOTSTRAP_ADMIN_EMAILS.split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  };
  return cached;
}
