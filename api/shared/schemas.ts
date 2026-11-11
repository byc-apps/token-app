import { z } from "zod";
import { ROLES, isCentreRole, type Role } from "./roles";

export const roleSchema = z.enum(ROLES);
export const userTypeSchema = z.enum(["student", "faculty"]);
export const userStatusSchema = z.enum(["active", "disabled"]);
export const centreKindSchema = z.enum(["centre", "department"]);

export const centreIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid centre id");

/** Firebase Auth uids are short alphanumeric strings. */
export const uidSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9]+$/, "Invalid user id");

const MOBILE = /^\+?[0-9][0-9\s-]{6,18}$/;
const mobileSchema = z.string().trim().regex(MOBILE, "Invalid mobile number");
const normalisedEmail = z.string().trim().toLowerCase().pipe(z.email());

const nullableText = (max: number) => z.string().max(max).nullable().default(null);

const uniqueIds = (ids: string[]) => new Set(ids).size === ids.length;
const centreIdList = z
  .array(centreIdSchema)
  .max(50)
  .refine(uniqueIds, "Duplicate centres are not allowed");

const nonEmpty = (v: object) => Object.keys(v).length > 0;
const NON_EMPTY_MSG = "Provide at least one field to update.";

const primaryInCentres = (v: { primaryCentreId: string | null; centreIds: string[] }) =>
  v.primaryCentreId === null || v.centreIds.includes(v.primaryCentreId);
const primaryMessage = {
  message: "primaryCentreId must be one of centreIds",
  path: ["primaryCentreId"],
};

/** Centre Admin / Staff need at least one centre; every other role must have none. */
export function roleCentreProblem(role: Role, centreIds: string[]): string | null {
  if (isCentreRole(role)) {
    return centreIds.length === 0 ? "Centre Admin and Centre Staff need at least one centre." : null;
  }
  return centreIds.length > 0
    ? "Only Centre Admin and Centre Staff can be assigned to centres."
    : null;
}

/* ------------------------------ users ------------------------------ */

/** Shape of a document in `users/{uid}`. */
export const userDocSchema = z
  .object({
    email: z.email(),
    name: z.string().min(1).max(200),
    role: roleSchema,
    status: userStatusSchema,
    /** false = self-registered and not yet checked by an admin ("Unverified" list). */
    verified: z.boolean().default(false),
    userType: userTypeSchema.nullable().default(null),
    centreIds: z.array(centreIdSchema).max(50).default([]),
    primaryCentreId: centreIdSchema.nullable().default(null),
    regNo: nullableText(40),
    empId: nullableText(40),
    /** id of a department desk (centres collection, kind "department") */
    departmentId: centreIdSchema.nullable().default(null),
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
    departmentId: centreIdSchema.nullable().default(null),
    mobile: nullableText(20),
  })
  .refine(primaryInCentres, primaryMessage);
export type PreRegistered = z.infer<typeof preRegisteredSchema>;

/** PATCH /users/:uid — only these fields can ever be changed; anything else is rejected. */
export const userPatchSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(200).optional(),
    role: roleSchema.optional(),
    status: userStatusSchema.optional(),
    verified: z.boolean().optional(),
    userType: userTypeSchema.nullable().optional(),
    centreIds: centreIdList.optional(),
    primaryCentreId: centreIdSchema.nullable().optional(),
    regNo: z.string().trim().min(1).max(40).nullable().optional(),
    empId: z.string().trim().min(1).max(40).nullable().optional(),
    departmentId: centreIdSchema.nullable().optional(),
    mobile: mobileSchema.nullable().optional(),
  })
  .refine(nonEmpty, NON_EMPTY_MSG);
export type UserPatch = z.output<typeof userPatchSchema>;

/** POST /users/preregister */
export const preRegisterBodySchema = z.strictObject({
  email: normalisedEmail,
  name: z.string().trim().min(1).max(200).optional(),
  role: roleSchema.default("student_faculty"),
  userType: userTypeSchema.nullable().default(null),
  centreIds: centreIdList.default([]),
  primaryCentreId: centreIdSchema.nullable().default(null),
  regNo: z.string().trim().min(1).max(40).nullable().default(null),
  empId: z.string().trim().min(1).max(40).nullable().default(null),
  departmentId: centreIdSchema.nullable().default(null),
  mobile: mobileSchema.nullable().default(null),
});
export type PreRegisterBody = z.output<typeof preRegisterBodySchema>;

