import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";

export interface AuditEntry {
  actorUid: string;
  action: string; // e.g. "user.register", "user.role_change"
  targetType: string; // e.g. "user", "centre", "token"
  targetId: string;
  centreId?: string | null;
  /** Small, non-sensitive details only. Never put tokens or secrets here. */
  meta?: Record<string, string | number | boolean | null>;
  requestId?: string;
}

/**
 * Append-only audit trail in `auditLogs`. A failed audit write is logged but
 * does not break the user's request.
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await adminDb()
      .collection("auditLogs")
      .add({ ...entry, createdAt: FieldValue.serverTimestamp() });
  } catch {
    console.error("audit_write_failed", { action: entry.action, requestId: entry.requestId });
  }
}
