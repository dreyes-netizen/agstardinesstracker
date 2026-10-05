'use client';

import { useState } from 'react';
import { issueNteAction, acknowledgeNteAction } from '@/app/nte/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NteStatus } from '@/lib/utils/nte-status';
import { formatDate } from '@/lib/utils/date';
import { formatPeriod } from '@/lib/utils/week';
import { NteHistory } from './NteHistory';

interface NteFormProps {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  nteStatus: NteStatus;
  issuedDate: string | null;
  issuedBy: string | null;
  acknowledgedDate: string | null;
  notes: string | null;
  isAdmin: boolean;
  onSuccess: () => void;
}

const fmtDate = formatDate;

export function NteForm({ employeeId, periodStart, periodEnd, nteStatus, issuedDate, issuedBy, acknowledgedDate, notes, isAdmin, onSuccess }: NteFormProps) {
  const [notesInput, setNotesInput] = useState('');
  const [loading, setLoading] = useState(false);

  const periodLabel = formatPeriod(periodStart, periodEnd);

  async function handleIssue(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await issueNteAction(employeeId, periodStart, periodEnd, notesInput);
    setLoading(false);
    onSuccess();
  }

  async function handleAcknowledge() {
    setLoading(true);
    await acknowledgeNteAction(employeeId, periodStart, periodEnd);
    setLoading(false);
    onSuccess();
  }

  if (nteStatus === 'acknowledged') {
    return (
      <div className="space-y-2 text-[12.5px] text-muted">
        <p>NTE issued <span className="font-medium text-app-text">{fmtDate(issuedDate)}</span> by <span className="font-medium text-app-text">{issuedBy ?? '—'}</span></p>
        {notes && <p>Notes: {notes}</p>}
        <p className="text-safe-green font-medium">Acknowledged {fmtDate(acknowledgedDate)}</p>
        <NteHistory employeeId={employeeId} periodStart={periodStart} periodEnd={periodEnd} />
      </div>
    );
  }

  if (nteStatus === 'issued') {
    return (
      <div className="space-y-3">
        <div className="text-[12.5px] text-muted space-y-1">
          <p>NTE issued <span className="font-medium text-app-text">{fmtDate(issuedDate)}</span> by <span className="font-medium text-app-text">{issuedBy ?? '—'}</span></p>
          {notes && <p>Notes: {notes}</p>}
        </div>
        {isAdmin && (
          <Button onClick={handleAcknowledge} disabled={loading} variant="outline" className="w-full border-safe-green/40 text-safe-green hover:bg-safe-green/5">
            {loading ? 'Saving…' : 'Mark Acknowledged'}
          </Button>
        )}
        <NteHistory employeeId={employeeId} periodStart={periodStart} periodEnd={periodEnd} />
      </div>
    );
  }

  if (nteStatus === 'required') {
    return (
      <div className="space-y-3">
        <div className="bg-nte-red/[0.08] border border-nte-red/20 rounded-[5px] px-3.5 py-2.5 text-[12px] text-nte-red font-medium">
          Threshold crossed — NTE required for {periodLabel}
        </div>
        {isAdmin ? (
          <form onSubmit={handleIssue} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Notes</Label>
              <Input value={notesInput} onChange={(e) => setNotesInput(e.target.value)} placeholder="Optional — context or follow-up" className="text-[12.5px] bg-ground" />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-nte-red hover:bg-nte-red/90 text-white">
              {loading ? 'Saving…' : `Issue NTE for ${periodLabel}`}
            </Button>
          </form>
        ) : (
          <p className="text-[12px] text-muted">Only an admin can issue this NTE.</p>
        )}
      </div>
    );
  }

  return null;
}
