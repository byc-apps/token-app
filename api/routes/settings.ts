import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/guard";
import { parseJson } from "../lib/validate";
import { getSettings, updateSettings } from "../services/settings";
import { settingsPatchSchema } from "../shared/schemas";
import type { AppEnv } from "../types";

export const settingsRoutes = new Hono<AppEnv>();

/** Any signed-in user (the forms show the expected ID format and booking rules). */
settingsRoutes.get("/settings", requireAuth, async (c) => c.json(await getSettings()));

settingsRoutes.patch("/settings", requireAuth, requirePermission("settings:manage"), async (c) => {
  const body = await parseJson(c, settingsPatchSchema);
  return c.json(await updateSettings(c.get("user"), body, c.get("requestId")));
});
