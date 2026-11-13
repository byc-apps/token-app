/**
 * One-off, safe to re-run: creates the centres that don't exist yet.
 *   npx tsx scripts/seed-centres.ts
 *
 * REVIEW THE CODES FIRST. A code is the token prefix (e.g. ITS-014) and the centre id,
 * and it cannot be changed after creation. Names, location and flags can be edited later.
 */
import { loadEnvConfig } from "@next/env";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../lib/firebase-admin";

loadEnvConfig(process.cwd());

const CENTRES = [
  { code: "IPM", name: "IPM", confidential: false },
  { code: "ITS", name: "IT Services", confidential: false },
  { code: "ADM", name: "Admission / Certificates", confidential: false },
  { code: "EXM", name: "Exam Office", confidential: false },
  { code: "HLT", name: "CCHS - Health Centre", confidential: true },
  { code: "CNS", name: "CCHS - Counselor", confidential: true, neutral: true },
  { code: "CAPS", name: "CAPS", confidential: true, neutral: true },
  { code: "FAC", name: "Facility Management", confidential: false },
  { code: "ACC", name: "Accounts", confidential: false },
];

async function main() {
  const db = adminDb();
  for (const c of CENTRES) {
    const id = c.code.toLowerCase();
    const ref = db.collection("centres").doc(id);
    if ((await ref.get()).exists) {
      console.log(`skip    ${c.code} (already exists)`);
      continue;
    }
    await ref.create({
      name: c.name,
      code: c.code,
      kind: "centre",
      confidential: c.confidential,
      location: null,
      active: true,
      // Counselor and CAPS show a neutral screen (no token numbers) on the display.
      config: { displayMode: "neutral" in c && c.neutral ? "neutral" : "tokens" },
      services: [],
      counters: [{ id: "c1", name: "Counter 1", active: true }],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`created ${c.code}  ${c.name}${c.confidential ? "  [confidential]" : ""}`);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("seed failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
