'use server';

import { issueNte, acknowledgeNte } from '@/lib/queries/nte';
import { addNteAuditEntry, getNteAuditForPeriod } from '@/lib/queries/audit';
import { requireRole, requireUser } from '@/lib/auth/session';
import { isValidNtePeriod } from '@/lib/utils/week';
import { revalidatePath } from 'next/cache';

export interface NteHistoryItem {
  id: number;
  action: string;
  actorEmail: string;
  actorRole: string | null;
  details: string | null;
  createdAt: string;
}

// Read the audit history for one NTE (employee + period) — used inline in the
// NTE detail panel.
export async function getNteHistoryAction(employeeId: string, periodStart: string, periodEnd: string): Promise<NteHistoryItem[]> {
  await requireUser();
  const rows = await getNteAuditForPeriod(employeeId, periodStart, periodEnd);
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    actorEmail: r.actorEmail,
    actorRole: r.actorRole,
    details: r.details,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : '',
  }));
}

function revalidateNtePages() {
  revalidatePath('/');
  revalidatePath('/nte');
  revalidatePath('/audit');
}

// issuedBy is derived from the authenticated session — never trusted from the
// client — and every action is recorded in the NTE audit trail.
export async function issueNteAction(employeeId: string, periodStart: string, periodEnd: string, notes: string) {
  const user = await requireRole('admin');
  if (!isValidNtePeriod(periodStart, periodEnd)) throw new Error('Invalid NTE period.');
  // Show the person's name on the NTE; the audit log keeps the email for identity.
  await issueNte(employeeId, periodStart, periodEnd, user.displayName || user.email, notes);
  await addNteAuditEntry({
    employeeId, periodStart, periodEnd, action: 'issued',
    actorEmail: user.email, actorRole: user.role, details: notes || null,
  });
  revalidateNtePages();
}

export async function acknowledgeNteAction(employeeId: string, periodStart: string, periodEnd: string) {
  const user = await requireRole('admin');
  if (!isValidNtePeriod(periodStart, periodEnd)) throw new Error('Invalid NTE period.');
  await acknowledgeNte(employeeId, periodStart, periodEnd);
  await addNteAuditEntry({
    employeeId, periodStart, periodEnd, action: 'acknowledged',
    actorEmail: user.email, actorRole: user.role,
  });
  revalidateNtePages();
}
