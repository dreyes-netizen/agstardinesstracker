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
