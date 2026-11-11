import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { assertCentreAccess, requirePermission } from "../middleware/guard";
import { parseJson, parseParam } from "../lib/validate";
import { addStaff, listStaff, removePending, removeStaff } from "../services/staff";
import { addStaffSchema, centreIdSchema, uidSchema } from "../shared/schemas";
import type { AppEnv } from "../types";

export const staffRoutes = new Hono<AppEnv>();

const emailParam = z.string().trim().toLowerCase().pipe(z.email());

// Centre Admins (for their own centres) and App Admin / Campus Authority (all centres).
staffRoutes.use("/centres/:id/staff", requireAuth, requirePermission("centre:configure"));
staffRoutes.use("/centres/:id/staff/*", requireAuth, requirePermission("centre:configure"));
staffRoutes.use("/centres/:id/pending/*", requireAuth, requirePermission("centre:configure"));

/** Reads the centre id and checks the caller may act on THAT centre. */
function scopedCentre(c: { req: { param: (k: string) => string }; get: (k: "user") => AppEnv["Variables"]["user"] }) {
  const centreId = parseParam(centreIdSchema, c.req.param("id"));
  assertCentreAccess(c.get("user"), centreId);
  return centreId;
}

staffRoutes.get("/centres/:id/staff", async (c) =>
  c.json(await listStaff(scopedCentre(c))),
);

staffRoutes.post("/centres/:id/staff", async (c) => {
  const centreId = scopedCentre(c);
  const body = await parseJson(c, addStaffSchema);
  const result = await addStaff(c.get("user"), centreId, body, c.get("requestId"));
  return c.json({ added: result }, 201);
});

staffRoutes.delete("/centres/:id/staff/:uid", async (c) => {
  const centreId = scopedCentre(c);
  const uid = parseParam(uidSchema, c.req.param("uid"));
  await removeStaff(c.get("user"), centreId, uid, c.get("requestId"));
  return c.json({ removed: true });
});

staffRoutes.delete("/centres/:id/pending/:email", async (c) => {
  const centreId = scopedCentre(c);
  const email = parseParam(emailParam, decodeURIComponent(c.req.param("email")));
  await removePending(c.get("user"), centreId, email, c.get("requestId"));
  return c.json({ removed: true });
});
