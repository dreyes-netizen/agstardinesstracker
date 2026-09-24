'use client';

import { useState } from 'react';
import { saveLateAdjustmentAction, removeLateAdjustmentAction } from '@/app/dashboard/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LateAdjustFormProps {
  employeeId: string;
  date: string;
  originalMinutes: number;
  adjusted: boolean;
  currentMinutes: number;
  currentReason: string | null;
  onDone: () => void;
  onCancel: () => void;
}

export function LateAdjustForm({
  employeeId, date, originalMinutes, adjusted, currentMinutes, currentReason, onDone, onCancel,
}: LateAdjustFormProps) {
  const [waive, setWaive] = useState(adjusted && currentMinutes === 0);
  const [minutes, setMinutes] = useState(adjusted && currentMinutes > 0 ? String(currentMinutes) : '');
  const [reason, setReason] = useState(currentReason ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<{ ok: true } | { error: string }>) {
    setSaving(true);
    setError(null);
    const res = await action();
    setSaving(false);
    if ('error' in res) setError(res.error);
    else onDone();
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const value = waive ? 0 : Number(minutes);
    if (!waive && minutes.trim() === '') { setError('Enter the adjusted minutes or waive the day.'); return; }
    run(() => saveLateAdjustmentAction(employeeId, date, value, reason));
  }

  return (
    <form onSubmit={handleSave} className="space-y-2.5 bg-ground rounded-[5px] px-3 py-3">
      <label className="flex items-center gap-2 text-[12px] text-app-text cursor-pointer">
        <input type="checkbox" checked={waive} onChange={(e) => setWaive(e.target.checked)} className="accent-app-blue" />
        Waive entire day
      </label>
      {!waive && (
        <div className="space-y-1">
          <Label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
            Adjusted minutes (original {originalMinutes})
          </Label>
          <Input
            type="number" min={0} max={originalMinutes - 1} step={1} inputMode="numeric"
            value={minutes} onChange={(e) => setMinutes(e.target.value)}
            className="text-[12.5px] bg-white"
          />
        </div>
      )}
      <div className="space-y-1">
        <Label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Reason</Label>
        <Input
          value={reason} onChange={(e) => setReason(e.target.value)} required
          placeholder="e.g. System outage, approved by HR"
          className="text-[12.5px] bg-white"
        />
      </div>
      {error && <p className="text-[12px] text-nte-red">{error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={saving} className="bg-app-blue hover:bg-app-blue/90 text-white">
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={saving} onClick={onCancel}>Cancel</Button>
        {adjusted && (
          <Button
            type="button" size="sm" variant="outline" disabled={saving}
            onClick={() => run(() => removeLateAdjustmentAction(employeeId, date))}
            className="ml-auto border-nte-red/40 text-nte-red hover:bg-nte-red/5"
          >
            Remove adjustment
          </Button>
        )}
      </div>
    </form>
  );
}
