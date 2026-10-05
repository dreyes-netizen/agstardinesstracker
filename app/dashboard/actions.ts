'use server';

import { requireRole, type SessionUser } from '@/lib/auth/session';
import {
  getOriginalLateMinutes, getAdjustment, upsertAdjustment, deleteAdjustment,
  getEffectivePeriodTotals, getNteDbStatus, deleteRequiredNte,
} from '@/lib/queries/adjustments';
import { upsertNteRequired, reconcileWeeklyNte } from '@/lib/queries/nte';
import { addNteAuditEntry } from '@/lib/queries/audit';
import { validateAdjustment, shouldClearRequiredNte } from '@/lib/utils/late-adjustment';
import { computeNteStatus } from '@/lib/utils/nte-status';
import { formatDate } from '@/lib/utils/date';
import { WEEKLY_NTE_START, monthEnd, weekEnd, weekStart } from '@/lib/utils/week';
import { revalidatePath } from 'next/cache';

type Result = { ok: true } | { error: string };

const validDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

function revalidateAll() {
  revalidatePath('/');
  revalidatePath('/nte');
  revalidatePath('/tardiness');
  revalidatePath('/audit');
}

// The NTE period a late date belongs to: its Mon–Sun week, or its whole month
// before the weekly rule started.
function ntePeriodFor(date: string) {
  return date < WEEKLY_NTE_START
    ? { periodStart: `${date.slice(0, 7)}-01`, periodEnd: monthEnd(date) }
    : { periodStart: weekStart(date), periodEnd: weekEnd(date) };
}

// Keep nte_records in step with the effective totals: drop still-'required' rows
// that no longer qualify, and re-create ones that do again.
async function reconcileNte(employeeId: string, date: string, user: SessionUser) {
  const actor = { actorEmail: user.email, actorRole: user.role };

  if (date < WEEKLY_NTE_START) {
    const { periodStart, periodEnd } = ntePeriodFor(date);
    const { lateCount, accumulatedMinutes } = await getEffectivePeriodTotals(employeeId, periodStart, periodEnd);
    const status = await getNteDbStatus(employeeId, periodStart, periodEnd);
    if (shouldClearRequiredNte(lateCount, accumulatedMinutes, status)) {
      await deleteRequiredNte(employeeId, periodStart, periodEnd);
      await addNteAuditEntry({
        employeeId, periodStart, periodEnd, action: 'nte_auto_cleared', ...actor,
        details: `Below threshold after adjustment: ${lateCount} lates, ${accumulatedMinutes} min`,
      });
    } else if (status === null && computeNteStatus(lateCount, accumulatedMinutes, null) === 'required') {
      await upsertNteRequired(employeeId, periodStart, periodEnd);
    }
    return;
  }

  // Month-to-date totals feed every later week of the month, so re-check them all.
  const lastDay = monthEnd(date);
  const cleared = await reconcileWeeklyNte(employeeId, weekStart(date), weekStart(lastDay), weekEnd(lastDay));
  for (const c of cleared) {
    await addNteAuditEntry({
      employeeId, periodStart: c.period_start, periodEnd: c.period_end, action: 'nte_auto_cleared', ...actor,
      details: `No longer required after adjusting ${formatDate(date)}`,
    });
  }
}

export async function saveLateAdjustmentAction(
  employeeId: string, date: string, adjustedMinutes: number, reasonRaw: string,
): Promise<Result> {
  const user = await requireRole('admin');
  if (!validDate(date)) return { error: 'Invalid date.' };
  const reason = reasonRaw.trim();

  const original = await getOriginalLateMinutes(employeeId, date);
  if (original === null) return { error: 'No attendance record for this date.' };
  const invalid = validateAdjustment(original, adjustedMinutes, reason);
  if (invalid) return { error: invalid };

  await upsertAdjustment(employeeId, date, adjustedMinutes, reason, user.email);

  await addNteAuditEntry({
    employeeId, ...ntePeriodFor(date), month: date.slice(0, 7),
    action: adjustedMinutes === 0 ? 'late_waived' : 'late_adjusted',
    actorEmail: user.email, actorRole: user.role,
    details: `${formatDate(date)}: ${original} → ${adjustedMinutes} min — ${reason}`,
  });
  await reconcileNte(employeeId, date, user);
  revalidateAll();
  return { ok: true };
}

export async function removeLateAdjustmentAction(employeeId: string, date: string): Promise<Result> {
  const user = await requireRole('admin');
  if (!validDate(date)) return { error: 'Invalid date.' };

  const existing = await getAdjustment(employeeId, date);
  if (!existing) return { error: 'No adjustment to remove.' };
  const original = await getOriginalLateMinutes(employeeId, date);

  await deleteAdjustment(employeeId, date);

  await addNteAuditEntry({
    employeeId, ...ntePeriodFor(date), month: date.slice(0, 7), action: 'late_adjustment_removed',
    actorEmail: user.email, actorRole: user.role,
    details: `${formatDate(date)}: restored to ${original ?? '?'} min (was ${existing.adjustedMinutes})`,
  });
  await reconcileNte(employeeId, date, user);
  revalidateAll();
  return { ok: true };
}
