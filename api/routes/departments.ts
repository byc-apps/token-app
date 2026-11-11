import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/guard";
import { parseJson, parseParam } from "../lib/validate";
import { createDepartment, listDepartments, updateDepartment } from "../services/departments";
import {
  centreIdSchema,
  createDepartmentSchema,
  updateDepartmentSchema,
} from "../shared/schemas";
import type { AppEnv } from "../types";

export const departmentRoutes = new Hono<AppEnv>();

/** Any signed-in user: active departments (profile dropdown). */
departmentRoutes.get("/departments", requireAuth, async (c) =>
  c.json({ departments: await listDepartments(c.get("user")) }),
);

departmentRoutes.post("/departments", requireAuth, requirePermission("centres:manage"), async (c) => {
  const body = await parseJson(c, createDepartmentSchema);
  const result = await createDepartment(c.get("user"), body, c.get("requestId"));
  return c.json(result, 201);
});

departmentRoutes.patch(
  "/departments/:id",
  requireAuth,
  requirePermission("centres:manage"),
  async (c) => {
    const id = parseParam(centreIdSchema, c.req.param("id"));
    const body = await parseJson(c, updateDepartmentSchema);
    const department = await updateDepartment(c.get("user"), id, body, c.get("requestId"));
    return c.json({ department });
  },
);
