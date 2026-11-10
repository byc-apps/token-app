import { z } from "zod";
import { ROLES } from "./roles";

export const roleSchema = z.enum(ROLES);
export const userTypeSchema = z.enum(["student", "faculty"]);
export const userStatusSchema = z.enum(["active", "disabled"]);

export const centreIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid centre id");

const nullableText = (max: number) => z.string().max(max).nullable().default(null);

const primaryInCentres = (v: { primaryCentreId: string | null; centreIds: string[] }) =>
  v.primaryCentreId === null || v.centreIds.includes(v.primaryCentreId);
const primaryMessage = {
  message: "primaryCentreId must be one of centreIds",
  path: ["primaryCentreId"],
};

/** Shape of a document in `users/{uid}`. */
export const userDocSchema = z
  .object({
    email: z.email(),
    name: z.string().min(1).max(200),
    role: roleSchema,
    status: userStatusSchema,
    userType: userTypeSchema.nullable().default(null),
    centreIds: z.array(centreIdSchema).max(50).default([]),
    primaryCentreId: centreIdSchema.nullable().default(null),
    regNo: nullableText(40),
    empId: nullableText(40),
    department: nullableText(120),
    mobile: nullableText(20),
  })
  .refine(primaryInCentres, primaryMessage);
export type UserDoc = z.infer<typeof userDocSchema>;
export type UserWithId = UserDoc & { uid: string };

/** Shape of a document in `preregistered/{email}` (added by an admin before first login). */
export const preRegisteredSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    role: roleSchema.default("student_faculty"),
    userType: userTypeSchema.nullable().default(null),
    centreIds: z.array(centreIdSchema).max(50).default([]),
    primaryCentreId: centreIdSchema.nullable().default(null),
    regNo: nullableText(40),
    empId: nullableText(40),
    department: nullableText(120),
    mobile: nullableText(20),
  })
  .refine(primaryInCentres, primaryMessage);
export type PreRegistered = z.infer<typeof preRegisteredSchema>;
