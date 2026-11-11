import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/guard";
import { parseJson, parseParam } from "../lib/validate";
import { createCentre, getCentre, listCentres, updateCentre } from "../services/centres";
import { centreIdSchema, createCentreSchema, updateCentreSchema } from "../shared/schemas";
import type { AppEnv } from "../types";

export const centreRoutes = new Hono<AppEnv>();

/** Any signed-in user: active centres (students book from this list). */
centreRoutes.get("/centres", requireAuth, async (c) =>
  c.json({ centres: await listCentres(c.get("user")) }),
);

centreRoutes.get("/centres/:id", requireAuth, async (c) => {
  const id = parseParam(centreIdSchema, c.req.param("id"));
  return c.json({ centre: await getCentre(c.get("user"), id) });
});

centreRoutes.post("/centres", requireAuth, requirePermission("centres:manage"), async (c) => {
  const body = await parseJson(c, createCentreSchema);
  const centre = await createCentre(c.get("user"), body, c.get("requestId"));
  return c.json({ centre }, 201);
});

centreRoutes.patch("/centres/:id", requireAuth, requirePermission("centres:manage"), async (c) => {
  const id = parseParam(centreIdSchema, c.req.param("id"));
  const body = await parseJson(c, updateCentreSchema);
  const centre = await updateCentre(c.get("user"), id, body, c.get("requestId"));
  return c.json({ centre });
});
