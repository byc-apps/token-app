import { effectiveStatus, type TokenDoc, type TokenStatus } from "./tokens";

export interface Rating {
  average: number | null;
  count: number;
}

export interface CentreReport {
  centreId: string;
  total: number;
  booked: number;
  walkIns: number;
  completed: number;
  noShow: number;
  cancelled: number;
  noShowRate: number; // 0..1 of booked tokens
  avgWaitMinutes: number | null; // check-in to call
  avgServiceMinutes: number | null; // call to close
  byStatus: Partial<Record<TokenStatus, number>>;
  /** Left out for confidential centres unless the viewer works there. */
  byService?: { name: string; count: number }[];
  byDay?: { date: string; total: number; completed: number }[];
}

const avg = (xs: number[]): number | null =>
  xs.length === 0 ? null : Math.round((xs.reduce((a, b) => a + b, 0) / xs.length / 60_000) * 10) / 10;

export function aggregateTokens(
  centreId: string,
  tokens: TokenDoc[],
  nowMs: number,
  graceMinutes: number,
  detail: boolean,
): CentreReport {
  const byStatus: Partial<Record<TokenStatus, number>> = {};
  const waits: number[] = [];
  const services: number[] = [];
  const names = new Map<string, number>();
  const days = new Map<string, { total: number; completed: number }>();
  let booked = 0;
  let walkIns = 0;

  for (const t of tokens) {
    const status = effectiveStatus(t, nowMs, graceMinutes);
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    if (t.kind === "booked") booked++;
    else walkIns++;
    if (t.calledAt !== null && t.checkedInAt !== null) waits.push(Math.max(0, t.calledAt - t.checkedInAt));
    if (t.completedAt !== null && t.calledAt !== null) services.push(Math.max(0, t.completedAt - t.calledAt));
    names.set(t.serviceName, (names.get(t.serviceName) ?? 0) + 1);
    const d = days.get(t.date) ?? { total: 0, completed: 0 };
    d.total++;
    if (status === "COMPLETED") d.completed++;
    days.set(t.date, d);
  }

  const noShow = byStatus.NO_SHOW ?? 0;
  const report: CentreReport = {
    centreId,
    total: tokens.length,
    booked,
    walkIns,
    completed: byStatus.COMPLETED ?? 0,
    noShow,
    cancelled: (byStatus.CANCELLED ?? 0) + (byStatus.REJECTED ?? 0),
    noShowRate: booked === 0 ? 0 : Math.round((noShow / booked) * 1000) / 1000,
    avgWaitMinutes: avg(waits),
    avgServiceMinutes: avg(services),
    byStatus,
  };
  if (detail) {
    report.byService = [...names].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    report.byDay = [...days]
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  return report;
}

export function averageRating(ratings: number[]): Rating {
  if (ratings.length === 0) return { average: null, count: 0 };
  const sum = ratings.reduce((a, b) => a + b, 0);
  return { average: Math.round((sum / ratings.length) * 100) / 100, count: ratings.length };
}
