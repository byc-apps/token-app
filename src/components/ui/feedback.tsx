"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "./button";
import { ApiError } from "@/lib/api-client";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <p>{message}</p>
      {action ? <div style={{ marginTop: 12 }}>{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  message,
  error,
  status,
  requestId,
  onRetry,
}: {
  message: string;
  error?: unknown;
  status?: number;
  requestId?: string | null;
  onRetry?: () => void;
}) {
  const apiError = error instanceof ApiError ? error : null;
  const displayStatus = apiError?.status ?? status;
  const displayRequestId = apiError?.requestId ?? requestId;

  return (
    <div className="error-state" role="alert">
      <p className="error-state__message">{message}</p>
      {displayStatus === 500 && displayRequestId ? <p className="text-small text-muted">Request ID: {displayRequestId}</p> : null}
      {onRetry ? (
        <div style={{ marginTop: 12 }}>
          <Button variant="secondary" onClick={onRetry}>Retry</Button>
        </div>
      ) : null}
    </div>
  );
}

export function LoadMore({
  onClick,
  disabled = false,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button variant="secondary" onClick={onClick} disabled={disabled}>
      Load more
    </Button>
  );
}

export function Toast({ children, onDismiss }: { children: React.ReactNode; onDismiss?: () => void }) {
  return (
    <div className="toast" role="status">
      <div className="row row--spread">
        <span>{children}</span>
        {onDismiss ? (
          <button className="dialog__close" type="button" aria-label="Dismiss" onClick={onDismiss}>
            <X size={16} strokeWidth={1.5} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={`dialog ${className}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={() => onOpenChange(false)}
      onCancel={() => onOpenChange(false)}
    >
      <header className="dialog__header">
        <div className="stack stack--small">
          <h2 className="section-title" id={titleId}>{title}</h2>
          {description ? <p className="text-muted" id={descriptionId}>{description}</p> : null}
        </div>
        <button className="dialog__close" type="button" aria-label="Close dialog" onClick={() => onOpenChange(false)}>
          <X size={16} strokeWidth={1.5} />
        </button>
      </header>
      {children}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      {children}
      <div className="row" style={{ justifyContent: "flex-end", marginTop: 20 }}>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Dialog>
  );
}

export function SidePanel(props: React.ComponentProps<typeof Dialog>) {
  return <Dialog {...props} className={`side-panel ${props.className ?? ""}`} />;
}
