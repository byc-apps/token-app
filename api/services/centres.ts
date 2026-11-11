import { FieldValue, type Query } from "firebase-admin/firestore";
import { adminDb } from "../lib/firebase-admin";
import { writeAudit } from "../lib/audit";
import { AppError, conflict, notFound } from "../lib/errors";
import { centreIdFor, tokenPrefixFor } from "../shared/centres";
import { hasPermission } from "../shared/roles";
import {
  centreDocSchema,
  type CentreWithId,
  type CreateCentreBody,
  type UpdateCentreBody,
  type UserWithId,
} from "../shared/schemas";

export function parseCentre(id: string, data: unknown): CentreWithId {
  const parsed = centreDocSchema.safeParse(data);
  if (!parsed.success) {
    console.error("centre_record_invalid", { id });
    throw new AppError(500, "CENTRE_RECORD_INVALID", "A centre record needs attention.");
  }
  const d = parsed.data;
  return { id, ...d, tokenPrefix: tokenPrefixFor(d.kind, d.code) };
}

/** What students, faculty and staff may see about a centre or department desk. */
export function toPublicCentre(c: CentreWithId) {
  return {
    id: c.id,
    name: c.name,
    code: c.code,
    kind: c.kind,
    tokenPrefix: c.tokenPrefix,
    location: c.location,
    confidential: c.confidential,
  };
}

/** Everyone signed in sees active centres; centre managers also see inactive ones. */
export async function listCentres(viewer: UserWithId) {
  const manager = hasPermission(viewer.role, "centres:manage");
  let q: Query = adminDb().collection("centres");
  if (!manager) q = q.where("active", "==", true);
  const snap = await q.get();
  const centres = snap.docs
    .map((d) => parseCentre(d.id, d.data()))
    .sort((a, b) => a.name.localeCompare(b.name));
  return manager ? centres : centres.map(toPublicCentre);
}

export async function getCentre(viewer: UserWithId, id: string) {
  const snap = await adminDb().collection("centres").doc(id).get();
  if (!snap.exists) throw notFound("Centre not found.");
  const centre = parseCentre(id, snap.data());
  if (hasPermission(viewer.role, "centres:manage")) return centre;
  if (!centre.active) throw notFound("Centre not found.");
  return toPublicCentre(centre);
}

export async function createCentre(actor: UserWithId, body: CreateCentreBody, requestId: string) {
  const db = adminDb();
  const id = centreIdFor("centre", body.code);
  const ref = db.collection("centres").doc(id);

  await db.runTransaction(async (tx) => {
    if ((await tx.get(ref)).exists) throw conflict(`A centre with code ${body.code} already exists.`);
    tx.create(ref, {
      name: body.name,
      code: body.code,
      kind: "centre",
      confidential: body.confidential,
      location: body.location,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await writeAudit({
    actorUid: actor.uid,
    action: "centre.create",
    targetType: "centre",
    targetId: id,
    centreId: id,
    meta: { code: body.code, confidential: body.confidential },
    requestId,
  });
  return getCentre(actor, id);
}

export async function updateCentre(
  actor: UserWithId,
  id: string,
  patch: UpdateCentreBody,
  requestId: string,
) {
  const db = adminDb();
  const ref = db.collection("centres").doc(id);

  const changedFields = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFound("Centre not found.");
    const current = parseCentre(id, snap.data());

    const changes: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined && value !== current[key as keyof CentreWithId]) changes[key] = value;
    }
    if (Object.keys(changes).length > 0) {
      tx.update(ref, { ...changes, updatedAt: FieldValue.serverTimestamp() });
    }
    return Object.keys(changes);
  });

  if (changedFields.length > 0) {
    await writeAudit({
      actorUid: actor.uid,
      action: "centre.update",
      targetType: "centre",
      targetId: id,
      centreId: id,
      meta: { fields: changedFields.join(",") },
      requestId,
    });
  }
  return getCentre(actor, id);
}
