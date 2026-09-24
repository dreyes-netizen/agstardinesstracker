import { computeNteStatus, NteDbStatus } from '@/lib/utils/nte-status';

// Returns an error message, or null when the adjustment is valid.
// Adjustments may only reduce or waive (0) a late day, never raise it.
export function validateAdjustment(originalMinutes: number, adjustedMinutes: number, reason: string): string | null {
  if (originalMinutes <= 0) return 'This day has no late minutes to adjust.';
  if (!Number.isInteger(adjustedMinutes) || adjustedMinutes < 0) return 'Minutes must be a whole number of 0 or more.';
  if (adjustedMinutes >= originalMinutes) return `Minutes must be less than the original ${originalMinutes}.`;
  if (!reason.trim()) return 'A reason is required.';
  return null;
}

// A 'required' NTE is removed once effective totals fall back under the threshold.
// Issued/acknowledged NTEs are formal records and are never auto-removed.
export function shouldClearRequiredNte(lateCount: number, accumulatedMinutes: number, dbStatus: NteDbStatus): boolean {
  return dbStatus === 'required' && computeNteStatus(lateCount, accumulatedMinutes, null) !== 'required';
}
