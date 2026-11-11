import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/guard";
import { parseJson, parseParam, parseQuery } from "../lib/validate";
import {
  getUserForAdmin,
  listPreRegistered,
  listUsers,
  preRegisterUser,
  updateUser,
} from "../services/users-admin";
import {
  preRegisterBodySchema,
  uidSchema,
  userListQuerySchema,
  userPatchSchema,
} from "../shared/schemas";
import type { AppEnv } from "../types";

export const userRoutes = new Hono<AppEnv>();

// Every route here needs the users:manage permission (App Admin, Campus Authority).
userRoutes.use("/users", requireAuth, requirePermission("users:manage"));
userRoutes.use("/users/*", requireAuth, requirePermission("users:manage"));

userRoutes.get("/users", async (c) => c.json(await listUsers(parseQuery(c, userListQuerySchema))));

// Static paths must be registered BEFORE "/users/:uid".
userRoutes.get("/users/preregistered", async (c) =>
  c.json({ preregistered: await listPreRegistered() }),
);

userRoutes.post("/users/preregister", async (c) => {
  const body = await parseJson(c, preRegisterBodySchema);
  const result = await preRegisterUser(c.get("user"), body, c.get("requestId"));
  return c.json({ preregistered: result }, 201);
});

userRoutes.get("/users/:uid", async (c) => {
  const uid = parseParam(uidSchema, c.req.param("uid"));
  return c.json({ user: await getUserForAdmin(uid) });
});

userRoutes.patch("/users/:uid", async (c) => {
  const uid = parseParam(uidSchema, c.req.param("uid"));
  const patch = await parseJson(c, userPatchSchema);
  const user = await updateUser(c.get("user"), uid, patch, c.get("requestId"));
  return c.json({ user });
});
