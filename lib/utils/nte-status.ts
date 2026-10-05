export type NteDbStatus = 'required' | 'issued' | 'acknowledged' | null;
export type NteStatus = 'safe' | 'warning' | 'required' | 'issued' | 'acknowledged';

export function computeNteStatus(
  lateCount: number,
  accumulatedMinutes: number,
  dbStatus: NteDbStatus,
): NteStatus {
  if (dbStatus === 'acknowledged') return 'acknowledged';
  if (dbStatus === 'issued') return 'issued';
  if (lateCount >= 6 || accumulatedMinutes >= 60) return 'required';
  if (lateCount >= 4 || accumulatedMinutes >= 45) return 'warning';
  return 'safe';
}

// Weekly rule: the monthly threshold (counted month-to-date) is checked every
// week, and each week with a late after crossing earns another NTE.
// Mirrors the needs_nte column in weeklyLateSql (lib/queries/nte.ts).
export function weekNeedsNte(weekLates: number, mtdLates: number, mtdMinutes: number): boolean {
  return weekLates > 0 && computeNteStatus(mtdLates, mtdMinutes, null) === 'required';
}

// Over the threshold with no late this week means no NTE is due, but the next
// late would trigger one — shown as 'warning'.
export function computeWeeklyNteStatus(
  needsNte: boolean,
  mtdLates: number,
  mtdMinutes: number,
  dbStatus: NteDbStatus,
): NteStatus {
  if (dbStatus === 'acknowledged' || dbStatus === 'issued') return dbStatus;
  if (needsNte) return 'required';
  return computeNteStatus(mtdLates, mtdMinutes, null) === 'safe' ? 'safe' : 'warning';
}
