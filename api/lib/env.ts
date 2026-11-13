import { z } from "zod";
import { DEFAULT_ALLOWED_DOMAIN } from "../shared/email";

const envSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().min(1),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  ALLOWED_EMAIL_DOMAIN: z.string().min(1).default(DEFAULT_ALLOWED_DOMAIN),
  BOOTSTRAP_ADMIN_EMAILS: z.string().default(""),
  CRON_SECRET: z.string().min(16).optional(),
  APP_URL: z.string().default("http://localhost:3000"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_SECURE: z.enum(["true", "false"]).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),
});

export interface ServerEnv {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  allowedDomain: string;
  bootstrapAdmins: string[];
  cronSecret: string | null;
  appUrl: string;
  /** null until SMTP_HOST and MAIL_FROM are set: emails then stay queued. */
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string | null;
    pass: string | null;
    from: string;
  } | null;
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
    cronSecret: e.CRON_SECRET ?? null,
    appUrl: e.APP_URL.replace(/\/$/, ""),
    smtp:
      e.SMTP_HOST && e.MAIL_FROM
        ? {
            host: e.SMTP_HOST,
            port: e.SMTP_PORT ?? 587,
            secure: e.SMTP_SECURE === "true",
            user: e.SMTP_USER ?? null,
            pass: e.SMTP_PASS ?? null,
            from: e.MAIL_FROM,
          }
        : null,
  };
  return cached;
}
