import { Hono } from "hono";
import { authenticateToken, requireAuth } from "../middleware/auth";
import { loginOrRegister, toPublicUser } from "../services/users";
import { writeAudit } from "../lib/audit";
import { AppError } from "../lib/errors";
import type { AppEnv } from "../types";

export const authRoutes = new Hono<AppEnv>();

/**
 * Call once right after Google sign-in. Creates the user record on first login
 * (auto-registration / pre-registration / bootstrap admin) and returns the profile.
 */
authRoutes.post("/auth/login", async (c) => {
  const decoded = await authenticateToken(c.req.header("authorization"));
  const { user, created } = await loginOrRegister(decoded);

  if (user.status !== "active") {
    throw new AppError(403, "ACCOUNT_DISABLED", "This account has been disabled. Contact the App Admin.");
  }
  if (created) {
    await writeAudit({
      actorUid: user.uid,
      action: "user.register",
      targetType: "user",
      targetId: user.uid,
      meta: { role: user.role },
      requestId: c.get("requestId"),
    });
  }
  return c.json({ user: toPublicUser(user), created });
});

/** The signed-in user's own profile, role and centres. */
authRoutes.get("/me", requireAuth, (c) => c.json({ user: toPublicUser(c.get("user")) }));
