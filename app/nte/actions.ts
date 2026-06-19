'use server';

import { issueNte, acknowledgeNte } from '@/lib/queries/nte';
import { revalidatePath } from 'next/cache';

export async function issueNteAction(employeeId: string, month: string, issuedBy: string, notes: string) {
  await issueNte(employeeId, month, issuedBy, notes);
  revalidatePath('/');
  revalidatePath('/nte');
}

export async function acknowledgeNteAction(employeeId: string, month: string) {
  await acknowledgeNte(employeeId, month);
  revalidatePath('/');
  revalidatePath('/nte');
}
