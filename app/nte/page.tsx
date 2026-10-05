import { Suspense } from 'react';
import { NteTable } from '@/components/nte/NteTable';
import { NteFilterBar } from '@/components/nte/NteFilterBar';
import { getSessionUser } from '@/lib/auth/session';
import { getNteList, getNteFilterOptions, getNteCounts } from '@/lib/queries/nte';
import { getLatestAttendancePeriod } from '@/lib/queries/attendance';
import { addDays, formatPeriod, isIsoDate, lastCompleteWeekStart, monthEnd, todayPH } from '@/lib/utils/week';

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
  const [{ months, departments }, latestPeriod, user] = await Promise.all([
    getNteFilterOptions(), getLatestAttendancePeriod(), getSessionUser(),
  ]);

  // "Last week" is the latest Mon–Sun week the uploaded data fully covers — the
  // week reviewed on Monday — and the default view.
  const latest = latestPeriod?.latestDate ?? todayPH();
  const lastWeekStart = lastCompleteWeekStart(latest);
  const lastWeek = { start: lastWeekStart, end: addDays(lastWeekStart, 6) };

  // Month shortcuts: every month with data, plus "All time" to find older NTEs
  // that are still open.
  const monthRanges = months.map((m) => {
    const start = `${m}-01`;
    const end = monthEnd(start);
    return { label: formatPeriod(start, end), start, end };
  });
  const monthOptions = monthRanges.length
    ? [{ label: 'All time', start: monthRanges[monthRanges.length - 1].start, end: monthRanges[0].end }, ...monthRanges]
    : [];

  let start = isIsoDate(searchParams.start) ? searchParams.start : lastWeek.start;
  let end = isIsoDate(searchParams.end) ? searchParams.end : lastWeek.end;
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
            lastWeek={lastWeek}
            monthOptions={monthOptions}
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
