import type { Context } from "hono";
import { centreIdSchema, listItemIdSchema, dateKeySchema, uidSchema } from "../shared/schemas";
import type { AppEnv } from "../types";
import { parseParam } from "./validate";

export const centreIdParam = (c: Context<AppEnv>) => parseParam(centreIdSchema, c.req.param("id") ?? "");
export const itemIdParam = (c: Context<AppEnv>, name: string) => parseParam(listItemIdSchema, c.req.param(name) ?? "");
export const dateParam = (c: Context<AppEnv>, name: string) => parseParam(dateKeySchema, c.req.param(name) ?? "");
export const uidParam = (c: Context<AppEnv>, name: string) => parseParam(uidSchema, c.req.param(name) ?? "");
