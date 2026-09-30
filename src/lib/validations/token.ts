import { z } from "zod";
import { isChristUniversityEmail } from "../auth/domain-verification";

// Allowed Student Service Center Service Desks / Centers
export const CENTER_IDS = [
  "general-enquiry",
  "bonafide-certificates",
  "fee-counter",
  "scholarships",
  "id-cards",
  "bus-pass",
  "transcripts-documents",
] as const;

export const TOKEN_STATUSES = [
  "PENDING",
  "CALLED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export const TOKEN_PRIORITIES = ["REGULAR", "URGENT", "SPECIAL_ASSISTANCE"] as const;

// Custom Zod refinement for Christ University Email
export const christEmailSchema = z
  .string()
  .email("Invalid email address format")
  .refine(
    (email) => isChristUniversityEmail(email),
    {
      message: "Email must belong to Christ University (@christuniversity.in or valid subdomains)",
    }
  );

/**
 * Schema for creating a new token by a student
 */
export const createTokenSchema = z.object({
  studentEmail: christEmailSchema,
  studentName: z
    .string()
    .min(2, "Student name must be at least 2 characters")
    .max(100, "Student name must not exceed 100 characters")
    .trim(),
  registerNumber: z
    .string()
    .min(4, "Register number must be at least 4 characters")
    .max(20, "Register number must not exceed 20 characters")
    .regex(/^[a-zA-Z0-9]+$/, "Register number must be alphanumeric")
    .trim(),
  department: z
    .string()
    .min(2, "Department name must be at least 2 characters")
    .max(100, "Department must not exceed 100 characters")
    .trim(),
  centerId: z.enum(CENTER_IDS, {
    message: "Invalid service center selected",
  }),
  serviceType: z
    .string()
    .min(2, "Service type is required")
    .max(100, "Service type is too long")
    .trim(),
  priority: z.enum(TOKEN_PRIORITIES).default("REGULAR"),
  notes: z
    .string()
    .max(500, "Notes cannot exceed 500 characters")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .regex(/^[0-9+\-\s()]{7,15}$/, "Invalid phone number format")
    .optional()
    .or(z.literal("")),
});

/**
 * Schema for updating token status by faculty / staff
 */
export const updateTokenStatusSchema = z.object({
  tokenId: z.string().min(1, "Token ID is required"),
  status: z.enum(TOKEN_STATUSES),
  assignedCounter: z
    .string()
    .max(50, "Counter identifier too long")
    .optional(),
  servedByFacultyId: z
    .string()
    .max(100, "Faculty ID too long")
    .optional(),
  facultyRemarks: z
    .string()
    .max(500, "Remarks cannot exceed 500 characters")
    .optional(),
  centerId: z.enum(CENTER_IDS),
});

/**
 * Schema for token cancellation (by student or staff)
 */
export const cancelTokenSchema = z.object({
  tokenId: z.string().min(1, "Token ID is required"),
  reason: z
    .string()
    .min(3, "Cancellation reason must be at least 3 characters")
    .max(200, "Cancellation reason cannot exceed 200 characters"),
});

/**
 * Schema for token query filters
 */
export const tokenQueryFilterSchema = z.object({
  centerId: z.enum(CENTER_IDS).optional(),
  status: z.enum(TOKEN_STATUSES).optional(),
  studentEmail: christEmailSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).default(20).optional(),
});

/**
 * Schema for students_master documents
 * Key: student's email (lowercase)
 */
export const studentMasterSchema = z.object({
  email: christEmailSchema,
  fullName: z.string().min(2).max(100),
  registerNumber: z.string().min(4).max(20),
  department: z.string().min(2).max(100),
  program: z.string().min(2).max(100),
  campus: z.string().default("Bangalore Yeshwanthpur Campus (BYC)"),
  academicYear: z.string().min(4).max(15),
  phone: z.string().optional(),
  status: z.enum(["ACTIVE", "ALUMNI", "SUSPENDED"]).default("ACTIVE"),
  updatedAt: z.string().datetime().optional(),
});

/**
 * Schema for mail trigger routines (collection: `mail`)
 */
export const mailQueueSchema = z.object({
  to: z.union([
    christEmailSchema,
    z.array(christEmailSchema).min(1, "At least one recipient required"),
  ]),
  message: z.object({
    subject: z.string().min(1, "Subject is required").max(200),
    text: z.string().min(1, "Message text is required"),
    html: z.string().optional(),
  }),
  template: z
    .object({
      name: z.string(),
      data: z.record(z.string(), z.unknown()),
    })
    .optional(),
  tokenId: z.string().min(1, "Token ID reference required"),
  createdAt: z.string().datetime().optional(),
  status: z.enum(["PENDING", "SENT", "FAILED"]).default("PENDING").optional(),
});

// Inferred TypeScript Types
export type CreateTokenInput = z.infer<typeof createTokenSchema>;
export type UpdateTokenStatusInput = z.infer<typeof updateTokenStatusSchema>;
export type CancelTokenInput = z.infer<typeof cancelTokenSchema>;
export type TokenQueryFilterInput = z.infer<typeof tokenQueryFilterSchema>;
export type StudentMasterRecord = z.infer<typeof studentMasterSchema>;
export type MailQueueRecord = z.infer<typeof mailQueueSchema>;
