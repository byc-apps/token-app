import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isChristUniversityEmail,
  getUserRoleFromEmail,
  AUTH_ERROR_MESSAGES,
  CHRIST_UNIVERSITY_DOMAIN,
} from "../src/lib/auth/domain-verification";
import {
  createTokenSchema,
  updateTokenStatusSchema,
  cancelTokenSchema,
  tokenQueryFilterSchema,
  studentMasterSchema,
  mailQueueSchema,
  CENTER_IDS,
  TOKEN_STATUSES,
} from "../src/lib/validations/token";

describe("Christ University Domain Verification Suite", () => {
  it("should accept apex domain @christuniversity.in", () => {
    assert.strictEqual(isChristUniversityEmail("faculty@christuniversity.in"), true);
    assert.strictEqual(isChristUniversityEmail("admin@christuniversity.in"), true);
    assert.strictEqual(isChristUniversityEmail("ssc.helpdesk@christuniversity.in"), true);
  });

  it("should accept valid student and departmental sub-domains", () => {
    assert.strictEqual(isChristUniversityEmail("john.doe@student.christuniversity.in"), true);
    assert.strictEqual(isChristUniversityEmail("priya.sharma@student.christuniversity.in"), true);
    assert.strictEqual(isChristUniversityEmail("researcher@res.christuniversity.in"), true);
    assert.strictEqual(isChristUniversityEmail("mba.dept@mba.christuniversity.in"), true);
    assert.strictEqual(isChristUniversityEmail("byc.campus@byc.christuniversity.in"), true);
    assert.strictEqual(isChristUniversityEmail("deep.sub@eng.res.christuniversity.in"), true);
  });

  it("should reject non-Christ domains with clean error handling", () => {
    const nonChristEmails = [
      "john.doe@gmail.com",
      "user@yahoo.co.in",
      "student@outlook.com",
      "attacker@christuniversity.com", // wrong TLD (.com instead of .in)
      "spoof@fakechristuniversity.in", // not a subdomain
      "phishing@christuniversity.in.attacker.com", // attacker is actual domain
      "random@edu.in",
      "malicious@notchristuniversity.in",
    ];

    for (const email of nonChristEmails) {
      assert.strictEqual(
        isChristUniversityEmail(email),
        false,
        `Expected ${email} to be rejected`
      );
    }
  });

  it("should handle invalid, null, undefined or empty strings safely", () => {
    assert.strictEqual(isChristUniversityEmail(""), false);
    assert.strictEqual(isChristUniversityEmail(null as unknown as string), false);
    assert.strictEqual(isChristUniversityEmail(undefined as unknown as string), false);
    assert.strictEqual(isChristUniversityEmail("not-an-email"), false);
    assert.strictEqual(isChristUniversityEmail("@christuniversity.in"), false);
  });

  it("should correctly identify user roles from email", () => {
    assert.strictEqual(
      getUserRoleFromEmail("student.one@student.christuniversity.in"),
      "student"
    );
    assert.strictEqual(
      getUserRoleFromEmail("faculty.dean@christuniversity.in"),
      "faculty"
    );
    assert.strictEqual(
      getUserRoleFromEmail("ssc.admin@christuniversity.in"),
      "admin"
    );
  });

  it("should have expected rejection message defined", () => {
    assert.ok(AUTH_ERROR_MESSAGES.DOMAIN_UNAUTHORIZED.includes("Christ University"));
  });
});

describe("Zod Validation Schemas for Token Operations", () => {
  it("should validate a correct token creation payload", () => {
    const validPayload = {
      studentEmail: "rahul.k@student.christuniversity.in",
      studentName: "Rahul Kumar",
      registerNumber: "2340123",
      department: "School of Engineering and Technology",
      centerId: "bonafide-certificates",
      serviceType: "Bonafide Certificate for Visa",
      priority: "REGULAR",
      notes: "Need for urgent travel verification",
      phone: "+91 9876543210",
    };

    const parsed = createTokenSchema.safeParse(validPayload);
    assert.strictEqual(parsed.success, true);
  });

  it("should reject token creation with non-Christ email", () => {
    const invalidPayload = {
      studentEmail: "hacker@gmail.com",
      studentName: "Test User",
      registerNumber: "2340123",
      department: "Computer Science",
      centerId: "general-enquiry",
      serviceType: "General Query",
    };

    const parsed = createTokenSchema.safeParse(invalidPayload);
    assert.strictEqual(parsed.success, false);
    if (!parsed.success) {
      const emailError = parsed.error.issues.find((i) => i.path.includes("studentEmail"));
      assert.ok(emailError);
      assert.ok(emailError?.message.includes("Christ University"));
    }
  });

  it("should reject invalid service center ID", () => {
    const invalidPayload = {
      studentEmail: "student@student.christuniversity.in",
      studentName: "Student Name",
      registerNumber: "2340999",
      department: "School of Law",
      centerId: "non-existent-counter",
      serviceType: "Certificate",
    };

    const parsed = createTokenSchema.safeParse(invalidPayload);
    assert.strictEqual(parsed.success, false);
  });

  it("should validate faculty token status update", () => {
    const validUpdate = {
      tokenId: "token_12345_abc",
      status: "IN_PROGRESS",
      assignedCounter: "Desk 4 - SSC Bangalore Yeshwanthpur",
      servedByFacultyId: "FAC_BYC_102",
      facultyRemarks: "Documents verified. Processing stamp.",
      centerId: "bonafide-certificates",
    };

    const parsed = updateTokenStatusSchema.safeParse(validUpdate);
    assert.strictEqual(parsed.success, true);
  });

  it("should validate token cancellation schema", () => {
    const cancelPayload = {
      tokenId: "token_987",
      reason: "Issue resolved online through student portal",
    };

    const parsed = cancelTokenSchema.safeParse(cancelPayload);
    assert.strictEqual(parsed.success, true);

    const tooShort = { tokenId: "t1", reason: "no" };
    assert.strictEqual(cancelTokenSchema.safeParse(tooShort).success, false);
  });

  it("should validate student master schema", () => {
    const validStudent = {
      email: "ananya.s@student.christuniversity.in",
      fullName: "Ananya S",
      registerNumber: "2247101",
      department: "School of Business and Management",
      program: "BBA Finance and Accountancy",
      campus: "Bangalore Yeshwanthpur Campus (BYC)",
      academicYear: "2024-2025",
      phone: "+91 9988776655",
      status: "ACTIVE",
    };

    const parsed = studentMasterSchema.safeParse(validStudent);
    assert.strictEqual(parsed.success, true);
  });

  it("should validate mail trigger routine schema", () => {
    const validMail = {
      to: "ananya.s@student.christuniversity.in",
      message: {
        subject: "Your SSC Token is Ready - BYC Service Center",
        text: "Your token #B-042 has been called at Counter 2.",
        html: "<p>Your token <strong>#B-042</strong> has been called at Counter 2.</p>",
      },
      tokenId: "token_9999",
      status: "PENDING",
    };

    const parsed = mailQueueSchema.safeParse(validMail);
    assert.strictEqual(parsed.success, true);
  });
});
