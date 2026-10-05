import { Suspense } from 'react';
import { NteTable } from '@/components/nte/NteTable';
import { NteFilterBar } from '@/components/nte/NteFilterBar';
import { getSessionUser } from '@/lib/auth/session';
import { getNteList, getNteDepartments, getNteCounts } from '@/lib/queries/nte';
import { getLatestAttendancePeriod } from '@/lib/queries/attendance';
import { addDays, isIsoDate, lastCompleteWeekStart, monthEnd, todayPH } from '@/lib/utils/week';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: {
    status?: string;
    start?: string; // YYYY-MM-DD
    end?: string;
    dept?: string;
  };
}

export default async function NtePage({ searchParams }: PageProps) {
  const [departments, latestPeriod, user] = await Promise.all([
    getNteDepartments(), getLatestAttendancePeriod(), getSessionUser(),
  ]);

  // Presets follow the uploaded data: "last week" is the latest Mon–Sun week it
  // fully covers (the week reviewed on Monday); "this month" is its month.
  const latest = latestPeriod?.latestDate ?? todayPH();
  const lastWeekStart = lastCompleteWeekStart(latest);
  const presets = {
    lastWeek: { start: lastWeekStart, end: addDays(lastWeekStart, 6) },
    thisMonth: { start: `${latest.slice(0, 7)}-01`, end: monthEnd(latest) },
  };

  let start = isIsoDate(searchParams.start) ? searchParams.start : presets.lastWeek.start;
  let end = isIsoDate(searchParams.end) ? searchParams.end : presets.lastWeek.end;
  if (start > end) [start, end] = [end, start];

  const [rows, counts] = await Promise.all([
    getNteList({ status: searchParams.status, start, end, department: searchParams.dept }),
    getNteCounts({ start, end, department: searchParams.dept }),
  ]);

  const total = counts.required + counts.issued + counts.acknowledged;

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="bg-white border-b border-border flex-shrink-0">
        <div className="px-6 pt-4 pb-3">
          <h1 className="text-[15px] font-semibold text-app-text tracking-tight">NTE Management</h1>
          <p className="text-[12px] text-muted mt-0.5">Weekly NTEs (Mon–Sun) for employees at 6+ lates or 60+ min month-to-date who were late that week. Admins issue and acknowledge them here.</p>
        </div>
        <Suspense>
          <NteFilterBar
            start={start}
            end={end}
            presets={presets}
            departments={departments}
            selectedStatus={searchParams.status}
            selectedDept={searchParams.dept}
          />
        </Suspense>
      </div>

      {/* Content — flex column so the table can own its scroll */}
      <div className="flex-1 min-h-0 flex flex-col p-6 gap-5">
        {/* Status summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-border rounded-[7px] px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.09em] text-muted mb-1">Total</p>
            <p className="text-2xl font-semibold text-app-text">{total}</p>
          </div>
          <div className="bg-white border border-nte-red/20 rounded-[7px] px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.09em] text-nte-red/70 mb-1">NTE Required</p>
            <p className="text-2xl font-semibold text-nte-red">{counts.required}</p>
          </div>
          <div className="bg-white border border-amber/30 rounded-[7px] px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.09em] text-amber-dark/80 mb-1">Issued</p>
            <p className="text-2xl font-semibold text-amber-dark">{counts.issued}</p>
          </div>
          <div className="bg-white border border-safe-green/20 rounded-[7px] px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.09em] text-safe-green/80 mb-1">Acknowledged</p>
            <p className="text-2xl font-semibold text-safe-green">{counts.acknowledged}</p>
          </div>
        </div>

        <NteTable rows={rows as unknown as Parameters<typeof NteTable>[0]['rows']} isAdmin={user?.role === 'admin'} />
      </div>
    </div>
  );
}
