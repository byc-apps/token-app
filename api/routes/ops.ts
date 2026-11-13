import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/guard";
import { getEnv } from "../lib/env";
import { AppError, forbidden, unauthenticated } from "../lib/errors";
import { parseParam, parseQuery } from "../lib/validate";
import { z } from "zod";
import { listAudit } from "../services/audit-view";
import { tick } from "../services/jobs";
import { listEmailLog, resendEmail } from "../services/outbox";
import { myActivity, summary } from "../services/reports";
import { auditQuerySchema, emailLogQuerySchema, reportQuerySchema } from "../shared/schemas";
import type { AppEnv } from "../types";

export const opsRoutes = new Hono<AppEnv>();

/* ----------------------------- reports ----------------------------- */

opsRoutes.get("/reports/summary", requireAuth, requirePermission("reports:centre"), async (c) =>
  c.json(await summary(c.get("user"), parseQuery(c, reportQuerySchema))),
);

/** What I did myself (tokens I served). */
opsRoutes.get("/me/activity", requireAuth, requirePermission("tokens:serve"), async (c) => {
  const q = parseQuery(c, reportQuerySchema.omit({ centreId: true }));
  return c.json({ activity: await myActivity(c.get("user"), q) });
});

/* ------------------------------ audit ------------------------------ */

opsRoutes.get("/audit-logs", requireAuth, requirePermission("audit:view"), async (c) =>
  c.json(await listAudit(parseQuery(c, auditQuerySchema))),
);

/* ------------------------------ emails ----------------------------- */

opsRoutes.get("/email-log", requireAuth, requirePermission("users:manage"), async (c) =>
  c.json(await listEmailLog(parseQuery(c, emailLogQuerySchema))),
);

opsRoutes.post("/email-log/:id/resend", requireAuth, requirePermission("users:manage"), async (c) => {
  const id = parseParam(z.string().min(1).max(150).regex(/^[A-Za-z0-9_-]+$/), c.req.param("id") ?? "");
  return c.json(await resendEmail(c.get("user"), id, c.get("requestId")));
});

/* ------------------------------- jobs ------------------------------ */

function secretMatches(given: string | undefined, secret: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Run every 5 minutes (Cloud Scheduler, or Vercel Cron). Send the secret as
 * "x-cron-secret: <CRON_SECRET>" or "Authorization: Bearer <CRON_SECRET>".
 * Marks no-shows, queues reminders and the daily summary, and sends queued emails.
 */
opsRoutes.on(["GET", "POST"], "/jobs/tick", async (c) => {
  const secret = getEnv().cronSecret;
  if (!secret) throw new AppError(503, "JOBS_DISABLED", "CRON_SECRET is not set.");
  const bearer = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
  const given = c.req.header("x-cron-secret") ?? bearer;
  if (!given) throw unauthenticated();
  if (!secretMatches(given, secret)) throw forbidden();
  return c.json({ ok: true, result: await tick(Date.now()) });
});
