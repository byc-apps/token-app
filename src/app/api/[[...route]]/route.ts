import { handle } from "hono/vercel";
import { app } from "../../../../api/app";

// The ONLY backend file inside src/. All logic lives in /api at the repo root.
export const runtime = "nodejs"; // firebase-admin needs Node, not Edge
export const dynamic = "force-dynamic";

const handler = handle(app);
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