/** GET /users query. `q` (email prefix) cannot be combined with filters. */
export const userListQuerySchema = z.strictObject({
  q: z.string().trim().min(1).max(100).optional(),
  role: roleSchema.optional(),
  status: userStatusSchema.optional(),
  verified: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().max(200).optional(),
});
export type UserListQuery = z.output<typeof userListQuerySchema>;

/** PUT /me/profile — "Complete your profile" page. */
export const profileBodySchema = z.strictObject({
  userType: userTypeSchema,
  id: z.string().trim().min(1).max(20),
  departmentId: centreIdSchema,
  mobile: mobileSchema,
});
export type ProfileBody = z.output<typeof profileBodySchema>;

export const mobileBodySchema = z.strictObject({ mobile: mobileSchema });

/* ----------------------------- centres ----------------------------- */

/** Centres: 2-5 capital letters. Immutable; the token prefix and (lower-cased) the id. */
export const centreCodeSchema = z.string().regex(/^[A-Z]{2,5}$/, "Use 2-5 capital letters");
/** Departments: 2-8 capital letters or digits (e.g. CS, COM, BBA, MBA2). */
export const departmentCodeSchema = z
  .string()
  .regex(/^[A-Z0-9]{2,8}$/, "Use 2-8 capital letters or digits");

export const centreDocSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().regex(/^[A-Z0-9]{2,8}$/),
  kind: centreKindSchema.default("centre"),
  confidential: z.boolean().default(false),
  location: z.string().max(200).nullable().default(null),
  active: z.boolean().default(true),
});
export type CentreDoc = z.infer<typeof centreDocSchema>;
export type CentreWithId = CentreDoc & { id: string; tokenPrefix: string };

export const createCentreSchema = z.strictObject({
  code: centreCodeSchema,
  name: z.string().trim().min(2).max(120),
  confidential: z.boolean().default(false),
  location: z.string().trim().max(200).nullable().default(null),
});
export type CreateCentreBody = z.output<typeof createCentreSchema>;

export const updateCentreSchema = z
  .strictObject({
    name: z.string().trim().min(2).max(120).optional(),
    confidential: z.boolean().optional(),
    location: z.string().trim().max(200).nullable().optional(),
    active: z.boolean().optional(),
  })
  .refine(nonEmpty, NON_EMPTY_MSG);
export type UpdateCentreBody = z.output<typeof updateCentreSchema>;

/* --------------------------- departments --------------------------- */

export const createDepartmentSchema = z.strictObject({
  code: departmentCodeSchema,
  name: z.string().trim().min(2).max(120),
  /** Becomes Centre Admin ("Secretary") of this department's desk. */
  secretaryEmail: normalisedEmail.optional(),
});
export type CreateDepartmentBody = z.output<typeof createDepartmentSchema>;

export const updateDepartmentSchema = z
  .strictObject({
    name: z.string().trim().min(2).max(120).optional(),
    active: z.boolean().optional(),
  })
  .refine(nonEmpty, NON_EMPTY_MSG);
export type UpdateDepartmentBody = z.output<typeof updateDepartmentSchema>;

/* ------------------------------ staff ------------------------------ */

export const addStaffSchema = z.strictObject({
  email: normalisedEmail,
  /** centre_admin can only be granted by App Admin / Campus Authority. */
  role: z.enum(["centre_staff", "centre_admin"]).default("centre_staff"),
});
export type AddStaffBody = z.output<typeof addStaffSchema>;

/* ----------------------------- settings ---------------------------- */

export const idFormatSchema = z
  .strictObject({
    charset: z.enum(["digits", "alphanumeric"]),
    minLength: z.number().int().min(1).max(20),
    maxLength: z.number().int().min(1).max(20),
  })
  .refine((f) => f.minLength <= f.maxLength, "minLength cannot be greater than maxLength");

export const settingsDocSchema = z.object({
  idFormats: z.object({ student: idFormatSchema, faculty: idFormatSchema }),
});

export const settingsPatchSchema = z.strictObject({
  idFormats: z
    .strictObject({
      student: idFormatSchema.optional(),
      faculty: idFormatSchema.optional(),
    })
    .refine(nonEmpty, NON_EMPTY_MSG),
});
export type SettingsPatch = z.output<typeof settingsPatchSchema>;
