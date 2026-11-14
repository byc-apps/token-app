import { ROLE_LABELS, type Role } from "@shared/roles";

export { ROLE_LABELS };
export type { Role };

export type TokenStatus =
  | "REQUESTED"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "IN_SERVICE"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW"
  | "REJECTED";

export const STATUS_LABELS: Record<TokenStatus, string> = {
  REQUESTED: "Requested",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked in",
  IN_SERVICE: "In service",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
  REJECTED: "Rejected",
};

export function statusTone(status: TokenStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "CONFIRMED" || status === "IN_SERVICE") return "success";
  if (status === "REQUESTED") return "warning";
  if (status === "CANCELLED" || status === "NO_SHOW" || status === "REJECTED") return "danger";
  return "neutral";
}
