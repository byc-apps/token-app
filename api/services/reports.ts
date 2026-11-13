import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "../lib/firebase-admin";
import { badRequest, forbidden } from "../lib/errors";
import { isGlobalRole } from "../shared/roles";
import { aggregateTokens, averageRating, type CentreReport, type Rating } from "../shared/reports";
import type { UserWithId } from "../shared/schemas";
import { daysBetween } from "../shared/time";
import { tokenDocSchema, type TokenDoc } from "../shared/tokens";
import { parseCentre } from "./centres";
import { getBookingSettings } from "./settings";
import { tokensCol } from "./token-common";

const MAX_DAYS = 62;
const MAX_DOCS = 30000;

export async function summary(actor: UserWithId, q: { from: string; to: string; centreId?: string }) {
  if (q.from > q.to) throw badRequest("'from' must not be after 'to'.");
  if (daysBetween(q.from, q.to) > MAX_DAYS) throw badRequest(`Choose at most ${MAX_DAYS} days.`);

  const db = adminDb();
  const global = isGlobalRole(actor.role);
  let scope: string[] | null; // null = every centre
  if (q.centreId) {
    if (!global && !actor.centreIds.includes(q.centreId)) throw forbidden("You can only see your own centres.");
    scope = [q.centreId];
  } else {
    scope = global ? null : actor.centreIds;
  }
  if (scope && scope.length === 0) return { from: q.from, to: q.to, centres: [], totals: null, truncated: false };

  const centreSnaps = await db.collection("centres").get();
  const centres = centreSnaps.docs.map((d) => parseCentre(d.id, d.data()));
  const wanted = centres.filter((c) => !scope || scope.includes(c.id));

  const tokenDocs: { centreId: string; t: TokenDoc }[] = [];
  const ratings = new Map<string, number[]>();
  let truncated = false;

  const take = (docs: QueryDocumentSnapshot[]) => {
    for (const d of docs) {
      const parsed = tokenDocSchema.safeParse(d.data());
      if (parsed.success) tokenDocs.push({ centreId: parsed.data.centreId, t: parsed.data });
    }
  };

  if (scope) {
    for (const id of scope) {
      const s = await tokensCol().where("centreId", "==", id).where("date", ">=", q.from).where("date", "<=", q.to).limit(MAX_DOCS).get();
      take(s.docs);
      if (s.size >= MAX_DOCS) truncated = true;
      const f = await db.collection("feedback").where("centreId", "==", id).where("date", ">=", q.from).where("date", "<=", q.to).limit(MAX_DOCS).get();
      ratings.set(id, f.docs.map((d) => d.data().rating as number));
    }
  } else {
    const s = await tokensCol().where("date", ">=", q.from).where("date", "<=", q.to).limit(MAX_DOCS).get();
    take(s.docs);
    if (s.size >= MAX_DOCS) truncated = true;
    const f = await db.collection("feedback").where("date", ">=", q.from).where("date", "<=", q.to).limit(MAX_DOCS).get();
    for (const d of f.docs) {
      const cid = d.data().centreId as string;
      ratings.set(cid, [...(ratings.get(cid) ?? []), d.data().rating as number]);
    }
  }

  const { noShowGraceMinutes } = await getBookingSettings();
  const now = Date.now();
  const rows: (CentreReport & { name: string; confidential: boolean; kind: string; rating: Rating })[] = [];
  for (const c of wanted) {
    const mine = tokenDocs.filter((x) => x.centreId === c.id).map((x) => x.t);
    // Confidential centres: totals only, unless the viewer works there.
    const detail = !c.confidential || actor.centreIds.includes(c.id);
    rows.push({
      ...aggregateTokens(c.id, mine, now, noShowGraceMinutes, detail),
      name: c.name,
      confidential: c.confidential,
      kind: c.kind,
      rating: averageRating(ratings.get(c.id) ?? []),
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));

  const all = tokenDocs.filter((x) => wanted.some((c) => c.id === x.centreId)).map((x) => x.t);
  const totals = aggregateTokens("all", all, now, noShowGraceMinutes, false);
  return { from: q.from, to: q.to, centres: rows, totals, truncated };
}

/** What one staff member did: tokens they served. */
export async function myActivity(actor: UserWithId, q: { from: string; to: string }) {
  if (q.from > q.to) throw badRequest("'from' must not be after 'to'.");
  if (daysBetween(q.from, q.to) > MAX_DAYS) throw badRequest(`Choose at most ${MAX_DAYS} days.`);
  const snap = await tokensCol().where("servedBy", "==", actor.uid).where("date", ">=", q.from).where("date", "<=", q.to).limit(MAX_DOCS).get();
  const tokens: TokenDoc[] = [];
  for (const d of snap.docs) {
    const p = tokenDocSchema.safeParse(d.data());
    if (p.success) tokens.push(p.data);
  }
  const { noShowGraceMinutes } = await getBookingSettings();
  return aggregateTokens("me", tokens, Date.now(), noShowGraceMinutes, true);
}
