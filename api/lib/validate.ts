import type { Context } from "hono";
import type { z } from "zod";
import { badRequest, validationError } from "./errors";

function parse<T extends z.ZodType>(schema: T, raw: unknown): z.output<T> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw validationError(
      result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  return result.data;
}

/** Parse + validate a JSON body. Unknown fields are rejected by strictObject schemas. */
export async function parseJson<T extends z.ZodType>(c: Context, schema: T): Promise<z.output<T>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw badRequest("Request body must be valid JSON.");
  }
  return parse(schema, raw);
}

export function parseQuery<T extends z.ZodType>(c: Context, schema: T): z.output<T> {
  return parse(schema, c.req.query());
}

export function parseParam<T extends z.ZodType>(schema: T, value: string): z.output<T> {
  return parse(schema, value);
}
