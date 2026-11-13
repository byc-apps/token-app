import { FieldPath } from "firebase-admin/firestore";
import { adminDb } from "../lib/firebase-admin";
import { writeAudit } from "../lib/audit";
import { conflict, notFound } from "../lib/errors";
import { assertTokenAccess } from "../middleware/guard";
import type { FeedbackBody, UserWithId } from "../shared/schemas";
import { istDateKey } from "../shared/time";
import { getCentreDoc } from "./centre-setup";
import { parseToken, tokensCol } from "./token-common";

/**
 * Feedback is stored with NO user id and NO token id: only the centre, the date, the
 * stars and the comment. The token only remembers that feedback was given.
 */
export async function giveFeedback(user: UserWithId, tokenId: string, body: FeedbackBody, requestId: string) {
  const db = adminDb();
  const ref = tokensCol().doc(tokenId);
  const fbRef = db.collection("feedback").doc();

  const t = await db.runTransaction(async (tx) => {
    const token = parseToken(tokenId, (await tx.get(ref)).data());
    if (token.userId !== user.uid) throw notFound("Token not found.");
    if (token.status !== "COMPLETED") throw conflict("You can rate a visit after it is completed.");
    if (token.feedbackGiven) throw conflict("You already gave feedback for this visit.");
    tx.update(ref, { feedbackGiven: true });
    tx.create(fbRef, {
      centreId: token.centreId,
      date: istDateKey(),
      rating: body.rating,
      comment: body.comment ?? null,
      serviceId: token.confidential ? null : token.serviceId,
    });
    return token;
  });
  await writeAudit({ actorUid: user.uid, action: "feedback.give", targetType: "centre", targetId: t.centreId, centreId: t.centreId, requestId });
  return { saved: true };
}

/** Comments for one centre. Confidential centres: only their own staff. */
export async function listFeedback(actor: UserWithId, centreId: string, limit: number, cursor?: string) {
  const centre = await getCentreDoc(centreId);
  assertTokenAccess(actor, centre);
  let q = adminDb()
    .collection("feedback")
    .where("centreId", "==", centreId)
    .orderBy("date", "desc")
    .orderBy(FieldPath.documentId(), "desc");
  if (cursor) {
    const [date, id] = cursor.split("|");
    if (date && id) q = q.startAfter(date, id);
  }
  const snap = await q.limit(limit + 1).get();
  const page = snap.docs.slice(0, limit);
  const last = page[page.length - 1];
  return {
    feedback: page.map((d) => ({
      date: d.data().date as string,
      rating: d.data().rating as number,
      comment: (d.data().comment as string | null) ?? null,
    })),
    nextCursor: snap.docs.length > limit && last ? `${last.data().date}|${last.id}` : null,
  };
}
