import { z } from "zod";
import { ROLES, isCentreRole, type Role } from "./roles";
import { DEFAULT_HOURS, toMinutes } from "./slots";
import { isDateKey } from "./time";

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
    /** Confirmations and cancellations are always sent; these two can be switched off. */
    emailPrefs: z
      .object({
        reminders: z.boolean().default(true),
        feedbackRequests: z.boolean().default(true),
      })
      .prefault({}),
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

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");

export const dayHoursSchema = z
  .object({
    open: hhmm,
    close: hhmm,
    lunchStart: hhmm.nullable().default(null),
    lunchEnd: hhmm.nullable().default(null),
    blocked: z.array(hhmm).max(40).default([]),
  })
  .refine((d) => toMinutes(d.open) < toMinutes(d.close), "Opening time must be before closing time")
  .refine((d) => toMinutes(d.open) % 30 === 0 && toMinutes(d.close) % 30 === 0, "Use :00 or :30 times")
  .refine((d) => (d.lunchStart === null) === (d.lunchEnd === null), "Give both lunch start and end, or neither")
  .refine(
    (d) => d.lunchStart === null || d.lunchEnd === null || toMinutes(d.lunchStart) < toMinutes(d.lunchEnd),
    "Lunch must start before it ends",
  );

const weekDay = dayHoursSchema.nullable();
export const weekHoursSchema = z.object({
  mon: weekDay,
  tue: weekDay,
  wed: weekDay,
  thu: weekDay,
  fri: weekDay,
  sat: weekDay,
  sun: weekDay,
});

export const centreConfigSchema = z.object({
  slotCapacity: z.number().int().min(1).max(100).default(6),
  autoConfirm: z.boolean().default(true),
  maxActivePerDay: z.number().int().min(1).max(10).default(1),
  allowOther: z.boolean().default(true),
  minutesPerToken: z.number().int().min(1).max(120).default(5),
  adaptiveEstimate: z.boolean().default(false),
  upcomingCount: z.number().int().min(1).max(10).default(5),
  showExpectedTimes: z.boolean().default(true),
  announcement: z.string().max(300).default(""),
  chime: z.boolean().default(true),
  displayMode: z.enum(["tokens", "neutral"]).default("tokens"),
  hours: weekHoursSchema.prefault(DEFAULT_HOURS),
});
export type CentreConfig = z.infer<typeof centreConfigSchema>;

const listItemSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  active: z.boolean().default(true),
});
export type ListItem = z.infer<typeof listItemSchema>;

export const centreDocSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().regex(/^[A-Z0-9]{2,8}$/),
  kind: centreKindSchema.default("centre"),
  confidential: z.boolean().default(false),
  location: z.string().max(200).nullable().default(null),
  active: z.boolean().default(true),
  config: centreConfigSchema.prefault({}),
  services: z.array(listItemSchema).max(50).default([]),
  counters: z.array(listItemSchema).max(20).default([]),
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

export const bookingSettingsSchema = z.object({
  windowDays: z.number().int().min(1).max(60).default(7),
  cancelBeforeMinutes: z.number().int().min(0).max(1440).default(60),
  noShowGraceMinutes: z.number().int().min(0).max(240).default(15),
});
export type BookingSettings = z.infer<typeof bookingSettingsSchema>;

export const settingsDocSchema = z.object({
  idFormats: z.object({ student: idFormatSchema, faculty: idFormatSchema }),
  booking: bookingSettingsSchema.prefault({}),
});

export const settingsPatchSchema = z
  .strictObject({
    idFormats: z
      .strictObject({
        student: idFormatSchema.optional(),
        faculty: idFormatSchema.optional(),
      })
      .refine(nonEmpty, NON_EMPTY_MSG)
      .optional(),
    booking: z
      .strictObject({
        windowDays: z.number().int().min(1).max(60).optional(),
        cancelBeforeMinutes: z.number().int().min(0).max(1440).optional(),
        noShowGraceMinutes: z.number().int().min(0).max(240).optional(),
      })
      .refine(nonEmpty, NON_EMPTY_MSG)
      .optional(),
  })
  .refine(nonEmpty, NON_EMPTY_MSG);
export type SettingsPatch = z.output<typeof settingsPatchSchema>;

/* ------------------------- centre setup ---------------------------- */

export const dateKeySchema = z.string().refine(isDateKey, "Use a real date as YYYY-MM-DD");
export const slotSchema = hhmm;

