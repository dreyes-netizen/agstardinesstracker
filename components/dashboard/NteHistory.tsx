'use client';

import { useEffect, useState } from 'react';
import { getNteHistoryAction, type NteHistoryItem } from '@/app/nte/actions';

// Inline NTE audit history for one employee + month, loaded on demand.
export function NteHistory({ employeeId, month }: { employeeId: string; month: string }) {
  const [items, setItems] = useState<NteHistoryItem[] | null>(null);

  useEffect(() => {
    let live = true;
    getNteHistoryAction(employeeId, month)
      .then((r) => { if (live) setItems(r); })
      .catch(() => { if (live) setItems([]); });
    return () => { live = false; };
  }, [employeeId, month]);

  if (!items || items.length === 0) return null;

  return (
    <div className="border-t border-border pt-3 mt-1">
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted mb-2">History</p>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="text-[11.5px] text-muted leading-snug">
            <span className="capitalize text-app-text font-medium">{it.action}</span>
            {' by '}<span className="text-app-text">{it.actorEmail}</span>
            {' · '}
            {new Date(it.createdAt).toLocaleString('en-US', {
              month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit',
            })}
            {it.details ? <span className="block">“{it.details}”</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
