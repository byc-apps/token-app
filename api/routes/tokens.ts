import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/guard";
import { centreIdParam, uidParam } from "../lib/scope";
import { parseJson, parseParam, parseQuery } from "../lib/validate";
import { z } from "zod";
import {
  approveToken,
  cancelByAdmin,
  cancelByUser,
  createBooking,
  getMyToken,
  listCentreTokens,
  listMyTokens,
  modifyToken,
  rejectToken,
} from "../services/booking";
import { addNote, callNext, checkInBySelf, checkInByStaff, closeToken, createWalkIn, getDisplay, getQueue, transferToken } from "../services/queue";
import { giveFeedback, listFeedback } from "../services/feedback";
import { updateEmailPrefs } from "../services/outbox";
import { toPublicUser } from "../services/users";
import {
  bookTokenSchema,
  counterBodySchema,
  emailPrefsSchema,
  feedbackSchema,
  modifyTokenSchema,
  myTokensQuerySchema,
  noteBodySchema,
  optionalReasonSchema,
  pagedQuerySchema,
  reasonBodySchema,
  tokenListQuerySchema,
  walkInSchema,
} from "../shared/schemas";
import type { AppEnv } from "../types";

export const tokenRoutes = new Hono<AppEnv>();

const tokenId = (c: Parameters<typeof uidParam>[0]) => parseParam(z.string().min(1).max(40).regex(/^[A-Za-z0-9]+$/), c.req.param("id") ?? "");

/* ----------------------- student / faculty ----------------------- */

tokenRoutes.post("/tokens", requireAuth, requirePermission("tokens:book"), async (c) => {
  const body = await parseJson(c, bookTokenSchema);
  return c.json({ token: await createBooking(c.get("user"), body, c.get("requestId")) }, 201);
});

tokenRoutes.get("/me/tokens", requireAuth, requirePermission("tokens:book"), async (c) => {
  const q = parseQuery(c, myTokensQuerySchema);
  return c.json(await listMyTokens(c.get("user"), q.limit, q.cursor));
});

tokenRoutes.get("/me/tokens/:id", requireAuth, requirePermission("tokens:book"), async (c) =>
  c.json(await getMyToken(c.get("user"), tokenId(c))),
);

tokenRoutes.post("/me/tokens/:id/cancel", requireAuth, requirePermission("tokens:cancel_own"), async (c) =>
  c.json(await cancelByUser(c.get("user"), tokenId(c), c.get("requestId"))),
);

tokenRoutes.post("/me/tokens/:id/check-in", requireAuth, requirePermission("tokens:book"), async (c) =>
  c.json(await checkInBySelf(c.get("user"), tokenId(c), c.get("requestId"))),
);

tokenRoutes.post("/me/tokens/:id/feedback", requireAuth, requirePermission("feedback:give"), async (c) => {
  const body = await parseJson(c, feedbackSchema);
  return c.json(await giveFeedback(c.get("user"), tokenId(c), body, c.get("requestId")), 201);
});

/** Reminder and feedback emails can be switched off. Confirmations are always sent. */
tokenRoutes.patch("/me/email-prefs", requireAuth, async (c) => {
  const body = await parseJson(c, emailPrefsSchema);
  const emailPrefs = await updateEmailPrefs(c.get("user"), body);
  return c.json({ user: toPublicUser({ ...c.get("user"), emailPrefs }) });
});

/* --------------------- centre staff and admins ------------------- */

const serve = [requireAuth, requirePermission("tokens:serve")] as const;
const manageTokens = [requireAuth, requirePermission("tokens:manage")] as const;

tokenRoutes.get("/centres/:id/tokens", ...serve, async (c) => {
  const q = parseQuery(c, tokenListQuerySchema);
  return c.json(await listCentreTokens(c.get("user"), centreIdParam(c), q.date, q.status));
});

tokenRoutes.post("/tokens/:id/approve", ...manageTokens, async (c) =>
  c.json(await approveToken(c.get("user"), tokenId(c), c.get("requestId"))),
);

tokenRoutes.post("/tokens/:id/reject", ...manageTokens, async (c) => {
  const body = await parseJson(c, reasonBodySchema);
  return c.json(await rejectToken(c.get("user"), tokenId(c), body.reason, c.get("requestId")));
});

tokenRoutes.post("/tokens/:id/cancel", ...manageTokens, async (c) => {
  const body = await parseJson(c, optionalReasonSchema);
  return c.json(await cancelByAdmin(c.get("user"), tokenId(c), body.reason, c.get("requestId")));
});

tokenRoutes.patch("/tokens/:id", ...manageTokens, async (c) => {
  const body = await parseJson(c, modifyTokenSchema);
  return c.json(await modifyToken(c.get("user"), tokenId(c), body, c.get("requestId")));
});

tokenRoutes.post("/tokens/:id/check-in", ...serve, async (c) =>
  c.json(await checkInByStaff(c.get("user"), tokenId(c), c.get("requestId"))),
);

tokenRoutes.post("/tokens/:id/close", ...serve, async (c) =>
  c.json(await closeToken(c.get("user"), tokenId(c), c.get("requestId"))),
);

tokenRoutes.post("/tokens/:id/transfer", ...serve, async (c) => {
  const body = await parseJson(c, counterBodySchema);
  return c.json(await transferToken(c.get("user"), tokenId(c), body.counterId, c.get("requestId")));
});

tokenRoutes.post("/tokens/:id/notes", ...serve, async (c) => {
  const body = await parseJson(c, noteBodySchema);
  return c.json(await addNote(c.get("user"), tokenId(c), body.text, c.get("requestId")), 201);
});

/* ----------------------------- queue ----------------------------- */

tokenRoutes.get("/centres/:id/queue", ...serve, async (c) => {
  const { etag, body } = await getQueue(c.get("user"), centreIdParam(c));
  if (c.req.header("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": "no-store" } });
  }
  c.header("ETag", etag);
  return c.json(body);
});

tokenRoutes.post("/centres/:id/queue/call-next", ...serve, async (c) => {
  const body = await parseJson(c, counterBodySchema);
  return c.json(await callNext(c.get("user"), centreIdParam(c), body.counterId, c.get("requestId")));
});

tokenRoutes.post("/centres/:id/walkins", ...serve, async (c) => {
  const body = await parseJson(c, walkInSchema);
  return c.json(await createWalkIn(c.get("user"), centreIdParam(c), body, c.get("requestId")), 201);
});

tokenRoutes.get("/centres/:id/display", ...serve, async (c) =>
  c.json(await getDisplay(c.get("user"), centreIdParam(c))),
);

/** Feedback comments for one centre (confidential centres: only their own staff). */
tokenRoutes.get("/centres/:id/feedback", requireAuth, requirePermission("reports:centre"), async (c) => {
  const q = parseQuery(c, pagedQuerySchema);
  return c.json(await listFeedback(c.get("user"), centreIdParam(c), q.limit, q.cursor));
});
