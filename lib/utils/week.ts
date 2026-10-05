// Calendar-date helpers for Monday–Sunday NTE weeks. All math is done on
// "YYYY-MM-DD" strings in UTC so the server's timezone can never shift a day.

// First day judged by the weekly rule. Earlier months keep their monthly NTEs.
export const WEEKLY_NTE_START = '2026-10-01';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

function toUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isIsoDate(value: string | undefined | null): value is string {
  return !!value && ISO_DATE.test(value) && !Number.isNaN(toUtc(value).getTime());
}

export function addDays(iso: string, days: number): string {
  return toIso(new Date(toUtc(iso).getTime() + days * DAY_MS));
}

export function weekStart(iso: string): string {
  const dow = toUtc(iso).getUTCDay(); // 0 = Sunday
  return addDays(iso, -((dow + 6) % 7));
}

export function weekEnd(iso: string): string {
  return addDays(weekStart(iso), 6);
}

export function monthEnd(iso: string): string {
  const d = toUtc(iso);
  return toIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
}

// Monday of the latest week whose Sunday is covered by the data.
export function lastCompleteWeekStart(latestDataDate: string): string {
  return addDays(weekStart(addDays(latestDataDate, 1)), -7);
}

export function todayPH(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

function isFullMonth(start: string, end: string): boolean {
  return start.endsWith('-01') && end === monthEnd(start);
}

// "Sep 28 – Oct 4, 2026", or "September 2026" for a legacy monthly period.
export function formatPeriod(start: string, end: string): string {
  const s = toUtc(start);
  const e = toUtc(end);
  if (isFullMonth(start, end)) {
    return s.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
  const md = { month: 'short', day: 'numeric', timeZone: 'UTC' } as const;
  const mdy = { ...md, year: 'numeric' } as const;
  return s.getUTCFullYear() === e.getUTCFullYear()
    ? `${s.toLocaleDateString('en-US', md)} – ${e.toLocaleDateString('en-US', mdy)}`
    : `${s.toLocaleDateString('en-US', mdy)} – ${e.toLocaleDateString('en-US', mdy)}`;
}

// An NTE period is either a Monday–Sunday week touching the weekly era, or a
// full calendar month from before it.
export function isValidNtePeriod(start: string, end: string): boolean {
  if (!isIsoDate(start) || !isIsoDate(end)) return false;
  if (isFullMonth(start, end)) return end < WEEKLY_NTE_START;
  return weekStart(start) === start && end === addDays(start, 6) && end >= WEEKLY_NTE_START;
}

export interface MonthOption {
  label: string;
  start: string;
  end: string;
}

// Month shortcuts for the date-range filters: "All time" plus each month
// (YYYY-MM, newest first) as its full calendar span.
export function buildMonthOptions(months: string[]): MonthOption[] {
  const ranges = months.map((m) => {
    const start = `${m}-01`;
    const end = monthEnd(start);
    return { label: formatPeriod(start, end), start, end };
  });
  if (!ranges.length) return [];
  return [{ label: 'All time', start: ranges[ranges.length - 1].start, end: ranges[0].end }, ...ranges];
}
