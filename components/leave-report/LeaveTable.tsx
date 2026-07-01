'use client';

import { useState, useMemo } from 'react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  flexRender, createColumnHelper, SortingState,
} from '@tanstack/react-table';
import type { ApprovedLeaveRow } from '@/lib/queries/leave';
import { formatDate } from '@/lib/utils/date';

const col = createColumnHelper<ApprovedLeaveRow>();

const hide = { hideMobile: true };

const columns = [
  col.accessor('employeeId', {
    header: 'Employee ID',
    meta: hide,
    cell: (info) => <span className="font-mono text-[12px] whitespace-nowrap">{info.getValue()}</span>,
  }),
  col.accessor('name', {
    header: 'Name',
    cell: (info) => (
      <span className="font-medium block truncate" title={info.getValue() ?? undefined}>
        {info.getValue() ?? '—'}
      </span>
    ),
  }),
  col.accessor('department', {
    header: 'Department',
    meta: hide,
    cell: (info) => (
      <span className="text-muted text-[12px] block truncate" title={info.getValue() ?? undefined}>
        {info.getValue() ?? '—'}
      </span>
    ),
  }),
  col.accessor('leaveType', {
    header: 'Leave Type',
    cell: (info) => <span className="whitespace-nowrap text-[13px]">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('dateFiled', {
    header: 'Date Filed',
    meta: hide,
    cell: (info) => <span className="text-[12.5px] text-muted whitespace-nowrap">{formatDate(info.getValue())}</span>,
  }),
  col.accessor('dateFrom', {
    header: 'Date From',
    cell: (info) => <span className="text-[12.5px] whitespace-nowrap">{formatDate(info.getValue())}</span>,
  }),
  col.accessor('dateTo', {
    header: 'Date To',
    cell: (info) => <span className="text-[12.5px] whitespace-nowrap">{formatDate(info.getValue())}</span>,
  }),
  col.accessor('totalDays', {
    header: () => <span className="block text-right whitespace-nowrap">Total Days</span>,
    cell: (info) => (
      <span className="font-mono text-[12.5px] block text-right font-medium whitespace-nowrap">
        {info.getValue()}
      </span>
    ),
  }),
];

interface LeaveTableProps {
  data: ApprovedLeaveRow[];
  start: string;
  end: string;
}

function escCsv(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

const SELECT_CLS =
  'bg-ground border border-border rounded-[5px] px-2 py-1.5 text-[12.5px] text-app-text focus:outline-none focus:ring-2 focus:ring-app-blue/40';

export function LeaveTable({ data, start, end }: LeaveTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [manager, setManager] = useState('');
  const [leaveType, setLeaveType] = useState('');

  const departments = useMemo(() => {
    const set = new Set<string>();
    data.forEach((r) => { if (r.department) set.add(r.department); });
    return Array.from(set).sort();
  }, [data]);

  const leaveTypes = useMemo(() => {
    const set = new Set<string>();
    data.forEach((r) => { if (r.leaveType) set.add(r.leaveType); });
    return Array.from(set).sort();
  }, [data]);

  const scoped = useMemo(() => dept ? data.filter((r) => r.department === dept) : data, [data, dept]);
  const supervisors = useMemo(() => {
    const set = new Set<string>();
    scoped.forEach((r) => { if (r.immediateSupervisor) set.add(r.immediateSupervisor); });
    return Array.from(set).sort();
  }, [scoped]);
  const managers = useMemo(() => {
    const set = new Set<string>();
    scoped.forEach((r) => { if (r.approver2) set.add(r.approver2); });
    return Array.from(set).sort();
  }, [scoped]);

  function handleDeptChange(value: string) {
    setDept(value);
    if (value) {
      const inDept = data.filter((r) => r.department === value);
      if (supervisor && !inDept.some((r) => r.immediateSupervisor === supervisor)) setSupervisor('');
      if (manager && !inDept.some((r) => r.approver2 === manager)) setManager('');
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((r) => {
      if (dept && r.department !== dept) return false;
      if (supervisor && r.immediateSupervisor !== supervisor) return false;
      if (manager && r.approver2 !== manager) return false;
      if (leaveType && r.leaveType !== leaveType) return false;
      if (!q) return true;
      return (
        (r.name ?? '').toLowerCase().includes(q) ||
        r.employeeId.toLowerCase().includes(q)
      );
    });
  }, [data, search, dept, supervisor, manager, leaveType]);

  function exportCsv() {
    const rows: string[][] = [
      ['Date range', `${start} to ${end}`],
      ['Department', dept || 'All'],
      ['Supervisor', supervisor || 'All'],
      ['Manager', manager || 'All'],
      ['Leave Type', leaveType || 'All'],
      ['Status', 'Approved only'],
      ['Records exported', String(filtered.length)],
      [],
      ['Employee ID', 'Name', 'Department', 'Leave Type', 'Date Filed', 'Date From', 'Date To', 'Total Days'],
      ...filtered.map((r) => [
        r.employeeId,
        r.name ?? '',
        r.department ?? '',
        r.leaveType ?? '',
        r.dateFiled ?? '',
        r.dateFrom,
        r.dateTo,
        String(r.totalDays),
      ]),
    ];
    const csv = rows.map((r) => r.map(escCsv).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leave-report-${start}_${end}.csv`;
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
      <div className="px-5 py-3 border-b border-border flex items-center gap-3 flex-wrap flex-shrink-0">
        <span className="text-[13.5px] font-semibold text-app-text flex-shrink-0">Approved Leaves</span>

        {/* Department filter */}
        <select value={dept} onChange={(e) => handleDeptChange(e.target.value)} className={`${SELECT_CLS} flex-shrink-0`}>
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>

        {/* Supervisor filter */}
        <select value={supervisor} onChange={(e) => setSupervisor(e.target.value)} className={`${SELECT_CLS} flex-shrink-0`}>
          <option value="">{dept ? `All Supervisors (${supervisors.length})` : 'All Supervisors'}</option>
          {supervisors.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Manager filter */}
        <select value={manager} onChange={(e) => setManager(e.target.value)} className={`${SELECT_CLS} flex-shrink-0`}>
          <option value="">{dept ? `All Managers (${managers.length})` : 'All Managers'}</option>
          {managers.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>

        {/* Leave type filter */}
        <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className={`${SELECT_CLS} flex-shrink-0`}>
          <option value="">All Leave Types</option>
          {leaveTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* Search */}
        <div className="flex-1 relative min-w-[160px]">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID, or leave type…"
            className="w-full pl-8 pr-3 py-1.5 text-[12.5px] bg-ground border border-border rounded-[5px] focus:outline-none focus:ring-2 focus:ring-app-blue/40 placeholder:text-muted"
          />
        </div>

        <span className="text-[11.5px] text-muted flex-shrink-0">
          {filtered.length}{(search || dept || supervisor || manager || leaveType) ? ` of ${data.length}` : ''} leaves
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
                    className={`px-3.5 py-2.5 text-left font-mono text-[10px] tracking-[0.09em] uppercase text-muted cursor-pointer hover:text-app-text select-none first:pl-5 last:pr-5${(header.column.columnDef as any).meta?.hideMobile ? ' hidden md:table-cell' : ''}`}
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
              <tr key={row.id} className={`border-b border-row-border transition-colors ${i % 2 === 1 ? 'bg-row-alt' : ''} hover:bg-row-hover`}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={`px-3.5 py-[10px] text-[13px] first:pl-5 last:pr-5${(cell.column.columnDef as any).meta?.hideMobile ? ' hidden md:table-cell' : ''}`}>
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
