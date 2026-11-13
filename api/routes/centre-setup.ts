import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { assertCentreAccess, requirePermission } from "../middleware/guard";
import { centreIdParam, dateParam, itemIdParam } from "../lib/scope";
import { parseJson, parseQuery } from "../lib/validate";
import {
  addListItem,
  getConfig,
  getSlots,
  setSlotDay,
  updateConfig,
  updateListItem,
} from "../services/centre-setup";
import {
  addListItemSchema,
  slotDayBodySchema,
  slotsQuerySchema,
  updateConfigSchema,
  updateListItemSchema,
} from "../shared/schemas";
import type { AppEnv } from "../types";

export const centreSetupRoutes = new Hono<AppEnv>();

// Centre Admin (own centres) and App Admin / Campus Authority (all centres).
const manage = [requireAuth, requirePermission("centre:configure")] as const;

centreSetupRoutes.get("/centres/:id/config", ...manage, async (c) => {
  const id = centreIdParam(c);
  assertCentreAccess(c.get("user"), id);
  return c.json(await getConfig(id));
});

centreSetupRoutes.patch("/centres/:id/config", ...manage, async (c) => {
  const id = centreIdParam(c);
  assertCentreAccess(c.get("user"), id);
  const body = await parseJson(c, updateConfigSchema);
  return c.json(await updateConfig(c.get("user"), id, body, c.get("requestId")));
});

for (const kind of ["services", "counters"] as const) {
  centreSetupRoutes.post(`/centres/:id/${kind}`, ...manage, async (c) => {
    const id = centreIdParam(c);
    assertCentreAccess(c.get("user"), id);
    const body = await parseJson(c, addListItemSchema);
    const item = await addListItem(kind, c.get("user"), id, body.name, c.get("requestId"));
    return c.json({ item }, 201);
  });

  centreSetupRoutes.patch(`/centres/:id/${kind}/:itemId`, ...manage, async (c) => {
    const id = centreIdParam(c);
    assertCentreAccess(c.get("user"), id);
    const body = await parseJson(c, updateListItemSchema);
    const item = await updateListItem(kind, c.get("user"), id, itemIdParam(c, "itemId"), body, c.get("requestId"));
    return c.json({ item });
  });
}

/** Everyone signed in: slots of one day. Students only see today up to the booking window. */
centreSetupRoutes.get("/centres/:id/slots", requireAuth, async (c) => {
  const { date } = parseQuery(c, slotsQuerySchema);
  return c.json(await getSlots(c.get("user"), centreIdParam(c), date));
});

/** Close a day (holiday) or block some slots on one date. */
centreSetupRoutes.put("/centres/:id/slot-days/:date", ...manage, async (c) => {
  const id = centreIdParam(c);
  assertCentreAccess(c.get("user"), id);
  const body = await parseJson(c, slotDayBodySchema);
  return c.json(await setSlotDay(c.get("user"), id, dateParam(c, "date"), body, c.get("requestId")));
});
