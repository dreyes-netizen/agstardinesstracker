import { Suspense } from 'react';
import { NteTable } from '@/components/nte/NteTable';
import { NteFilterBar } from '@/components/nte/NteFilterBar';
import { getNteList, getNteFilterOptions, getNteCounts } from '@/lib/queries/nte';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: {
    status?: string;
    year?: string;
    month?: string; // just the month number "04", not "2026-04"
    dept?: string;
  };
}

export default async function NtePage({ searchParams }: PageProps) {
  const filterOptions = await getNteFilterOptions();

  // Derive defaults from the latest entry (already sorted DESC).
  const [defaultYear, defaultMonthNum] = (filterOptions.months[0] || '').split('-');
  const selectedYear = searchParams.year || defaultYear || '';
  const selectedMonthNum = searchParams.month || defaultMonthNum || '';
  const month = selectedYear && selectedMonthNum ? `${selectedYear}-${selectedMonthNum}` : '';

  const [rows, counts] = await Promise.all([
    getNteList({
      status: searchParams.status,
      month,
      department: searchParams.dept,
    }),
    getNteCounts({ month, department: searchParams.dept }),
  ]);

  const total = counts.required + counts.issued + counts.acknowledged;

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="bg-white border-b border-border flex-shrink-0">
        <div className="px-6 pt-4 pb-3">
          <h1 className="text-[15px] font-semibold text-app-text tracking-tight">NTE Management</h1>
          <p className="text-[12px] text-muted mt-0.5">Employees who crossed the tardiness threshold. Issue and track NTE documents here.</p>
        </div>
        <Suspense>
          <NteFilterBar
            months={filterOptions.months}
            departments={filterOptions.departments}
            selectedStatus={searchParams.status}
            selectedYear={selectedYear}
            selectedMonthNum={selectedMonthNum}
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
          <div className="bg-white border border-amber-200 rounded-[7px] px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.09em] text-amber-500/80 mb-1">Issued</p>
            <p className="text-2xl font-semibold text-amber-500">{counts.issued}</p>
          </div>
          <div className="bg-white border border-safe-green/20 rounded-[7px] px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.09em] text-safe-green/80 mb-1">Acknowledged</p>
            <p className="text-2xl font-semibold text-safe-green">{counts.acknowledged}</p>
          </div>
        </div>

        <NteTable rows={rows as unknown as Parameters<typeof NteTable>[0]['rows']} />
      </div>
    </div>
  );
}
