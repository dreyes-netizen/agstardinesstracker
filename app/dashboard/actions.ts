'use server';

import { requireRole, type SessionUser } from '@/lib/auth/session';
import {
  getOriginalLateMinutes, getAdjustment, upsertAdjustment, deleteAdjustment,
  getEffectiveMonthTotals, getNteDbStatus, deleteRequiredNte,
} from '@/lib/queries/adjustments';
import { upsertNteRequired } from '@/lib/queries/nte';
import { addNteAuditEntry } from '@/lib/queries/audit';
import { validateAdjustment, shouldClearRequiredNte } from '@/lib/utils/late-adjustment';
import { computeNteStatus } from '@/lib/utils/nte-status';
import { formatDate } from '@/lib/utils/date';
import { revalidatePath } from 'next/cache';

type Result = { ok: true } | { error: string };

const validDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

function revalidateAll() {
  revalidatePath('/');
  revalidatePath('/nte');
  revalidatePath('/tardiness');
  revalidatePath('/audit');
}

// Keep the month's nte_records row in step with the effective totals: drop a
// still-'required' row that no longer qualifies, or re-create one that does again.
async function reconcileNte(employeeId: string, month: string, user: SessionUser) {
  const { lateCount, accumulatedMinutes } = await getEffectiveMonthTotals(employeeId, month);
  const status = await getNteDbStatus(employeeId, month);
  if (shouldClearRequiredNte(lateCount, accumulatedMinutes, status)) {
    await deleteRequiredNte(employeeId, month);
    await addNteAuditEntry({
      employeeId, month, action: 'nte_auto_cleared',
      actorEmail: user.email, actorRole: user.role,
      details: `Below threshold after adjustment: ${lateCount} lates, ${accumulatedMinutes} min`,
    });
  } else if (status === null && computeNteStatus(lateCount, accumulatedMinutes, null) === 'required') {
    await upsertNteRequired(employeeId, month);
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

  const month = date.slice(0, 7);
  await addNteAuditEntry({
    employeeId, month,
    action: adjustedMinutes === 0 ? 'late_waived' : 'late_adjusted',
    actorEmail: user.email, actorRole: user.role,
    details: `${formatDate(date)}: ${original} → ${adjustedMinutes} min — ${reason}`,
  });
  await reconcileNte(employeeId, month, user);
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

  const month = date.slice(0, 7);
  await addNteAuditEntry({
    employeeId, month, action: 'late_adjustment_removed',
    actorEmail: user.email, actorRole: user.role,
    details: `${formatDate(date)}: restored to ${original ?? '?'} min (was ${existing.adjustedMinutes})`,
  });
  await reconcileNte(employeeId, month, user);
  revalidateAll();
  return { ok: true };
}
