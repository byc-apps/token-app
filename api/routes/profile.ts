import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { parseJson } from "../lib/validate";
import { completeProfile, updateMobile } from "../services/profile";
import { toPublicUser } from "../services/users";
import { mobileBodySchema, profileBodySchema } from "../shared/schemas";
import type { AppEnv } from "../types";

export const profileRoutes = new Hono<AppEnv>();

/** "Complete your profile": account type, Register No. / Employee ID, department, mobile. */
profileRoutes.put("/me/profile", requireAuth, async (c) => {
  const body = await parseJson(c, profileBodySchema);
  const user = await completeProfile(c.get("user"), body, c.get("requestId"));
  return c.json({ user: toPublicUser(user) });
});

/** The only profile field users can keep editing themselves. */
profileRoutes.patch("/me/mobile", requireAuth, async (c) => {
  const { mobile } = await parseJson(c, mobileBodySchema);
  const user = await updateMobile(c.get("user"), mobile);
  return c.json({ user: toPublicUser(user) });
});
