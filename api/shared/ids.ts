/**
 * Register No. (students) and Employee ID (staff/faculty): formats, checks, link keys.
 * Formats are stored as an admin-editable setting; these are the defaults.
 */
export type IdKind = "student" | "faculty";
export type IdCharset = "digits" | "alphanumeric";

export interface IdFormat {
  charset: IdCharset;
  minLength: number;
  maxLength: number;
}
export interface IdFormats {
  student: IdFormat;
  faculty: IdFormat;
}

export const DEFAULT_ID_FORMATS: IdFormats = {
  student: { charset: "digits", minLength: 7, maxLength: 7 }, // e.g. 2543101
  faculty: { charset: "alphanumeric", minLength: 3, maxLength: 6 }, // e.g. 1414
};

export const ID_LABEL: Record<IdKind, string> = {
  student: "Register No.",
  faculty: "Employee ID",
};

export const normaliseId = (raw: string): string => raw.trim().toUpperCase();

export type IdCheck = { ok: true; id: string } | { ok: false; message: string };

export function checkId(kind: IdKind, raw: string, formats: IdFormats): IdCheck {
  const f = formats[kind];
  const id = normaliseId(raw);
  const pattern = f.charset === "digits" ? /^[0-9]+$/ : /^[A-Z0-9]+$/;
  const what = f.charset === "digits" ? "digits" : "letters or digits";
  const length = f.minLength === f.maxLength ? `${f.minLength}` : `${f.minLength}-${f.maxLength}`;
  if (!pattern.test(id) || id.length < f.minLength || id.length > f.maxLength) {
    return { ok: false, message: `${ID_LABEL[kind]} must be ${length} ${what}.` };
  }
  return { ok: true, id };
}

interface Identity {
  userType: IdKind | null;
  regNo: string | null;
  empId: string | null;
}

/** The ID that belongs to this person's type (regNo for students, empId for faculty). */
export function userIdValue(u: Identity): string | null {
  if (u.userType === "student") return u.regNo;
  if (u.userType === "faculty") return u.empId;
  return null;
}

export const idLinkKey = (kind: IdKind, id: string): string => `${kind}_${id}`;

export function idKeyOf(u: Identity): string | null {
  const id = userIdValue(u);
  return u.userType && id ? idLinkKey(u.userType, id) : null;
}

/** Returns a message if type/ID combination is inconsistent or badly formatted. */
export function identityProblem(u: Identity, formats: IdFormats): string | null {
  if (u.userType === null) {
    return u.regNo !== null || u.empId !== null
      ? "Set the account type (student or faculty) before adding an ID."
      : null;
  }
  const own = u.userType === "student" ? u.regNo : u.empId;
  const other = u.userType === "student" ? u.empId : u.regNo;
  if (other !== null) {
    return `A ${u.userType} cannot have a ${ID_LABEL[u.userType === "student" ? "faculty" : "student"]}.`;
  }
  if (own === null) return null;
  const checked = checkId(u.userType, own, formats);
  return checked.ok ? null : checked.message;
}

export function isProfileComplete(
  u: Identity & { departmentId: string | null; mobile: string | null },
): boolean {
  return u.userType !== null && userIdValue(u) !== null && u.departmentId !== null && u.mobile !== null;
}
