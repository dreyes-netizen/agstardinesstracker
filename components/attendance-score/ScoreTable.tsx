'use client';

import { useState, useMemo } from 'react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  flexRender, createColumnHelper, SortingState,
} from '@tanstack/react-table';
import type { AttendanceScore } from '@/lib/queries/attendance-score';

const col = createColumnHelper<AttendanceScore>();

const h2 = (n: number) => n.toFixed(2);
const pct2 = (n: number) => `${(n * 100).toFixed(2)}%`;

// Color tiers mirror the conditional formatting in the "Attendance Score" sheet.
function pctClass(p: number): string {
  if (p < 0.9) return 'bg-nte-red/10 text-nte-red';
  if (p < 0.95) return 'bg-amber/10 text-amber';
  if (p < 1) return 'bg-app-blue/10 text-app-blue';
  return 'bg-safe-green/10 text-safe-green';
}
function gradeClass(g: number): string {
  if (g === 1) return 'bg-nte-red/10 text-nte-red';
  if (g === 2) return 'bg-amber/10 text-amber';
  if (g === 3) return 'bg-app-blue/10 text-app-blue';
  return 'bg-safe-green/10 text-safe-green';
}

const rightHead = 'block text-right';
const numCellCls = 'font-mono text-[12.5px] block text-right';

const columns = [
  col.accessor('employeeId', {
    header: 'ID No',
    cell: (info) => <span className="font-mono text-[12px]">{info.getValue()}</span>,
  }),
  col.accessor('fullName', {
    header: 'Full Name',
    cell: (info) => <span className="font-medium">{info.getValue()}</span>,
  }),
  col.accessor('account', {
    header: 'Account',
    cell: (info) => <span className="text-muted text-[12px]">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('teamLeader', {
    header: 'Team Leader',
    cell: (info) => <span className="text-muted text-[12px]">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('accountManager', {
    header: 'Account Manager',
    cell: (info) => <span className="text-muted text-[12px]">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('totalHoursPresent', {
    header: () => <span className={rightHead}>Hrs Present</span>,
    cell: (info) => <span className={numCellCls}>{h2(info.getValue())}</span>,
  }),
  col.accessor('totalHoursAbsent', {
    header: () => <span className={rightHead}>Hrs Absent</span>,
    cell: (info) => <span className={numCellCls}>{h2(info.getValue())}</span>,
  }),
  col.accessor('totalSickLeaveHours', {
    header: () => <span className={rightHead}>Sick Hrs</span>,
    cell: (info) => {
      const v = info.getValue();
      return (
        <span className={`${numCellCls} ${v > 0 ? 'text-amber font-medium' : ''}`}>
          {h2(v)}
        </span>
      );
    },
  }),
  col.accessor('undertime', {
    header: () => <span className={rightHead}>Undertime</span>,
    cell: (info) => <span className={numCellCls}>{h2(info.getValue())}</span>,
  }),
  col.accessor('requiredHours', {
    header: () => <span className={rightHead}>Required Hrs</span>,
    cell: (info) => <span className={numCellCls}>{h2(info.getValue())}</span>,
  }),
  col.accessor('attendancePct', {
    header: () => <span className={rightHead}>Attendance %</span>,
    cell: (info) => {
      const v = info.getValue();
      return (
        <span className="block text-right">
          <span className={`inline-block font-mono text-[12px] px-1.5 py-0.5 rounded-[3px] ${pctClass(v)}`}>
            {pct2(v)}
          </span>
        </span>
      );
    },
  }),
  col.accessor('attendanceGrade', {
    header: () => <span className="block text-center">Grade</span>,
    cell: (info) => {
      const g = info.getValue();
      return (
        <span className="block text-center">
          <span className={`inline-block w-6 font-mono text-[12px] py-0.5 rounded-[3px] ${gradeClass(g)}`}>
            {g}
          </span>
        </span>
      );
    },
  }),
];

interface ScoreTableProps {
  data: AttendanceScore[];
  start: string;
  end: string;
  dept?: string;
  supervisor?: string;
  manager?: string;
}

function escCsv(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ScoreTable({ data, start, end, dept, supervisor, manager }: ScoreTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((e) => e.fullName.toLowerCase().includes(q) || e.employeeId.toLowerCase().includes(q));
  }, [data, search]);

  function exportCsv() {
    const rows: string[][] = [
      ['Date range', `${start} to ${end}`],
      ['Account', dept || 'All'],
      ['Team Leader', supervisor || 'All'],
      ['Account Manager', manager || 'All'],
      ['Records exported', String(filtered.length)],
      [],
      ['ID No', 'Full Name', 'Account', 'Team Leader', 'Account Manager',
        'Total Hours Present', 'Total Hours Absent', 'Total Sick Leave Hours',
        'Undertime', 'Required Hours', 'Attendance Percentage', 'Attendance Grade'],
      ...filtered.map((e) => [
        e.employeeId,
        e.fullName,
        e.account ?? '',
        e.teamLeader ?? '',
        e.accountManager ?? '',
        h2(e.totalHoursPresent),
        h2(e.totalHoursAbsent),
        h2(e.totalSickLeaveHours),
        h2(e.undertime),
        h2(e.requiredHours),
        pct2(e.attendancePct),
        String(e.attendanceGrade),
      ]),
    ];
    const csv = rows.map((r) => r.map(escCsv).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-score-${start}_${end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const table = useReactTable({
    data: filtered, columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="bg-white border border-border rounded-[7px] overflow-clip flex flex-col flex-1 min-h-0">
      <div className="px-5 py-3 border-b border-border flex items-center gap-3 flex-shrink-0">
        <span className="text-[13.5px] font-semibold text-app-text flex-shrink-0">Scores</span>
        <div className="flex-1 relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or ID…"
            className="w-full pl-8 pr-3 py-1.5 text-[12.5px] bg-ground border border-border rounded-[5px] focus:outline-none focus:ring-2 focus:ring-app-blue/40 placeholder:text-muted"
          />
        </div>
        <span className="text-[11.5px] text-muted flex-shrink-0">
          {filtered.length}{search ? ` of ${data.length}` : ''} employees
        </span>
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[5px] border border-border text-[11.5px] text-muted hover:text-app-text hover:border-app-text/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export CSV
        </button>
      </div>
      <div className="overflow-auto flex-1 min-h-0">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-ground">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="px-3.5 py-2.5 text-left font-mono text-[10px] tracking-[0.09em] uppercase text-muted cursor-pointer hover:text-app-text select-none first:pl-5 last:pr-5"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted() as string] ?? ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, i) => (
              <tr
                key={row.id}
                className={`border-b border-row-border transition-colors ${i % 2 === 1 ? 'bg-row-alt' : ''} hover:bg-row-hover`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3.5 py-[10px] text-[13px] first:pl-5 last:pr-5">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