export const updateConfigSchema = z
  .strictObject({
    slotCapacity: z.number().int().min(1).max(100).optional(),
    autoConfirm: z.boolean().optional(),
    maxActivePerDay: z.number().int().min(1).max(10).optional(),
    allowOther: z.boolean().optional(),
    minutesPerToken: z.number().int().min(1).max(120).optional(),
    adaptiveEstimate: z.boolean().optional(),
    upcomingCount: z.number().int().min(1).max(10).optional(),
    showExpectedTimes: z.boolean().optional(),
    announcement: z.string().trim().max(300).optional(),
    chime: z.boolean().optional(),
    displayMode: z.enum(["tokens", "neutral"]).optional(),
    hours: z
      .strictObject({
        mon: weekDay.optional(),
        tue: weekDay.optional(),
        wed: weekDay.optional(),
        thu: weekDay.optional(),
        fri: weekDay.optional(),
        sat: weekDay.optional(),
        sun: weekDay.optional(),
      })
      .optional(),
  })
  .refine(nonEmpty, NON_EMPTY_MSG);
export type UpdateConfigBody = z.output<typeof updateConfigSchema>;

export const listItemIdSchema = z.string().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/);
export const addListItemSchema = z.strictObject({ name: z.string().trim().min(1).max(120) });
export const updateListItemSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(120).optional(),
    active: z.boolean().optional(),
  })
  .refine(nonEmpty, NON_EMPTY_MSG);

export const slotDayBodySchema = z
  .strictObject({
    closed: z.boolean().optional(),
    blocked: z.array(hhmm).max(40).optional(),
    note: z.string().trim().max(200).nullable().optional(),
  })
  .refine(nonEmpty, NON_EMPTY_MSG);
export type SlotDayBody = z.output<typeof slotDayBodySchema>;

export const slotsQuerySchema = z.strictObject({ date: dateKeySchema });

/* ----------------------------- tokens ------------------------------ */

const oneService = (v: { serviceId?: string; otherText?: string }) =>
  (v.serviceId === undefined) !== (v.otherText === undefined);
const ONE_SERVICE_MSG = "Give either serviceId or otherText, not both";

export const bookTokenSchema = z
  .strictObject({
    centreId: centreIdSchema,
    serviceId: z.string().min(1).max(40).optional(),
    otherText: z.string().trim().min(2).max(200).optional(),
    date: dateKeySchema,
    slot: slotSchema,
  })
  .refine(oneService, ONE_SERVICE_MSG);
export type BookTokenBody = z.output<typeof bookTokenSchema>;

export const modifyTokenSchema = z
  .strictObject({
    date: dateKeySchema.optional(),
    slot: slotSchema.optional(),
    serviceId: z.string().min(1).max(40).optional(),
    otherText: z.string().trim().min(2).max(200).optional(),
  })
  .refine(nonEmpty, NON_EMPTY_MSG)
  .refine((v) => v.serviceId === undefined || v.otherText === undefined, ONE_SERVICE_MSG);
export type ModifyTokenBody = z.output<typeof modifyTokenSchema>;

export const reasonBodySchema = z.strictObject({ reason: z.string().trim().min(2).max(200) });
export const optionalReasonSchema = z.strictObject({ reason: z.string().trim().min(2).max(200).optional() });
export const noteBodySchema = z.strictObject({ text: z.string().trim().min(1).max(500) });
export const counterBodySchema = z.strictObject({ counterId: listItemIdSchema });

export const walkInSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("christ"),
    id: z.string().trim().min(1).max(20),
    serviceId: z.string().min(1).max(40).optional(),
    otherText: z.string().trim().min(2).max(200).optional(),
  }),
  z.strictObject({
    kind: z.literal("visitor"),
    name: z.string().trim().min(2).max(120),
    mobile: mobileSchema,
    category: z.enum(["parent", "guest", "alumni", "vendor", "other"]),
    email: z.string().trim().toLowerCase().pipe(z.email()).optional(),
    serviceId: z.string().min(1).max(40).optional(),
    otherText: z.string().trim().min(2).max(200).optional(),
  }),
]);
export type WalkInBody = z.output<typeof walkInSchema>;

export const tokenListQuerySchema = z.strictObject({
  date: dateKeySchema,
  status: z.enum(["REQUESTED", "CONFIRMED", "CHECKED_IN", "IN_SERVICE", "COMPLETED", "CANCELLED", "NO_SHOW", "REJECTED"]).optional(),
});

export const myTokensQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.coerce.number().int().optional(),
});

export const feedbackSchema = z.strictObject({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});
export type FeedbackBody = z.output<typeof feedbackSchema>;

export const emailPrefsSchema = z
  .strictObject({
    reminders: z.boolean().optional(),
    feedbackRequests: z.boolean().optional(),
  })
  .refine(nonEmpty, NON_EMPTY_MSG);

export const reportQuerySchema = z.strictObject({
  from: dateKeySchema,
  to: dateKeySchema,
  centreId: centreIdSchema.optional(),
});

export const pagedQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().max(200).optional(),
});

export const auditQuerySchema = z.strictObject({
  centreId: centreIdSchema.optional(),
  actorUid: uidSchema.optional(),
  action: z.string().min(1).max(60).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().max(200).optional(),
});

export const emailLogQuerySchema = z.strictObject({
  status: z.enum(["queued", "sending", "sent", "failed"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().max(200).optional(),
});
