import { FieldPath, Timestamp, type Query } from "firebase-admin/firestore";
import { adminDb } from "../lib/firebase-admin";
import { badRequest } from "../lib/errors";

/** One filter at a time (centre, person or action). Newest first. */
export async function listAudit(query: {
  centreId?: string;
  actorUid?: string;
  action?: string;
  limit: number;
  cursor?: string;
}) {
  const filters = [query.centreId, query.actorUid, query.action].filter(Boolean).length;
  if (filters > 1) throw badRequest("Use only one filter at a time.");

  let q: Query = adminDb().collection("auditLogs");
  if (query.centreId) q = q.where("centreId", "==", query.centreId);
  if (query.actorUid) q = q.where("actorUid", "==", query.actorUid);
  if (query.action) q = q.where("action", "==", query.action);
  q = q.orderBy("createdAt", "desc").orderBy(FieldPath.documentId(), "desc");
  if (query.cursor) {
    const [ms, id] = query.cursor.split("|");
    if (ms && id && Number.isFinite(Number(ms))) q = q.startAfter(Timestamp.fromMillis(Number(ms)), id);
  }
  const snap = await q.limit(query.limit + 1).get();
  const page = snap.docs.slice(0, query.limit);
  const entries = page.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      at: (x.createdAt as Timestamp | undefined)?.toMillis() ?? null,
      actorUid: x.actorUid,
      action: x.action,
      targetType: x.targetType,
      targetId: x.targetId,
      centreId: x.centreId ?? null,
      meta: x.meta ?? null,
      requestId: x.requestId ?? null,
    };
  });
  const last = page[page.length - 1];
  const lastAt = (last?.data().createdAt as Timestamp | undefined)?.toMillis();
  return {
    entries,
    nextCursor: snap.docs.length > query.limit && last && lastAt !== undefined ? `${lastAt}|${last.id}` : null,
  };
}
