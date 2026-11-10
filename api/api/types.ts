import type { UserWithId } from "../shared/schemas";

/** Hono environment: values stored on the request context. */
export type AppEnv = {
  Variables: {
    requestId: string;
    user: UserWithId;
  };
};
