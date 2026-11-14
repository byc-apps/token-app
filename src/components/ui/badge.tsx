import { STATUS_LABELS, statusTone, ROLE_LABELS, type Role, type TokenStatus } from "@/lib/labels";

export function Badge({ children }: { children: React.ReactNode }) {
  return <span className="tag">{children}</span>;
}

export function StatusBadge({ status }: { status: TokenStatus }) {
  return (
    <span className={`badge badge--${statusTone(status)}`}>
      <span className="badge__dot" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  return <span className="tag">{ROLE_LABELS[role]}</span>;
}
