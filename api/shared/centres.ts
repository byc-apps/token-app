export type CentreKind = "centre" | "department";

/** Department desks live in the same collection as centres; ids are prefixed "dep-". */
export const centreIdFor = (kind: CentreKind, code: string): string =>
  kind === "department" ? `dep-${code.toLowerCase()}` : code.toLowerCase();

/** Token prefix: ITS-014 for a centre, DEP-CS-014 for a department desk. */
export const tokenPrefixFor = (kind: CentreKind, code: string): string =>
  kind === "department" ? `DEP-${code}` : code;
