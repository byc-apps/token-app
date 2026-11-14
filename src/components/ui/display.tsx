"use client";

import { useId } from "react";

export function PageHeader({ title, description, actions }: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="row row--spread" style={{ alignItems: "flex-start", marginBottom: 24 }}>
      <div className="stack stack--small">
        <h1 className="page-title">{title}</h1>
        {description ? <p className="text-muted">{description}</p> : null}
      </div>
      {actions}
    </header>
  );
}

export function Box({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="box">
      {title ? <h2 className="section-title" style={{ marginBottom: 12 }}>{title}</h2> : null}
      {children}
    </section>
  );
}

export function TokenNumber({ children, large = false }: { children: string; large?: boolean }) {
  return <span className="token-number" style={large ? { fontSize: 32, fontWeight: 600 } : undefined}>{children}</span>;
}

export interface DateStripItem {
  date: string;
  label: string;
  weekday: string;
  disabled?: boolean;
}

export function DateStrip({
  items,
  value,
  onChange,
}: {
  items: DateStripItem[];
  value: string;
  onChange: (date: string) => void;
}) {
  return (
    <div className="date-strip" role="group" aria-label="Choose a date">
      {items.map((item) => (
        <button
          key={item.date}
          className="date-strip__item"
          type="button"
          aria-pressed={item.date === value}
          disabled={item.disabled}
          onClick={() => onChange(item.date)}
        >
          <span className="date-strip__weekday">{item.weekday}</span>
          <span className="date-strip__label">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

export interface SlotGridItem {
  start: string;
  label: string;
  state: "available" | "few" | "full" | "blocked" | "past";
  remaining?: number;
}

const slotStateLabel: Record<SlotGridItem["state"], string> = {
  available: "Available",
  few: "left",
  full: "Full",
  blocked: "Blocked",
  past: "Past",
};

export function SlotGrid({
  items,
  value,
  onChange,
}: {
  items: SlotGridItem[];
  value: string;
  onChange: (slot: string) => void;
}) {
  return (
    <div className="slot-grid" role="group" aria-label="Choose a slot">
      {items.map((item) => {
        const unavailable = item.state === "full" || item.state === "blocked" || item.state === "past";
        const detail = item.state === "few" ? `${item.remaining ?? 0} left` : slotStateLabel[item.state];
        return (
          <button
            key={item.start}
            className="slot-grid__item"
            type="button"
            aria-pressed={item.start === value}
            disabled={unavailable}
            onClick={() => onChange(item.start)}
          >
            <span className="slot-grid__label">{item.label}</span>
            <span className="slot-grid__detail">{detail}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Stars({
  value,
  onChange,
}: {
  value: number;
  onChange: (rating: number) => void;
}) {
  const groupId = useId();
  return (
    <div className="stars" role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          className="stars__button"
          type="button"
          aria-pressed={value === rating}
          aria-label={`${rating} ${rating === 1 ? "star" : "stars"}`}
          aria-describedby={groupId}
          onClick={() => onChange(rating)}
        >
          {rating}
        </button>
      ))}
      <span className="text-small text-muted" id={groupId}>{value ? `${value} of 5` : "Choose a rating"}</span>
    </div>
  );
}

export function CentrePicker({
  centres,
  value,
  onChange,
}: {
  centres: { id: string; name: string }[];
  value: string;
  onChange: (centreId: string) => void;
}) {
  return (
    <select className="select" value={value} onChange={(event) => onChange(event.target.value)} aria-label="Centre">
      {centres.map((centre) => <option key={centre.id} value={centre.id}>{centre.name}</option>)}
    </select>
  );
}
