'use server';

import { issueNte, acknowledgeNte } from '@/lib/queries/nte';
import { addNteAuditEntry, getNteAuditForEmployeeMonth } from '@/lib/queries/audit';
import { requireRole, requireUser } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';

export interface NteHistoryItem {
  id: number;
  action: string;
  actorEmail: string;
  actorRole: string | null;
  details: string | null;
  createdAt: string;
}

// Read the audit history for one NTE (employee + month) — used inline in the
// NTE detail panel.
export async function getNteHistoryAction(employeeId: string, month: string): Promise<NteHistoryItem[]> {
  await requireUser();
  const rows = await getNteAuditForEmployeeMonth(employeeId, month);
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    actorEmail: r.actorEmail,
    actorRole: r.actorRole,
    details: r.details,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : '',
  }));
}

// issuedBy is derived from the authenticated session — never trusted from the
// client — and every action is recorded in the NTE audit trail.
export async function issueNteAction(employeeId: string, month: string, notes: string) {
  const user = await requireRole('manager'); // admin or manager
  // Show the person's name on the NTE; the audit log keeps the email for identity.
  await issueNte(employeeId, month, user.displayName || user.email, notes);
  await addNteAuditEntry({
    employeeId, month, action: 'issued',
    actorEmail: user.email, actorRole: user.role, details: notes || null,
  });
  revalidatePath('/');
  revalidatePath('/nte');
  revalidatePath('/audit');
}

export async function acknowledgeNteAction(employeeId: string, month: string) {
  const user = await requireRole('manager');
  await acknowledgeNte(employeeId, month);
  await addNteAuditEntry({
    employeeId, month, action: 'acknowledged',
    actorEmail: user.email, actorRole: user.role,
  });
  revalidatePath('/');
  revalidatePath('/nte');
  revalidatePath('/audit');
}
