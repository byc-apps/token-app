import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/guard";
import { parseJson } from "../lib/validate";
import { getIdFormats, updateIdFormats } from "../services/settings";
import { settingsPatchSchema } from "../shared/schemas";
import type { AppEnv } from "../types";

export const settingsRoutes = new Hono<AppEnv>();

/** Any signed-in user (the profile form shows the expected ID format). */
settingsRoutes.get("/settings", requireAuth, async (c) =>
  c.json({ idFormats: await getIdFormats() }),
);

settingsRoutes.patch("/settings", requireAuth, requirePermission("settings:manage"), async (c) => {
  const body = await parseJson(c, settingsPatchSchema);
  return c.json(await updateIdFormats(c.get("user"), body, c.get("requestId")));
});
