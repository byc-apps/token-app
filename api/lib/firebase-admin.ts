import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getEnv } from "./env";

function adminApp(): App {
  if (getApps().length > 0) return getApp();
  const env = getEnv();
  return initializeApp({
    credential: cert({
      projectId: env.projectId,
      clientEmail: env.clientEmail,
      privateKey: env.privateKey,
    }),
  });
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}

let db: Firestore | undefined;

/** Singleton: warm serverless instances reuse the same connection. */
export function adminDb(): Firestore {
  if (!db) {
    const instance = getFirestore(adminApp());
    try {
      instance.settings({ ignoreUndefinedProperties: true });
    } catch {
      /* settings already applied (dev hot reload) */
    }
    db = instance;
  }
  return db;
}
